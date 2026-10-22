import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Play, Square, Download, Scale, AlertTriangle } from "lucide-react";
import { useCelmiScale } from "@/hooks/useCelmiScale";

type EstadoTeste = "idle" | "rodando" | "sucesso" | "falha";

type Passo = {
  id: string;
  label: string;
  estado: "pending" | "ok" | "fail" | "running";
  detalhe?: string;
};

export function TesteBalanca() {
  const { status, leitura, erro, supported, conectar, desconectar, diag } = useCelmiScale();
  const [teste, setTeste] = useState<EstadoTeste>("idle");
  const [passos, setPassos] = useState<Passo[]>(inicial());
  const timeoutRef = useRef<number | null>(null);

  function inicial(): Passo[] {
    return [
      { id: "browser", label: "Navegador compatível (Chrome/Edge, HTTPS)", estado: "pending" },
      { id: "porta", label: "Porta USB selecionada e aberta (9600 8N1)", estado: "pending" },
      { id: "bytes", label: "Bytes recebidos da balança", estado: "pending" },
      { id: "frame", label: "Frame ASCII de 18 bytes decodificado", estado: "pending" },
      { id: "estado", label: "Leitura da balança (ST/US/OL + GS/NT + peso)", estado: "pending" },
    ];
  }

  function atualizar(id: string, patch: Partial<Passo>) {
    setPassos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  // Reage a mudanças do hook durante o teste
  useEffect(() => {
    if (teste !== "rodando") return;

    // Passo 1: browser
    atualizar("browser", {
      estado: supported ? "ok" : "fail",
      detalhe: supported ? "navigator.serial disponível" : "Web Serial não suportado — use Chrome/Edge em HTTPS",
    });
    if (!supported) {
      setTeste("falha");
      return;
    }

    // Passo 2: porta
    if (status === "connecting") atualizar("porta", { estado: "running", detalhe: "Aguardando seleção da porta..." });
    if (status === "connected") atualizar("porta", { estado: "ok", detalhe: "Porta aberta em 9600 8N1" });
    if (status === "error") {
      atualizar("porta", { estado: "fail", detalhe: erro ?? "Não foi possível abrir a porta" });
      setTeste("falha");
      return;
    }

    // Passo 3: bytes (timeout de 5s após conectar)
    if (status === "connected") {
      if (diag.bytesRecebidos > 0) {
        atualizar("bytes", { estado: "ok", detalhe: `${diag.bytesRecebidos} bytes recebidos` });
      } else if (passos.find((p) => p.id === "bytes")?.estado === "pending") {
        atualizar("bytes", { estado: "running", detalhe: "Aguardando envio contínuo da balança..." });
      }
    }

    // Passo 4/5: frames
    if (diag.framesValidos > 0 && leitura) {
      atualizar("frame", {
        estado: "ok",
        detalhe: `${diag.framesValidos} frame(s) válido(s)${diag.framesInvalidos ? ` · ${diag.framesInvalidos} inválido(s)` : ""}`,
      });
      const est = leitura.overload ? "OL (sobrecarga)" : leitura.estavel ? "ST (estável)" : "US (instável)";
      const tipo = leitura.bruto ? "GS (bruto)" : "NT (líquido)";
      atualizar("estado", {
        estado: leitura.overload ? "fail" : "ok",
        detalhe: `${est} · ${tipo} · ${leitura.peso} kg`,
      });
      setTeste(leitura.overload ? "falha" : "sucesso");
    } else if (diag.framesInvalidos > 0 && diag.framesValidos === 0) {
      atualizar("frame", {
        estado: "fail",
        detalhe: `${diag.framesInvalidos} frame(s) recebidos mas nenhum casou com o protocolo 18-byte Celmi. Verifique baud/paridade.`,
      });
      setTeste("falha");
    }
  }, [status, supported, erro, diag, leitura, teste]);

  // Timeout global de 8s: se travar aguardando bytes, marca falha
  useEffect(() => {
    if (teste !== "rodando") return;
    timeoutRef.current = window.setTimeout(() => {
      setPassos((prev) =>
        prev.map((p) => {
          if (p.estado === "running" || p.estado === "pending") {
            return {
              ...p,
              estado: "fail",
              detalhe:
                p.id === "bytes"
                  ? "Nenhum byte em 8s. Confira: cabo USB, driver do conversor RS-232, balança ligada e em modo de envio contínuo."
                  : "Timeout aguardando etapa anterior.",
            };
          }
          return p;
        }),
      );
      setTeste("falha");
    }, 8000);
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [teste]);

  // Se conseguir sucesso ou falha, para o timeout
  useEffect(() => {
    if (teste === "sucesso" || teste === "falha") {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    }
  }, [teste]);

  async function iniciar() {
    setPassos(inicial());
    setTeste("rodando");
    await conectar();
  }

  async function parar() {
    await desconectar();
    setTeste("idle");
    setPassos(inicial());
  }

  function baixarLog() {
    const linhas = [
      `Portal de Pesagem — Diagnóstico Celmi CSP-10A / CSP-10CL`,
      `Data: ${new Date().toLocaleString("pt-BR")}`,
      `Navegador: ${navigator.userAgent}`,
      ``,
      `Status: ${status}`,
      `Erro: ${erro ?? "—"}`,
      `Bytes recebidos: ${diag.bytesRecebidos}`,
      `Frames válidos: ${diag.framesValidos}`,
      `Frames inválidos: ${diag.framesInvalidos}`,
      `Último frame bruto: ${diag.ultimoFrameBruto ?? "—"}`,
      `Último frame (hex): ${diag.ultimoFrameHex ?? "—"}`,
      ``,
      `Última leitura:`,
      leitura
        ? `  peso=${leitura.peso} kg · ${leitura.estavel ? "ST" : "US"}${leitura.overload ? " · OL" : ""} · ${leitura.bruto ? "GS" : "NT"}`
        : "  —",
      ``,
      `Passos:`,
      ...passos.map((p) => `  [${p.estado}] ${p.label}${p.detalhe ? " — " + p.detalhe : ""}`),
    ].join("\n");
    const blob = new Blob([linhas], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnostico-balanca-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4 text-primary" />
            Diagnóstico de conexão da balança
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-wine-100 bg-wine-50/60 p-3 text-xs text-primary">
            Conecte o cabo USB do conversor RS-232 ao computador, ligue o indicador Celmi CSP-10A / CSP-10CL e
            clique em <strong>Iniciar teste</strong>. Uma janela do navegador vai pedir para escolher a
            porta serial — selecione a que corresponde ao conversor.
            <br />
            <span className="font-medium">Compatível com indicadores da família Celmi CSP-10.</span>
          </div>

          <ul className="space-y-2">
            {passos.map((p) => (
              <li
                key={p.id}
                className="flex items-start gap-3 rounded border bg-card p-3 text-sm"
              >
                <IconePasso estado={p.estado} />
                <div className="flex-1">
                  <div className="font-medium">{p.label}</div>
                  {p.detalhe && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{p.detalhe}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {teste === "sucesso" && (
            <div className="rounded-md border border-success/30 bg-success/5 p-3 text-sm text-success">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4" /> Comunicação OK
              </div>
              {leitura && (
                <div className="mt-1 text-xs">
                  Última leitura: <strong>{leitura.peso.toLocaleString("pt-BR")} kg</strong>{" "}
                  · {leitura.estavel ? "estável (ST)" : "instável (US)"} ·{" "}
                  {leitura.bruto ? "peso bruto (GS)" : "peso líquido (NT)"}
                </div>
              )}
            </div>
          )}

          {teste === "falha" && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" /> Falha na comunicação
              </div>
              <div className="mt-1 text-xs">
                {erro ?? "Veja a etapa marcada em vermelho acima para o motivo provável."}
              </div>
              {erro && /open serial port|Failed to open/i.test(erro) && (
                <div className="mt-2 space-y-1 rounded border border-destructive/30 bg-white/70 p-2 text-[11px] text-destructive">
                  <div className="font-medium">A porta não pôde ser aberta pelo sistema operacional. Verifique:</div>
                  <ul className="list-disc space-y-0.5 pl-4">
                    <li>Nenhum outro programa está usando a porta (software da balança, PuTTY, Arduino IDE, outra aba do navegador).</li>
                    <li>Você selecionou a porta do <strong>conversor USB-RS232</strong> (ex.: CH340, FTDI, Prolific) — não COM1/COM3 padrão do PC.</li>
                    <li>O driver do conversor está instalado (Windows: Gerenciador de Dispositivos sem “!” amarelo).</li>
                    <li>Linux: usuário no grupo <code>dialout</code>. macOS: conceder permissão em Privacidade e Segurança.</li>
                    <li>Desconecte e reconecte o cabo USB — libera handles presos de sessões anteriores.</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {teste !== "rodando" ? (
              <Button onClick={iniciar} className="bg-primary text-white hover:bg-primary-hover">
                <Play className="mr-1 h-4 w-4" /> Iniciar teste
              </Button>
            ) : (
              <Button onClick={parar} variant="outline">
                <Square className="mr-1 h-4 w-4" /> Parar
              </Button>
            )}
            {status === "connected" && teste !== "rodando" && (
              <Button onClick={() => void desconectar()} variant="ghost">
                Desconectar porta
              </Button>
            )}
            <Button
              onClick={baixarLog}
              variant="outline"
              disabled={teste === "idle" && diag.bytesRecebidos === 0}
            >
              <Download className="mr-1 h-4 w-4" /> Baixar log
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detalhes técnicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <Info label="Status da porta" value={<Badge variant="outline">{status}</Badge>} />
          <Info label="Bytes recebidos" value={diag.bytesRecebidos} />
          <Info
            label="Frames válidos / inválidos"
            value={`${diag.framesValidos} / ${diag.framesInvalidos}`}
          />
          <div>
            <div className="mb-1 text-muted-foreground">Último frame bruto</div>
            <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-[10px]">
              {diag.ultimoFrameBruto ?? "—"}
            </pre>
          </div>
          <div>
            <div className="mb-1 text-muted-foreground">Último frame (hex)</div>
            <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-[10px]">
              {diag.ultimoFrameHex ?? "—"}
            </pre>
          </div>
          <div className="rounded border border-border bg-muted p-2 text-[11px] text-foreground">
            <div className="font-medium">Protocolo esperado</div>
            <div>ASCII, 18 bytes, 9600 bps · 8 bits · sem paridade · 1 stop</div>
            <div className="mt-1">
              <code>ST,GS,+0012340kg␍␊</code>
            </div>
            <div className="mt-1 font-medium text-primary">
              Compatível com Celmi CSP-10A e CSP-10CL.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function IconePasso({ estado }: { estado: Passo["estado"] }) {
  if (estado === "ok") return <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />;
  if (estado === "fail") return <XCircle className="mt-0.5 h-4 w-4 text-destructive" />;
  if (estado === "running") return <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-warning" />;
  return <div className="mt-1 h-3 w-3 rounded-full border border-muted-foreground/40" />;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
