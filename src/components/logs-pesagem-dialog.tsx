import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Loader2, LogIn, LogOut, AlertTriangle, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { listarLogsPesagem } from "@/lib/admin.functions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pesagemId: string | null;
  rotulo?: string;
};

const ROTULOS_CAMPO: Record<string, string> = {
  numero_nota: "Nº da nota",
  emissor: "Emissor",
  contratante: "Contratante",
  chave_nfe: "Chave NF-e",
  descricao: "Descrição",
  placa: "Placa",
  transportadora: "Transportadora",
  motorista: "Motorista",
  modelo: "Modelo",
  marca: "Marca",
  carreta: "Carreta",
  uf: "UF",
  valor_total_nf: "Valor total da NF",
  qtd_total: "Quantidade total",
  peso_nf: "Peso da NF (kg)",
  peso_entrada: "Peso de entrada (kg)",
  peso_saida: "Peso de saída (kg)",
  itens_nf: "Itens da NF",
  traco_id: "Carta de traço",
  peso_esperado: "Peso carta traço (kg)",
  tolerancia_aplicada: "Tolerância (%)",
  volume_m3: "Volume (m³)",
  diferenca_kg: "Diferença (kg)",
  diferenca_pct: "Diferença (%)",
  status_afericao: "Status da aferição",
  status: "Status",
  traco_confirmado_manual: "Traço confirmado manualmente",
  fornecedor_confirmado_manual: "Fornecedor confirmado manualmente",
};

const EVENTOS: Record<string, { titulo: string; classe: string; Icone: typeof LogIn }> = {
  entrada: { titulo: "Entrada salva", classe: "border-success text-success", Icone: LogIn },
  saida: { titulo: "Saída registrada", classe: "border-primary text-primary", Icone: LogOut },
  ocorrencia: { titulo: "Ocorrência", classe: "border-warning text-warning", Icone: AlertTriangle },
  edicao: { titulo: "Edição", classe: "border-destructive text-destructive", Icone: Pencil },
};

function formatarValor(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "number") return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}

export function LogsPesagemDialog({ open, onOpenChange, pesagemId, rotulo }: Props) {
  const buscarLogs = useServerFn(listarLogsPesagem);
  const { data: logs, isLoading } = useQuery({
    queryKey: ["pesagem-logs", pesagemId],
    queryFn: () => buscarLogs({ data: { pesagem_id: pesagemId as string } }),
    enabled: open && !!pesagemId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Logs do registro
          </DialogTitle>
          <DialogDescription className="text-xs">
            {rotulo ? `${rotulo} · ` : ""}Histórico de fases e alterações, do mais recente ao mais antigo.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum log registrado para este registro.
          </div>
        ) : (
          <ol className="relative space-y-3 border-l border-border pl-5">
            {logs.map((l) => {
              const ev = EVENTOS[l.evento] ?? {
                titulo: l.evento,
                classe: "border-muted-foreground text-muted-foreground",
                Icone: History,
              };
              const { Icone } = ev;
              return (
                <li key={l.id} className="relative rounded-lg border bg-card p-3">
                  <span className="absolute -left-[27px] top-4 flex h-4 w-4 items-center justify-center rounded-full border bg-background">
                    <Icone className="h-2.5 w-2.5" />
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={`h-5 text-[10px] font-bold uppercase ${ev.classe}`}>
                      {ev.titulo}
                    </Badge>
                    <span className="text-xs font-medium">{l.usuario_nome || l.usuario_email || "—"}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {l.justificativa && (
                    <p className="mt-2 rounded-md bg-muted/50 p-2 text-xs italic">“{l.justificativa}”</p>
                  )}
                  {Array.isArray(l.alteracoes) && l.alteracoes.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {l.alteracoes.map((a, i) => (
                        <li key={`${l.id}-${i}`} className="text-[11px] leading-relaxed">
                          <span className="font-semibold">{ROTULOS_CAMPO[a.campo] ?? a.campo}:</span>{" "}
                          <span className="text-muted-foreground line-through">{formatarValor(a.de)}</span>
                          <span className="mx-1">→</span>
                          <span className="text-foreground">{formatarValor(a.para)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
