// Cliente: monta as fotos do relatório fotográfico (com preview da nota em PDF) e gera o PDF A4.
import { POSICOES_EVIDENCIA } from "@/lib/sucata/posicoes-evidencia";
import { urlAssinada, type EvidenciaRow } from "@/lib/sucata/evidencias-queries";
import type { FotoRelatorio } from "@/components/sucata/relatorio-fotografico";

/** Baixa o arquivo assinado e converte para base64, para o canvas do PDF não falhar. */
async function blobParaBase64(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("falha ao ler o arquivo"));
    fr.readAsDataURL(blob);
  });
}

/** Primeira página de um PDF como imagem JPEG (base64), com a mesma biblioteca do visualizador de notas. */
async function primeiraPaginaPdf(dados: ArrayBuffer): Promise<string | null> {
  try {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const doc = await pdfjs.getDocument({ data: dados }).promise;
    const page = await doc.getPage(1);
    // Renderiza a página A4 inteira na proporção original. A imagem entra no
    // relatório com object-contain, sem cortar ou esticar a nota definitiva.
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch (erro) {
    console.error("[sucata] falha ao gerar a prévia do PDF", erro);
    return null;
  }
}

function ehPdf(path: string, blob: Blob): boolean {
  return blob.type === "application/pdf" || /\.pdf$/i.test(path);
}

/** Converte uma evidência (imagem ou PDF) em imagem base64 para o relatório. */
export async function imagemDaEvidencia(storagePath: string): Promise<string | null> {
  try {
    const assinada = await urlAssinada(storagePath, 900);
    if (!assinada) { console.warn("[sucata] sem URL assinada", storagePath); return null; }
    const resp = await fetch(assinada);
    if (!resp.ok) { console.warn("[sucata] download falhou", storagePath, resp.status); return null; }
    const blob = await resp.blob();
    if (ehPdf(storagePath, blob)) return await primeiraPaginaPdf(await blob.arrayBuffer());
    return await blobParaBase64(blob);
  } catch (erro) {
    console.error("[sucata] falha ao ler a evidência", storagePath, erro);
    return null;
  }
}

/** Lista de fotos do relatório na ordem do catálogo, já em base64. */
export async function carregarFotosRelatorio(vigentesDoProcesso: EvidenciaRow[]): Promise<FotoRelatorio[]> {
  const lista: FotoRelatorio[] = [];
  for (const p of POSICOES_EVIDENCIA) {
    const ev = vigentesDoProcesso.find((e) => e.posicao === p.posicao);
    const url = ev ? await imagemDaEvidencia(ev.storage_path) : null;
    lista.push({ posicao: p.posicao, rotulo: p.rotulo, url });
  }
  return lista;
}

/** Aguarda as imagens das páginas terminarem de carregar antes de capturar o canvas. */
export async function aguardarImagens(idBase: string, totalPaginas: number): Promise<void> {
  const imgs: HTMLImageElement[] = [];
  for (let i = 1; i <= totalPaginas; i += 1) {
    const el = document.getElementById(`${idBase}-${i}`);
    if (el) imgs.push(...Array.from(el.querySelectorAll("img")));
  }
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );
}

/** Gera o PDF A4 a partir das páginas já renderizadas na tela (visíveis ou fora da área visível). */
export async function gerarPdfRelatorio(idBase: string, numero: string, totalPaginas: number): Promise<string> {
  await aguardarImagens(idBase, totalPaginas);
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  for (let i = 1; i <= totalPaginas; i += 1) {
    const el = document.getElementById(`${idBase}-${i}`);
    if (!el) throw new Error("Pré-visualização indisponível. Recarregue a tela.");
    await document.fonts?.ready;
    await aguardarImagensDoElemento(el);
    const nota = el.querySelector<HTMLImageElement>("img[data-relatorio-nfa='true']");
    if (nota && (!nota.complete || nota.naturalWidth < 700 || nota.naturalHeight < 990)) {
      throw new Error("A Nota Fiscal Avulsa não ficou pronta em A4. Aguarde e tente novamente.");
    }
    // Captura a folha A4 dedicada já renderizada em tamanho real. Não clonamos
    // o DOM: a clonagem foi a origem da perda de estilos no arquivo emitido.
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      width: el.offsetWidth,
      height: el.offsetHeight,
      scrollX: 0,
      scrollY: 0,
    });
    const img = canvas.toDataURL("image/jpeg", 0.9);
    if (i > 1) pdf.addPage();
    pdf.addImage(img, "JPEG", 0, 0, 210, 297, `p${i}`, "FAST");
  }
  pdf.setProperties({ title: `Relatório fotográfico ${numero}` });
  const saida = pdf.output("datauristring");
  return saida.split(",")[1] ?? "";
}

async function aguardarImagensDoElemento(elemento: HTMLElement): Promise<void> {
  const imagens = Array.from(elemento.querySelectorAll("img"));
  await Promise.all(
    imagens.map(
      (imagem) =>
        new Promise<void>((resolve, reject) => {
          if (imagem.complete && imagem.naturalWidth > 0) return resolve();
          imagem.onload = () => resolve();
          imagem.onerror = () => reject(new Error("Uma imagem do relatório não pôde ser carregada."));
        }),
    ),
  );
}

/**
 * Converte a folha oficial da NFA em imagem. Caminho único, compartilhado com a
 * emissão da nota e com a evidência 012 — ver `nfa-pdf.ts`.
 */
export { imagemDaFolhaNfa } from "@/lib/sucata/nfa-pdf";

/** Nome exibido do usuário para o campo Relator. */

export function nomeRelator(user: { email?: string; user_metadata?: unknown } | null | undefined): string {
  const meta = (user?.user_metadata ?? {}) as { display_name?: string; full_name?: string };
  return meta.display_name ?? meta.full_name ?? user?.email ?? "—";
}
