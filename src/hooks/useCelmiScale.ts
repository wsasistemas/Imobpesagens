import { useCallback, useEffect, useRef, useState } from "react";

// Leitura do indicador Celmi CSP-10 (CSP-10A / CSP-10CL) via Web Serial API.
// Protocolo ASCII 18 bytes: [1-2] ST/US/OL, [3] ',', [4-5] GS/NT, [6] ',',
// [7] sinal, [8-14] peso (7 díg.), [15-16] "kg", [17-18] CR+LF.

export type LeituraBalanca = {
  peso: number; // kg
  estavel: boolean;
  overload: boolean;
  bruto: boolean; // true = GS (bruto), false = NT (líquido)
};

export type ScaleStatus = "idle" | "connecting" | "connected" | "error" | "unsupported";

type SerialPortLike = {
  open: (options: { baudRate: number; dataBits?: number; stopBits?: number; parity?: string }) => Promise<void>;
  close: () => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
};

declare global {
  interface Navigator {
    serial?: {
      requestPort: () => Promise<SerialPortLike>;
    };
  }
}

function parseFrame(frame: string): LeituraBalanca | null {
  const clean = frame.replace(/[\r\n]/g, "").trim();
  // Aceita peso com espaços de padding (ex.: "+    0") ou zeros ("+0000000").
  const match = clean.match(/^(ST|US|OL)\s*,\s*(GS|NT)\s*,\s*([+-])\s*([\d ]{1,7})\s*kg$/i);
  if (!match) return null;
  const [, estado, tipo, sinal, digitos] = match;
  const overload = estado.toUpperCase() === "OL";
  const estavel = estado.toUpperCase() === "ST";
  const bruto = tipo.toUpperCase() === "GS";
  const limpos = digitos.replace(/\s/g, "");
  const valor = (limpos === "" ? 0 : parseInt(limpos, 10)) * (sinal === "-" ? -1 : 1);
  return { peso: valor, estavel, overload, bruto };
}

export type ScaleDiagnostics = {
  bytesRecebidos: number;
  framesValidos: number;
  framesInvalidos: number;
  ultimoFrameBruto: string | null;
  ultimoFrameHex: string | null;
};

export function useCelmiScale() {
  const [status, setStatus] = useState<ScaleStatus>("idle");
  const [leitura, setLeitura] = useState<LeituraBalanca | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean>(true);
  const [diag, setDiag] = useState<ScaleDiagnostics>({
    bytesRecebidos: 0,
    framesValidos: 0,
    framesInvalidos: 0,
    ultimoFrameBruto: null,
    ultimoFrameHex: null,
  });
  const portRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ok = !!navigator.serial;
    setSupported(ok);
    if (!ok) setStatus("unsupported");
  }, []);

  const resetDiag = useCallback(() => {
    setDiag({
      bytesRecebidos: 0,
      framesValidos: 0,
      framesInvalidos: 0,
      ultimoFrameBruto: null,
      ultimoFrameHex: null,
    });
  }, []);

  const conectar = useCallback(async () => {
    if (!navigator.serial) {
      setStatus("unsupported");
      setErro("Web Serial não suportado. Use Chrome/Edge via HTTPS.");
      return;
    }
    try {
      setStatus("connecting");
      setErro(null);
      resetDiag();
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: "none" });
      portRef.current = port;
      setStatus("connected");
      stopRef.current = false;

      let buffer = "";
      const decoder = new TextDecoder();
      while (!stopRef.current && port.readable) {
        const reader = port.readable.getReader();
        readerRef.current = reader;
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value && value.length) {
              const hex = Array.from(value).map((b) => b.toString(16).padStart(2, "0")).join(" ");
              setDiag((d) => ({ ...d, bytesRecebidos: d.bytesRecebidos + value.length, ultimoFrameHex: hex }));
            }
            buffer += decoder.decode(value, { stream: true });
            let idx: number;
            while ((idx = buffer.indexOf("\n")) !== -1) {
              const frame = buffer.slice(0, idx);
              buffer = buffer.slice(idx + 1);
              const parsed = parseFrame(frame);
              if (parsed) {
                setLeitura(parsed);
                setDiag((d) => ({ ...d, framesValidos: d.framesValidos + 1, ultimoFrameBruto: frame }));
              } else if (frame.trim().length) {
                setDiag((d) => ({ ...d, framesInvalidos: d.framesInvalidos + 1, ultimoFrameBruto: frame }));
              }
            }
          }
        } catch (e) {
          console.error(e);
        } finally {
          try {
            reader.releaseLock();
          } catch {
            /* noop */
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(msg);
      setStatus("error");
    }
  }, [resetDiag]);

  const desconectar = useCallback(async () => {
    stopRef.current = true;
    try {
      await readerRef.current?.cancel();
    } catch {
      /* noop */
    }
    try {
      await portRef.current?.close();
    } catch {
      /* noop */
    }
    portRef.current = null;
    readerRef.current = null;
    setStatus("idle");
    setLeitura(null);
  }, []);

  useEffect(() => {
    return () => {
      void desconectar();
    };
  }, [desconectar]);

  return { status, leitura, erro, supported, conectar, desconectar, diag };
}
