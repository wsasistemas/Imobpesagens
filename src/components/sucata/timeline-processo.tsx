import { Check, Clock } from "lucide-react";
import { CLASSE_NUM } from "@/lib/sucata/tipos";
import { formatarDataHora } from "@/lib/sucata/validadores";
import { FASES_V2, MARCOS_FASE, type EstadoFase, type MarcoFase, type NumeroFase } from "@/lib/sucata/fases-v2";
import { vigentes, type EventoRow, type EvidenciaRow } from "@/lib/sucata/evidencias-queries";

function tempoEmAberto(desde: string | null): string {
  if (!desde) return "—";
  const ms = Date.now() - new Date(desde).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))} min`;
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} dias`;
}

type Cumprimento = { em: string; por: string | null } | null;

function eventoValido(e: EventoRow): boolean {
  const payload = e.payload as { envio?: string } | null;
  return payload?.envio !== "FALHA";
}

/** Primeiro registro que cumpre o marco: evento da auditoria ou foto vigente. */
function cumprimentoDoMarco(m: MarcoFase, eventos: EventoRow[], fotos: EvidenciaRow[]): Cumprimento {
  const ev = m.acoes ? eventos.find((e) => m.acoes!.includes(e.acao) && eventoValido(e)) : undefined;
  if (ev) return { em: ev.created_at, por: ev.usuario_nome ?? ev.usuario_email ?? null };
  if (m.posicao !== undefined) {
    const foto = fotos.find((f) => f.posicao === m.posicao);
    if (foto) return { em: foto.capturado_em, por: null };
  }
  return null;
}

export function TimelineProcesso({
  eventos,
  evidencias,
  estados,
}: {
  eventos: EventoRow[];
  evidencias: EvidenciaRow[];
  estados: Record<NumeroFase, EstadoFase>;
}) {
  const ordenados = [...eventos].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const fotos = vigentes(evidencias);

  const ultimoCumprido = ordenados.length > 0 ? ordenados[ordenados.length - 1]!.created_at : null;

  return (
    <ol className="relative space-y-4 border-l pl-5">
      {FASES_V2.map((f) => {
        const estado = estados[f.numero];
        const feito = estado === "concluida";
        const atual = estado === "atual";
        const marcos = MARCOS_FASE[f.numero].map((m) => ({ marco: m, ok: cumprimentoDoMarco(m, ordenados, fotos) }));
        return (
          <li key={f.numero} className="relative">
            <span
              className={`absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full border ${
                feito
                  ? "border-success/30 bg-success-soft text-success"
                  : atual
                    ? "border-warning/30 bg-warning-soft text-warning"
                    : "border-muted bg-muted text-muted-foreground"
              }`}
            >
              {feito ? <Check className="h-3 w-3" /> : atual ? <Clock className="h-3 w-3" /> : null}
            </span>
            <div
              className={`rounded-md border p-2 text-sm ${
                atual ? "border-warning/30 bg-warning-soft" : feito ? "bg-background" : "bg-muted/30"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`font-semibold ${CLASSE_NUM}`}>FASE {f.numero}</span>
                <span className={feito || atual ? "font-medium" : "text-muted-foreground"}>{f.nome}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {feito ? "Concluída" : atual ? "Em andamento" : "Aguardando"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">{f.responsavel}</div>

              <ul className="mt-2 space-y-1">
                {marcos.map(({ marco, ok }) => (
                  <li key={marco.chave} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span
                      className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center self-center rounded-full border ${
                        ok
                          ? "border-success/30 bg-success-soft text-success"
                          : "border-muted bg-muted text-muted-foreground"
                      }`}
                    >
                      {ok && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span className={ok ? "" : "text-muted-foreground"}>{marco.nome}</span>
                    {ok && (
                      <span className="text-muted-foreground">
                        <span className={CLASSE_NUM}>{formatarDataHora(ok.em)}</span>
                        {ok.por ? ` · ${ok.por}` : ""}
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              {atual && (
                <div className="mt-2 text-xs font-medium text-warning">
                  Em aberto há {tempoEmAberto(ultimoCumprido)}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
