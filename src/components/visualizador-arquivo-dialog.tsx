import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Download, ExternalLink, FileText, Loader2, Maximize2, Minus, Plus, RotateCcw, RotateCw, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ArquivoVisualizacao = {
  url: string;
  nome: string;
  /** mime type ou extensão do arquivo (usado para decidir PDF x imagem) */
  tipo?: string;
};

export function ehArquivoPdf(...pistas: (string | null | undefined)[]) {
  return pistas.some((p) => !!p && (/pdf/i.test(p) || /\.pdf($|\?)/i.test(p)));
}

const MAX_PAGINAS = 20;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 4;
const ESCALA_RENDER = 2.2; // nitidez fixa; o zoom é aplicado por CSS
const LENTE_PX = 190;
const LENTE_FATOR = 2.2;

type PaginaRender = { src: string; largura: number; altura: number };

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function PdfCanvasViewer({
  url,
  nome,
  onErro,
  onBlob,
}: {
  url: string;
  nome: string;
  onErro: () => void;
  onBlob: (b: Blob) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paginas, setPaginas] = useState<PaginaRender[]>([]);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [rotacao, setRotacao] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [lupa, setLupa] = useState(false);
  const [lente, setLente] = useState<{
    x: number; y: number; src: string; bgX: number; bgY: number; bgW: number; bgH: number;
  } | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  /* ---------- renderização das páginas ---------- */
  useEffect(() => {
    let morto = false;
    setCarregando(true);
    setPaginas([]);

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        onBlob(blob);
        const data = await blob.arrayBuffer();
        if (morto) return;

        const doc = await pdfjs.getDocument({ data }).promise;
        if (morto) return;
        setTotalPaginas(doc.numPages);

        const total = Math.min(doc.numPages, MAX_PAGINAS);
        const resultado: PaginaRender[] = [];
        for (let i = 1; i <= total; i++) {
          if (morto) return;
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: ESCALA_RENDER, rotation: rotacao });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (morto) return;
          resultado.push({
            src: canvas.toDataURL("image/jpeg", 0.92),
            largura: canvas.width / ESCALA_RENDER,
            altura: canvas.height / ESCALA_RENDER,
          });
          setPaginas([...resultado]);
        }
        if (!morto) setCarregando(false);
      } catch (e) {
        console.error("Falha ao renderizar PDF", e);
        if (!morto) {
          setCarregando(false);
          onErro();
        }
      }
    })();

    return () => {
      morto = true;
    };
  }, [url, rotacao, onErro, onBlob]);

  /* ---------- ajustar à largura ---------- */
  const ajustarLargura = useCallback(() => {
    const host = scrollRef.current;
    const primeira = paginas[0];
    if (!host || !primeira) return;
    const disponivel = host.clientWidth - 40;
    setZoom(clamp(disponivel / primeira.largura, MIN_ZOOM, MAX_ZOOM));
  }, [paginas]);

  const primeiroAjuste = useRef(false);
  useLayoutEffect(() => {
    if (!primeiroAjuste.current && paginas.length > 0) {
      primeiroAjuste.current = true;
      ajustarLargura();
    }
  }, [paginas, ajustarLargura]);

  /* ---------- zoom com Ctrl + roda / pinça ---------- */
  const aplicarZoom = useCallback((proximo: number, px?: number, py?: number) => {
    const host = scrollRef.current;
    const atual = zoomRef.current;
    const alvo = clamp(proximo, MIN_ZOOM, MAX_ZOOM);
    if (alvo === atual) return;
    if (host && px !== undefined && py !== undefined) {
      const k = alvo / atual;
      const sx = host.scrollLeft, sy = host.scrollTop;
      requestAnimationFrame(() => {
        host.scrollLeft = (sx + px) * k - px;
        host.scrollTop = (sy + py) * k - py;
      });
    }
    setZoom(alvo);
  }, []);

  useEffect(() => {
    const host = scrollRef.current;
    if (!host) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const rect = host.getBoundingClientRect();
      aplicarZoom(
        zoomRef.current * Math.exp(-dy * 0.0015),
        e.clientX - rect.left,
        e.clientY - rect.top,
      );
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, [aplicarZoom]);

  /* ---------- arrastar para navegar ---------- */
  const arraste = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (lupa || e.button !== 0) return;
    const host = scrollRef.current;
    if (!host) return;
    arraste.current = { x: e.clientX, y: e.clientY, sl: host.scrollLeft, st: host.scrollTop };
    host.setPointerCapture(e.pointerId);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    arraste.current = null;
    scrollRef.current?.releasePointerCapture?.(e.pointerId);
  };

  /* ---------- lupa ---------- */
  const onPointerMove = (e: React.PointerEvent) => {
    const host = scrollRef.current;
    if (!host) return;

    if (arraste.current) {
      host.scrollLeft = arraste.current.sl - (e.clientX - arraste.current.x);
      host.scrollTop = arraste.current.st - (e.clientY - arraste.current.y);
      return;
    }
    if (!lupa) return;

    const alvo = (e.target as HTMLElement).closest("img[data-pdf-page]") as HTMLImageElement | null;
    if (!alvo) {
      setLente(null);
      return;
    }
    const imgRect = alvo.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const relX = (e.clientX - imgRect.left) / imgRect.width;
    const relY = (e.clientY - imgRect.top) / imgRect.height;
    const bgW = imgRect.width * LENTE_FATOR;
    const bgH = imgRect.height * LENTE_FATOR;
    setLente({
      x: e.clientX - hostRect.left,
      y: e.clientY - hostRect.top,
      src: alvo.src,
      bgX: LENTE_PX / 2 - relX * bgW,
      bgY: LENTE_PX / 2 - relY * bgH,
      bgW,
      bgH,
    });
  };

  const onDoubleClick = () => {
    if (lupa) return;
    if (zoom > 1.6) ajustarLargura();
    else aplicarZoom(2);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {carregando
            ? "Processando arquivo…"
            : totalPaginas > MAX_PAGINAS
              ? `Exibindo ${MAX_PAGINAS} de ${totalPaginas} páginas`
              : `${totalPaginas} página${totalPaginas === 1 ? "" : "s"}`}
          {!carregando && <span className="ml-2 hidden sm:inline">· Ctrl + roda para ampliar · arraste para mover</span>}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant={lupa ? "default" : "outline"}
            size="icon"
            className="h-7 w-7"
            title="Lupa"
            onClick={() => {
              setLupa((v) => !v);
              setLente(null);
            }}
          >
            <Search className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" title="Ajustar à largura" onClick={ajustarLargura}>
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" title="Girar 90°" onClick={() => setRotacao((r) => (r + 90) % 360)}>
            <RotateCw className="h-3.5 w-3.5" />
          </Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button variant="outline" size="icon" className="h-7 w-7" title="Reduzir" onClick={() => aplicarZoom(zoom - 0.2)}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="w-11 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="icon" className="h-7 w-7" title="Ampliar" onClick={() => aplicarZoom(zoom + 0.2)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" title="Restaurar zoom" onClick={() => setZoom(1)}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setLente(null)}
        onDoubleClick={onDoubleClick}
        className={cn(
          "relative max-h-[76vh] overflow-auto rounded-md border bg-muted p-3",
          lupa ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
        )}
      >
        {carregando && paginas.length === 0 && (
          <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando nota…
          </div>
        )}

        {paginas.map((p, i) => (
          <img
            key={`${i}-${p.src.length}`}
            data-pdf-page={i + 1}
            src={p.src}
            alt={`${nome} — página ${i + 1}`}
            draggable={false}
            style={{ width: p.largura * zoom, height: p.altura * zoom }}
            className="mx-auto mb-3 max-w-none select-none rounded border bg-white shadow-sm"
          />
        ))}

        {lupa && lente && (
          <div
            className="pointer-events-none absolute z-20 rounded-full border-2 border-primary shadow-lg"
            style={{
              width: LENTE_PX,
              height: LENTE_PX,
              left: lente.x - LENTE_PX / 2,
              top: lente.y - LENTE_PX / 2,
              backgroundImage: `url(${lente.src})`,
              backgroundRepeat: "no-repeat",
              backgroundColor: "#fff",
              backgroundSize: `${lente.bgW}px ${lente.bgH}px`,
              backgroundPosition: `${lente.bgX}px ${lente.bgY}px`,
            }}
          />
        )}
      </div>
    </div>
  );
}

export function VisualizadorArquivoDialog({
  arquivo,
  onOpenChange,
}: {
  arquivo: ArquivoVisualizacao | null;
  onOpenChange: (open: boolean) => void;
}) {
  const isPdf = arquivo ? ehArquivoPdf(arquivo.tipo, arquivo.nome, arquivo.url) : false;
  const [erro, setErro] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    setErro(false);
    setBlobUrl((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior);
      return null;
    });
  }, [arquivo?.url]);

  const onBlob = useCallback((b: Blob) => {
    setBlobUrl((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior);
      return URL.createObjectURL(b);
    });
  }, []);

  const onErro = useCallback(() => setErro(true), []);
  const downloadUrl = blobUrl ?? arquivo?.url ?? "#";

  return (
    <Dialog open={!!arquivo} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            <span className="truncate">{arquivo?.nome ?? "Arquivo"}</span>
          </DialogTitle>
        </DialogHeader>

        {arquivo && (
          <>
            {isPdf ? (
              erro ? (
                <div className="flex flex-col items-center gap-2 rounded-md border bg-muted p-10 text-center">
                  <FileText className="h-10 w-10 text-primary" />
                  <p className="text-sm font-medium">{arquivo.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Não foi possível exibir este PDF aqui. Use os botões abaixo para abrir ou baixar o arquivo.
                  </p>
                </div>
              ) : (
                <PdfCanvasViewer key={arquivo.url} url={arquivo.url} nome={arquivo.nome} onErro={onErro} onBlob={onBlob} />
              )
            ) : (
              <div className="overflow-hidden rounded-md border bg-muted">
                <div className="flex max-h-[76vh] items-center justify-center bg-white">
                  <img src={arquivo.url} alt={arquivo.nome} className="max-h-[76vh] w-auto object-contain" />
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-4 w-4" /> Abrir em nova aba
                </a>
              </Button>
              <Button asChild size="sm">
                <a href={downloadUrl} download={arquivo.nome}>
                  <Download className="mr-1 h-4 w-4" /> Baixar arquivo
                </a>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
