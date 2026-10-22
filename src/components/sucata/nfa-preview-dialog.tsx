// Pré-visualização da Nota Fiscal Avulsa no modelo oficial, com as ações de
// baixar o PDF e confirmar o envio ao administrativo/engenheiro da obra.
import { useRef } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { confirmarPreviewNfa } from "@/lib/sucata/nfa.functions";
import { gerarPdfNfa } from "@/lib/sucata/nfa-pdf";
import { NfaFolha, type CamposFolha } from "./nfa-folha";

const ID_FOLHA_PREVIEW = "nfa-folha-preview";
const ID_FOLHA_PDF = "nfa-folha-pdf";

type Props = {
  aberto: boolean;
  onFechar: () => void;
  processoId: string;
  processo: string;
  campos: CamposFolha;
  cfop: string;
  natureza: string;
  numero: string;
  emissao: string;
  podeConfirmar: boolean;
  /** Nota já emitida: a janela é apenas de consulta, sem ação de emitir. */
  somenteLeitura?: boolean;
  onConfirmado?: () => void;
};

export function NfaPreviewDialog({
  aberto,
  onFechar,
  processoId,
  processo,
  campos,
  cfop,
  natureza,
  numero,
  emissao,
  podeConfirmar,
  somenteLeitura = false,
  onConfirmado,
}: Props) {
  const confirmar = useServerFn(confirmarPreviewNfa);
  const ocupado = useRef(false);

  const baixar = useMutation({
    mutationFn: async () => {
      const { salvar } = await gerarPdfNfa(ID_FOLHA_PDF);
      salvar(`NFA-${numero || "00001"}-${processo.replace(/\W+/g, "-")}.pdf`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível gerar o PDF."),
  });

  const enviar = useMutation({
    mutationFn: async () => {
      if (ocupado.current) return null;
      ocupado.current = true;
      try {
        const { base64 } = await gerarPdfNfa(ID_FOLHA_PDF);
        return await confirmar({ data: { processoId, numero: numero.trim(), emissao, pdfBase64: base64 } });
      } finally {
        ocupado.current = false;
      }
    },
    onSuccess: (r) => {
      if (!r) return;
      if (r.emails.length > 0) toast.success(`Nota enviada para ${r.emails.join(", ")}.`);
      else toast.warning("A nota foi guardada no processo, mas nenhum e-mail saiu.");
      for (const aviso of r.avisos) toast.warning(aviso);
      onConfirmado?.();
      onFechar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível confirmar a nota."),
  });

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[92vh] max-w-[calc(210mm+4rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {somenteLeitura ? "Nota Fiscal Avulsa emitida" : "Pré-visualização da Nota Fiscal Avulsa"}
          </DialogTitle>
          <DialogDescription>
            {somenteLeitura
              ? "Nota já emitida — esta janela é apenas de consulta. Use Baixar PDF para guardar uma via."
              : "Confira a nota no modelo oficial. Ao confirmar, o PDF é guardado no processo (documento 012), enviado por e-mail ao administrativo e ao engenheiro da obra e entra no relatório fotográfico."}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-lg border bg-white p-2">
          <NfaFolha
            idFolha={ID_FOLHA_PREVIEW}
            campos={campos}
            cfop={cfop}
            natureza={natureza}
            numero={numero}
            emissao={emissao}
            processo={processo}
          />
        </div>

        {typeof document !== "undefined" &&
          createPortal(
            // Folha técnica fora da vista: mantém largura A4 real (sem transform
            // nem viewport artificial) para a captura sair igual à da tela.
            <div
              aria-hidden
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "210mm",
                height: "297mm",
                overflow: "hidden",
                background: "#ffffff",
                opacity: 0,
                pointerEvents: "none",
                zIndex: -1,
              }}
            >
              <NfaFolha
                idFolha={ID_FOLHA_PDF}
                campos={campos}
                cfop={cfop}
                natureza={natureza}
                numero={numero}
                emissao={emissao}
                processo={processo}
              />
            </div>,
            document.body,
          )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onFechar}>
            Fechar
          </Button>
          <Button variant="outline" onClick={() => baixar.mutate()} disabled={baixar.isPending}>
            {baixar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Baixar PDF
          </Button>
          {!somenteLeitura && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={!podeConfirmar || enviar.isPending}>
                  {enviar.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Emitir definitivamente
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-heading">Emitir a Nota Fiscal Avulsa?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A emissão é irreversível. A nota será registrada no processo e enviada por e-mail aos coordenadores
                    e ao administrativo da obra. Uma nova nota desta venda só será possível se esta emissão for
                    cancelada e a emissão do mesmo processo de venda for reaberta.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => enviar.mutate()}>Emitir definitivamente</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
