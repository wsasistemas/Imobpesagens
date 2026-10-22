// Cliente: gera a Nota Fiscal Avulsa diretamente da folha A4 isolada.
// A folha técnica não fica dentro do diálogo, evitando que transformações,
// rolagem e largura da janela alterem a captura.
//
// A conversão da folha em imagem é feita SOMENTE por esta função, usada pela
// emissão da nota, pela evidência 012 e pelo relatório fotográfico — para os
// três saírem sempre idênticos.

const LARGURA_A4_PX = 794;
const ALTURA_A4_PX = 1123;
const PROPORCAO_A4 = LARGURA_A4_PX / ALTURA_A4_PX;

async function aguardarFolha(idFolha: string): Promise<HTMLElement> {
  for (let tentativa = 0; tentativa < 60; tentativa += 1) {
    const folha = document.getElementById(idFolha);
    if (folha) return folha;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Não foi possível montar a folha A4. Tente novamente.");
}

async function aguardarRecursos(folha: HTMLElement): Promise<void> {
  const imagens = Array.from(folha.querySelectorAll("img"));
  await Promise.all(
    imagens.map(
      (imagem) =>
        new Promise<void>((resolve) => {
          if (imagem.complete && imagem.naturalWidth > 0) return resolve();
          imagem.onload = () => resolve();
          imagem.onerror = () => resolve();
        }),
    ),
  );
  await document.fonts?.ready;
}

async function validarImagemA4(src: string): Promise<void> {
  const imagem = new Image();
  await new Promise<void>((resolve, reject) => {
    imagem.onload = () => resolve();
    imagem.onerror = () => reject(new Error("A imagem da Nota Fiscal Avulsa não pôde ser validada."));
    imagem.src = src;
  });
  if (imagem.naturalWidth < LARGURA_A4_PX || imagem.naturalHeight < ALTURA_A4_PX) {
    throw new Error("A imagem da Nota Fiscal Avulsa foi gerada abaixo do tamanho A4 esperado.");
  }
  const proporcao = imagem.naturalWidth / imagem.naturalHeight;
  if (Math.abs(proporcao - PROPORCAO_A4) > 0.015) {
    throw new Error("A imagem da Nota Fiscal Avulsa não está na proporção A4.");
  }
}

/** Caminho único de captura da folha da nota: PNG em tamanho real da folha A4. */
export async function imagemDaFolhaNfa(idFolha: string): Promise<string | null> {
  try {
    const folha = await aguardarFolha(idFolha);
    await aguardarRecursos(folha);
    const largura = folha.offsetWidth || LARGURA_A4_PX;
    const altura = folha.offsetHeight || ALTURA_A4_PX;
    const { toPng } = await import("html-to-image");
    const png = await toPng(folha, {
      backgroundColor: "#ffffff",
      cacheBust: true,
      pixelRatio: 2,
      width: largura,
      height: altura,
      style: { transform: "none", margin: "0" },
    });
    await validarImagemA4(png);
    return png;
  } catch (erro) {
    console.error("[sucata] falha ao converter a nota em imagem", erro);
    return null;
  }
}

export type PdfNfaGerado = {
  base64: string;
  blob: Blob;
  salvar: (nome: string) => void;
};

/** Gera o PDF A4 usando a mesma NfaFolha da prévia, sem depender do viewport. */
export async function gerarPdfNfa(idFolha: string): Promise<PdfNfaGerado> {
  const imagem = await imagemDaFolhaNfa(idFolha);
  if (!imagem) throw new Error("Não foi possível desenhar a nota. Tente novamente.");

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  pdf.addImage(imagem, "PNG", 0, 0, 210, 297, "nfa", "FAST");
  pdf.setProperties({ title: "Nota Fiscal Avulsa" });

  const dataUri = pdf.output("datauristring");
  const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
  return {
    base64,
    blob: pdf.output("blob"),
    salvar: (nome: string) => pdf.save(nome),
  };
}
