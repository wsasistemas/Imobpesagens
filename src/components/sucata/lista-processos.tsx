import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { processosQueryOptions, tiposSucataQueryOptions } from "@/lib/sucata/sucata-queries";
import { excluirProcessoSucata } from "@/lib/sucata/excluir-processo.functions";
import { CLASSE_NUM } from "@/lib/sucata/tipos";
import { StatusProcesso } from "@/components/sucata/status-badge";
import { formatarDataHora, formatarKg, normalizarPlaca } from "@/lib/sucata/validadores";
import { useAuth } from "@/hooks/useAuth";

const POR_PAGINA = 25;

/**
 * Situação da PESAGEM: quando a saída do caminhão é registrada (bruto aferido),
 * a pesagem está concluída e o registro fica somente leitura para a operação.
 * As etapas administrativas seguintes continuam controladas pela fase do processo.
 */
function situacaoPesagem(p: { situacao: string; saida_em: string | null; bruto_kg: number | null }) {
  if (p.situacao === "BLOQUEADO") return "BLOQUEADO";
  return p.saida_em && p.bruto_kg != null ? "CONCLUIDO" : p.situacao;
}

export function ListaProcessos({ obraId }: { obraId: string | null }) {
  const queryClient = useQueryClient();
  const { isSuperAdmin, isAdmin, isContador } = useAuth();
  const soContabilidade = isContador && !isAdmin && !isSuperAdmin;
  const [pagina, setPagina] = useState(0);
  const [busca, setBusca] = useState("");
  const [motivo, setMotivo] = useState("");
  // A Contabilidade entra já vendo apenas o que espera a emissão da nota.
  const [aguardandoNota, setAguardandoNota] = useState(soContabilidade);
  const [processoAberto, setProcessoAberto] = useState<string | null>(null);
  const { data, isLoading } = useQuery(processosQueryOptions(obraId, pagina, POR_PAGINA));
  const { data: tipos = [] } = useQuery(tiposSucataQueryOptions());
  const linhas = (data?.linhas ?? []).filter((p) => {
    if (aguardandoNota && !(p.nfa_solicitada_em && !p.nfa_numero)) return false;
    const q = busca.trim();
    if (!q) return true;
    const alvo = normalizarPlaca(q);
    return normalizarPlaca(p.placa).includes(alvo) || p.numero.toUpperCase().includes(q.toUpperCase());
  });
  const total = data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
        <CardTitle className="font-heading text-base">Processos de sucata</CardTitle>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button
            type="button"
            size="sm"
            variant={aguardandoNota ? "default" : "outline"}
            onClick={() => setAguardandoNota((v) => !v)}
          >
            Aguardando nota
          </Button>
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por placa ou número"
            className="w-full sm:w-64"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Processo</th>
                <th className="p-2 text-left">Placa</th>
                <th className="p-2 text-left">Entrada</th>
                <th className="p-2 text-left">Saída</th>
                <th className="p-2 text-right">Tara (kg)</th>
                <th className="p-2 text-right">Bruto (kg)</th>
                <th className="p-2 text-right">Aferido (kg)</th>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">Situação</th>
                {isSuperAdmin && <th className="w-14 p-2 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={isSuperAdmin ? 10 : 9} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>
              )}
              {!isLoading && linhas.length === 0 && (
                <tr><td colSpan={isSuperAdmin ? 10 : 9} className="p-4 text-center text-muted-foreground">Nenhum processo registrado.</td></tr>
              )}
              {linhas.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className={`p-2 font-semibold ${CLASSE_NUM}`}>
                    <Link to="/sucata/$id" params={{ id: p.id }} className="text-primary hover:underline">
                      {p.numero}
                    </Link>
                  </td>

                  <td className={`p-2 ${CLASSE_NUM}`}>{p.placa}</td>
                  <td className={`p-2 ${CLASSE_NUM}`}>{formatarDataHora(p.entrada_em)}</td>
                  <td className={`p-2 ${CLASSE_NUM}`}>{p.saida_em ? formatarDataHora(p.saida_em) : "—"}</td>
                  <td className={`p-2 text-right ${CLASSE_NUM}`}>{formatarKg(p.tara_kg)}</td>
                  <td className={`p-2 text-right ${CLASSE_NUM}`}>{formatarKg(p.bruto_kg)}</td>
                  <td className={`p-2 text-right font-semibold ${CLASSE_NUM}`}>{formatarKg(p.peso_aferido_kg)}</td>
                  <td className="p-2">{tipos.find((t) => t.id === p.tipo_sucata_id)?.nome ?? "—"}</td>
                  <td className="p-2"><StatusProcesso situacao={situacaoPesagem(p)} /></td>
                  {isSuperAdmin && (
                    <td className="p-2 text-center">
                      <ExcluirProcessoButton
                        processoId={p.id}
                        numero={p.numero}
                        aberto={processoAberto === p.id}
                        motivo={motivo}
                        onAbertoChange={(aberto) => {
                          setProcessoAberto(aberto ? p.id : null);
                          if (!aberto) setMotivo("");
                        }}
                        onMotivoChange={setMotivo}
                        onExcluido={() => {
                          setProcessoAberto(null);
                          setMotivo("");
                          void queryClient.invalidateQueries({ queryKey: ["sucata"] });
                        }}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            <span className={CLASSE_NUM}>{total}</span> processo(s) — página{" "}
            <span className={CLASSE_NUM}>{pagina + 1}</span> de <span className={CLASSE_NUM}>{paginas}</span>
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
              Anterior
            </Button>
            <Button size="sm" variant="outline" disabled={pagina + 1 >= paginas} onClick={() => setPagina((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExcluirProcessoButton({
  processoId, numero, aberto, motivo, onAbertoChange, onMotivoChange, onExcluido,
}: {
  processoId: string;
  numero: string;
  aberto: boolean;
  motivo: string;
  onAbertoChange: (aberto: boolean) => void;
  onMotivoChange: (motivo: string) => void;
  onExcluido: () => void;
}) {
  const exclusao = useMutation({
    mutationFn: () => excluirProcessoSucata({ data: { processoId, motivo } }),
    onSuccess: () => {
      toast.success(`Processo ${numero} excluído.`);
      onExcluido();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível excluir o processo."),
  });

  return (
    <AlertDialog open={aberto} onOpenChange={onAbertoChange}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Excluir processo ${numero}`} title="Excluir processo">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir o processo {numero}?</AlertDialogTitle>
          <AlertDialogDescription>
            O processo sairá das listagens operacionais. Fotos, documentos e histórico serão preservados para auditoria.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <label htmlFor={`motivo-exclusao-${processoId}`} className="text-sm font-medium">Motivo da exclusão</label>
          <Textarea
            id={`motivo-exclusao-${processoId}`}
            value={motivo}
            onChange={(event) => onMotivoChange(event.target.value)}
            placeholder="Descreva por que este processo deve ser excluído"
            maxLength={500}
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={exclusao.isPending}>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={motivo.trim().length < 5 || exclusao.isPending}
            onClick={() => exclusao.mutate()}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {exclusao.isPending ? "Excluindo..." : "Confirmar exclusão"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
