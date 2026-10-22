import wsaLogo from "@/assets/wsa-logo.png";
import { POSICOES_EVIDENCIA, codigoDe } from "@/lib/sucata/posicoes-evidencia";
import type { CamposFolha } from "@/components/sucata/nfa-folha";

export type FotoRelatorio = { posicao: number; rotulo: string; url: string | null };

export type NotaRelatorio = {
  campos: CamposFolha;
  cfop: string;
  natureza: string;
  numero: string;
  emissao: string;
  processo: string;
};

export type DadosRelatorio = {
  numero: string;
  obra: string;
  dataColeta: string;
  descricao: string;
  relator: string;
};

const POSICAO_NFA = 12;
const POR_PAGINA = 4;

/**
 * Páginas do relatório: até 4 quadros por página, no padrão do Portal de Pesagem. A última
 * página fica com o comprovante e a Nota Fiscal Avulsa em quadros de largura
 * inteira, para a nota aparecer legível.
 */
const PAGINAS: number[][] = (() => {
  const todas = POSICOES_EVIDENCIA.map((p) => p.posicao);
  const paginas: number[][] = [];
  for (let i = 0; i < todas.length; i += POR_PAGINA) paginas.push(todas.slice(i, i + POR_PAGINA));
  return paginas.length > 0 ? paginas : [[]];
})();

export const TOTAL_PAGINAS_RELATORIO = PAGINAS.length;

/** Documento no padrão do Portal de Pesagem: A4 retrato, cabeçalho tabelado e grade de 2 colunas. */
export function RelatorioFotografico({
  dados,
  fotos,
  nota,
  notaImagem,
  idBase = "relatorio-pagina",
}: {
  dados: DadosRelatorio;
  fotos: FotoRelatorio[];
  nota?: NotaRelatorio | null;
  notaImagem?: string | null;
  idBase?: string;
}) {

  return (
    <div className="relatorio-doc space-y-6 print:space-y-0">
      {PAGINAS.map((posicoes, indice) => (
        <section
          key={indice}
          id={`${idBase}-${indice + 1}`}
          data-relatorio-pagina="a4"
          className="relatorio-pagina mx-auto flex h-[297mm] w-[210mm] flex-col overflow-hidden bg-white p-[10mm] text-[#1f2937]"
        >
          <Cabecalho dados={dados} identificacao={indice === 0} />

          <div className="mt-[3mm] grid grid-cols-2 border-l border-t border-[#111827]">
            {posicoes.map((posicao, coluna) => {
              const sozinho = posicoes.length === 1;
              // Página com poucos quadros: cada um ocupa a largura inteira.
              const largo = posicoes.length <= 2;
              const ehNota = posicao === POSICAO_NFA;
              const altura = sozinho ? "h-[180mm]" : largo ? (ehNota ? "h-[150mm]" : "h-[62mm]") : "h-[62mm]";
              const meta = POSICOES_EVIDENCIA.find((p) => p.posicao === posicao) ?? null;
              const foto = posicao ? (fotos.find((f) => f.posicao === posicao) ?? null) : null;
              return (
                <div
                  key={coluna}
                  className={`border-b border-r border-[#111827] ${sozinho || largo ? "col-span-2" : ""}`}
                >
                  <div
                    className={`flex items-center justify-center overflow-hidden bg-white p-[2mm] ${altura}`}
                  >
                    {!meta ? (
                      <span className="text-[9pt] text-[#9ca3af]">Sem evidência</span>
                    ) : meta.posicao === POSICAO_NFA ? (
                      notaImagem ? (
                        <img
                          src={notaImagem}
                          alt="Nota Fiscal Avulsa emitida"
                          data-relatorio-nfa="true"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-[9pt] text-[#6b7280]">
                          {nota ? "Preparando a Nota Fiscal Avulsa…" : "Nota Fiscal Avulsa indisponível"}
                        </span>
                      )

                    ) : foto?.url ? (
                      <img
                        src={foto.url}
                        alt={`Foto ${codigoDe(meta.posicao)} — ${meta.rotulo}`}
                        className="max-h-full max-w-full object-contain"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <span className="text-[9pt] text-[#6b7280]">Sem foto</span>
                    )}
                  </div>
                  <div className="border-t border-[#111827] px-[2mm] py-[1mm] text-[9pt]">
                    Foto{" "}
                    <span className="[font-variant-numeric:tabular-nums]">
                      {meta ? codigoDe(meta.posicao) : "—"}
                    </span>
                  </div>
                  <div className="h-[9mm] border-t border-[#111827] px-[2mm] py-[1mm] text-[9pt] leading-tight">
                    Descrição: {meta ? `${meta.rotulo}.` : "—"}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-auto pt-[3mm] text-center text-[7pt] text-[#6b7280]">
            Página <span className="[font-variant-numeric:tabular-nums]">{indice + 1}</span> de{" "}
            <span className="[font-variant-numeric:tabular-nums]">{TOTAL_PAGINAS_RELATORIO}</span> — Sistema de
            Pesagem · processo{" "}
            <span className="[font-variant-numeric:tabular-nums]">{dados.numero}</span>
          </div>
        </section>
      ))}
    </div>
  );
}

function Cabecalho({ dados, identificacao }: { dados: DadosRelatorio; identificacao: boolean }) {
  return (
    <header>
      <table className="w-full table-fixed border-collapse text-[9pt]">
        <tbody>
          <tr>
            <td
              rowSpan={2}
              className="w-[52mm] border border-[#111827] p-[2mm] align-middle"
            >
              <img
                src={wsaLogo}
                alt="WSA Sistemas"
                className="mx-auto max-h-[16mm] w-full max-w-[46mm] object-contain"
                crossOrigin="anonymous"
              />
            </td>
            <td className="border border-[#111827] px-[2mm] py-[1mm] align-top">
              <div className="text-[7.5pt] text-[#6b7280]">Tipo de Documento</div>
              <div className="text-[10pt]">MODELO</div>
            </td>
          </tr>
          <tr>
            <td className="border border-[#111827] px-[2mm] py-[1mm] align-top">
              <div className="text-[7.5pt] text-[#6b7280]">Título do Documento</div>
              <div className="text-[10pt]">RELATÓRIO FOTOGRÁFICO</div>
            </td>
          </tr>
        </tbody>
      </table>

      {identificacao && (
        <table className="mt-[3mm] w-full table-fixed border-collapse text-[9pt]">
          <tbody>
            <tr>
              <td className="w-[62%] border border-[#111827] px-[2mm] py-[1mm] align-top">
                <div className="text-[7.5pt] text-[#6b7280]">Origem/Unidade/Obra/Centro de Custo:</div>
                <div className="text-[10pt]">{dados.obra}</div>
              </td>
              <td className="border border-[#111827] px-[2mm] py-[1mm] align-top">
                <div className="text-[7.5pt] text-[#6b7280]">Data:</div>
                <div className="text-[10pt] [font-variant-numeric:tabular-nums]">{dados.dataColeta}</div>
              </td>
            </tr>
            <tr>
              <td className="border border-[#111827] px-[2mm] py-[1mm] align-top">
                <div className="text-[9pt]">Descrição: {dados.descricao}.</div>
              </td>
              <td className="border border-[#111827] px-[2mm] py-[1mm] align-top">
                <div className="text-[7.5pt] text-[#6b7280]">Relator:</div>
                <div className="text-[10pt]">{dados.relator}</div>
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </header>
  );
}
