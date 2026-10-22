import { useEffect, useState } from "react";
import { FileWarning, ImageOff } from "lucide-react";
import { CLASSE_NUM } from "@/lib/sucata/tipos";
import { POSICOES_EVIDENCIA, TOTAL_POSICOES, codigoDe } from "@/lib/sucata/posicoes-evidencia";
import { vigentes, type EvidenciaRow } from "@/lib/sucata/evidencias-queries";
import { imagemDaEvidencia } from "@/lib/sucata/relatorio-pdf";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NfaFolha, type CamposFolha } from "@/components/sucata/nfa-folha";

export type NotaEvidencia = {
  campos: CamposFolha;
  cfop: string;
  natureza: string;
  numero: string;
  emissao: string;
  processo: string;
};

export function GradeEvidencias({ evidencias, nota }: { evidencias: EvidenciaRow[]; nota?: NotaEvidencia | null }) {
  const atuais = vigentes(evidencias);
  const feitas = new Map(atuais.map((e) => [e.posicao, e]));

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        <span className={`font-semibold ${CLASSE_NUM}`}>{atuais.length}</span> de{" "}
        <span className={CLASSE_NUM}>{TOTAL_POSICOES}</span> evidências
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {POSICOES_EVIDENCIA.map((p) => {
          const e = feitas.get(p.posicao);
          return (
            <div key={p.posicao} className="overflow-hidden rounded-lg border">
              {e ? (
                p.posicao === 12 && nota ? (
                  <MiniaturaNfa nota={nota} rotulo={`${codigoDe(p.posicao)} — ${p.rotulo}`} />
                ) : (
                  <Miniatura path={e.storage_path} rotulo={`${codigoDe(p.posicao)} — ${p.rotulo}`} />
                )
              ) : (
                <div
                  className="flex h-24 items-center justify-center bg-muted text-muted-foreground"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, rgba(0,0,0,0.06) 0 6px, transparent 6px 12px)",
                  }}
                >
                  <ImageOff className="h-5 w-5" />
                </div>
              )}
              <div className="p-2">
                <div className={`text-xs font-bold ${CLASSE_NUM}`}>{codigoDe(p.posicao)}</div>
                <div className="text-xs leading-tight">{p.rotulo}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A evidência 012 usa a mesma folha oficial da emissão, inclusive para notas antigas. */
function MiniaturaNfa({ nota, rotulo }: { nota: NotaEvidencia; rotulo: string }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setAberto(true)}
        className="relative block h-24 w-full overflow-hidden rounded-none bg-card p-0"
        aria-label={`Visualizar ${rotulo}`}
      >
        <div className="pointer-events-none absolute left-1/2 top-0 h-[1123px] w-[794px] origin-top -translate-x-1/2 scale-[0.085]">
          <NfaFolha
            idFolha="nfa-evidencia-miniatura"
            campos={nota.campos}
            cfop={nota.cfop}
            natureza={nota.natureza}
            numero={nota.numero}
            emissao={nota.emissao}
            processo={nota.processo}
          />
        </div>
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[92vh] max-w-[calc(210mm+4rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-base">{rotulo}</DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto rounded-lg border bg-card p-2">
            <NfaFolha
              idFolha="nfa-evidencia-ampliada"
              campos={nota.campos}
              cfop={nota.cfop}
              natureza={nota.natureza}
              numero={nota.numero}
              emissao={nota.emissao}
              processo={nota.processo}
            />
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setAberto(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Miniatura de qualquer evidência: fotos entram direto e documentos em PDF
 * (como a Nota Fiscal Avulsa) viram a imagem da primeira página. A visualização
 * ampliada abre dentro do sistema, sem endereço externo.
 */
function Miniatura({ path, rotulo }: { path: string; rotulo: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    void imagemDaEvidencia(path)
      .then((u) => {
        if (ativo) setUrl(u);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [path]);

  if (carregando) return <div className="h-24 animate-pulse bg-muted" />;

  if (!url) {
    return (
      <div className="flex h-24 flex-col items-center justify-center gap-1 bg-muted text-muted-foreground">
        <FileWarning className="h-5 w-5" />
        <span className="text-[10px]">Documento sem prévia</span>
      </div>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="block w-full">
        <img src={url} alt={rotulo} loading="lazy" className="h-24 w-full bg-card object-contain" />
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-base">{rotulo}</DialogTitle>
          </DialogHeader>
          <img src={url} alt={rotulo} className="max-h-[75vh] w-full bg-card object-contain" />
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setAberto(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
