import { useEffect, useState } from "react";
import { Download, Loader2, Printer, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  /** URL local (blob:) do PDF já baixado — nunca um endereço externo. */
  url: string | null;
  nomeArquivo: string;
  carregando?: boolean;
  erro?: string | null;
  onTentarNovamente?: () => void;
  acaoRotulo?: string;
  onAcao?: () => void;
  acaoCarregando?: boolean;
};

/**
 * Pré-visualização do PDF dentro do próprio sistema.
 * As páginas são desenhadas como imagens (pdfjs-dist), sem depender do plugin
 * de PDF do navegador — que bloqueia iframes com blob: em contexto incorporado.
 */
export function PdfPreviewDialog({
  aberto,
  onFechar,
  titulo,
  url,
  nomeArquivo,
  carregando = false,
  erro = null,
  onTentarNovamente,
  acaoRotulo,
  onAcao,
  acaoCarregando = false,
}: Props) {
  const [paginas, setPaginas] = useState<string[]>([]);
  const [renderizando, setRenderizando] = useState(false);
  const [erroRender, setErroRender] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto || !url) {
      setPaginas([]);
      setErroRender(null);
      return;
    }
    let morto = false;
    setRenderizando(true);
    setErroRender(null);
    setPaginas([]);

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const dados = await resp.arrayBuffer();
        if (morto) return;

        const doc = await pdfjs.getDocument({ data: dados }).promise;
        const saida: string[] = [];
        for (let i = 1; i <= doc.numPages; i += 1) {
          if (morto) return;
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (morto) return;
          saida.push(canvas.toDataURL("image/jpeg", 0.92));
          setPaginas([...saida]);
        }
        if (!morto) setRenderizando(false);
      } catch (e) {
        console.error("[sucata] falha ao exibir o relatório emitido", e);
        if (!morto) {
          setRenderizando(false);
          setErroRender("Não foi possível exibir o arquivo aqui. Use o botão Baixar para abrir o arquivo emitido.");
        }
      }
    })();

    return () => {
      morto = true;
    };
  }, [aberto, url]);

  const imprimir = () => {
    if (paginas.length === 0) return;
    const area = document.createElement("div");
    area.id = "area-impressao-relatorio";
    area.innerHTML = paginas
      .map((src) => `<img src="${src}" style="width:210mm;height:297mm;display:block;page-break-after:always" />`)
      .join("");
    document.body.appendChild(area);
    document.body.classList.add("imprimindo-relatorio");
    const limpar = () => {
      document.body.classList.remove("imprimindo-relatorio");
      area.remove();
      window.removeEventListener("afterprint", limpar);
    };
    window.addEventListener("afterprint", limpar);
    window.print();
    setTimeout(limpar, 60000);
  };

  const ocupado = carregando || (renderizando && paginas.length === 0);
  const falha = erro ?? erroRender;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-5xl">
        <style>{`
          @media print {
            body.imprimindo-relatorio > *:not(#area-impressao-relatorio) { display: none !important; }
            body.imprimindo-relatorio #area-impressao-relatorio { display: block !important; }
            @page { size: A4; margin: 0; }
          }
          #area-impressao-relatorio { display: none; }
        `}</style>

        <DialogHeader>
          <DialogTitle className="font-heading text-base">{titulo}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] w-full overflow-auto rounded-md border bg-muted/30 p-3">
          {ocupado && (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando o arquivo emitido...
            </div>
          )}
          {!ocupado && falha && (
            <div className="flex h-40 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">{falha}</p>
              {onTentarNovamente && (
                <Button variant="outline" onClick={onTentarNovamente}>
                  Tentar novamente
                </Button>
              )}
            </div>
          )}
          {paginas.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`${titulo} — página ${i + 1}`}
              className="mx-auto mb-3 w-full max-w-[820px] rounded border bg-white shadow-sm"
            />
          ))}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {url && !falha && (
            <>
              <Button variant="outline" asChild>
                <a href={url} download={nomeArquivo}>
                  <Download className="mr-2 h-4 w-4" /> Baixar
                </a>
              </Button>
              <Button
                className="bg-primary hover:bg-primary-dark"
                onClick={imprimir}
                disabled={paginas.length === 0}
              >
                <Printer className="mr-2 h-4 w-4" /> Imprimir
              </Button>
              {acaoRotulo && onAcao && (
                <Button onClick={onAcao} disabled={paginas.length === 0 || acaoCarregando}>
                  {acaoCarregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {acaoRotulo}
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
