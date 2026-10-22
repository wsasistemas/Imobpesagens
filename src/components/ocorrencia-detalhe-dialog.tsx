import { AlertTriangle, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { montarPayloadOcorrencia } from "@/lib/ocorrencia";
import type { PesagemComEvidencias } from "@/lib/pesagem-store";

const STATUS_ALERTA: Record<string, { rotulo: string; classe: string }> = {
  pendente: { rotulo: "Pendente", classe: "bg-warning hover:bg-warning" },
  enviado: { rotulo: "Enviado", classe: "bg-info hover:bg-info" },
  entregue: { rotulo: "Entregue", classe: "bg-success hover:bg-success" },
  lido: { rotulo: "Lido", classe: "bg-success/90 hover:bg-success/90" },
  falhou: { rotulo: "Falhou", classe: "bg-primary hover:bg-primary" },
};

/** Status do alerta WhatsApp (Meta) enviado ao engenheiro responsável. */
function BlocoAlertaWhatsApp({ pesagemId }: { pesagemId: string }) {
  const { data: alerta } = useQuery({
    queryKey: ["whatsapp-alerta", pesagemId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data } = await db
        .from("whatsapp_alertas")
        .select("status, telefone, destinatario_nome, created_at, erro_detalhe")
        .eq("pesagem_id", pesagemId)
        .eq("tipo_alerta", "alerta_tolerancia_acima")
        .maybeSingle();
      return data as {
        status: string;
        telefone: string | null;
        destinatario_nome: string | null;
        created_at: string;
        erro_detalhe: string | null;
      } | null;
    },
  });

  if (!alerta) return null;
  const st = STATUS_ALERTA[alerta.status] ?? { rotulo: alerta.status, classe: "bg-muted" };

  return (
    <div className="rounded-md border bg-muted/30 p-3 text-xs">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="h-4 w-4 text-primary" />
        Alerta WhatsApp
        <Badge className={st.classe}>{st.rotulo}</Badge>
      </div>
      <div className="grid gap-0.5 text-muted-foreground">
        <span>
          Destinatário: {alerta.destinatario_nome ?? "—"}{" "}
          {alerta.telefone ? <span className="font-mono">({alerta.telefone})</span> : null}
        </span>
        <span>Registrado em: {new Date(alerta.created_at).toLocaleString("pt-BR")}</span>
        {alerta.erro_detalhe && <span className="text-primary">Motivo: {alerta.erro_detalhe}</span>}
      </div>
    </div>
  );
}


type PesagemOcorr = PesagemComEvidencias & {
  ocorrencia_tipo?: string | null;
  ocorrencia_tipo_outro?: string | null;
  ocorrencia_relato?: string | null;
  ocorrencia_em?: string | null;
  ocorrencia_por?: string | null;
  ocorrencia_saida_tipo?: string | null;
  ocorrencia_saida_tipo_outro?: string | null;
  ocorrencia_saida_relato?: string | null;
  ocorrencia_saida_em?: string | null;
  ocorrencia_saida_por?: string | null;
};

type Estagio = {
  key: "entrada" | "saida";
  label: string;
  tipoResolvido: string;
  relato: string;
  em: string | null | undefined;
  autorId: string | null | undefined;
};

export function estagiosOcorrencia(p: PesagemComEvidencias): Estagio[] {
  const pAny = p as PesagemOcorr;
  const out: Estagio[] = [];
  if (pAny.ocorrencia_tipo || pAny.ocorrencia_relato) {
    out.push({
      key: "entrada",
      label: "ENTRADA",
      tipoResolvido:
        pAny.ocorrencia_tipo === "Outro"
          ? (pAny.ocorrencia_tipo_outro ?? "Outro")
          : (pAny.ocorrencia_tipo ?? "—"),
      relato: pAny.ocorrencia_relato ?? "",
      em: pAny.ocorrencia_em,
      autorId: pAny.ocorrencia_por,
    });
  }
  if (pAny.ocorrencia_saida_tipo || pAny.ocorrencia_saida_relato) {
    out.push({
      key: "saida",
      label: "SAÍDA",
      tipoResolvido:
        pAny.ocorrencia_saida_tipo === "Outro"
          ? (pAny.ocorrencia_saida_tipo_outro ?? "Outro")
          : (pAny.ocorrencia_saida_tipo ?? "—"),
      relato: pAny.ocorrencia_saida_relato ?? "",
      em: pAny.ocorrencia_saida_em,
      autorId: pAny.ocorrencia_saida_por,
    });
  }
  return out;
}

export function OcorrenciaDetalheDialog({
  open,
  onOpenChange,
  pesagem,
  obraNome,
  emailMap,
  urlMap,
  estagioInicial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pesagem: PesagemComEvidencias | null;
  obraNome?: string | null;
  emailMap: Record<string, string>;
  urlMap: Record<string, string>;
  estagioInicial?: "entrada" | "saida";
}) {
  const p = pesagem;
  const estagios = p ? estagiosOcorrencia(p) : [];
  const remetenteEmail = "Portal de Pesagem <nao-responda@imobsystems.com.br>";
  const fotos = (p?.evidencias ?? []).filter((e) => e.tipo !== "nota");

  const renderEstagio = (est: Estagio) => {
    if (!p) return null;
    const autorEmail = est.autorId ? (emailMap[est.autorId] ?? null) : null;
    const perfilAutor = autorEmail
      ? { id: est.autorId ?? "", nome: null, cargo: null, setor: null, telefone: null, email: autorEmail }
      : null;
    const payload = montarPayloadOcorrencia({
      tipo: est.tipoResolvido,
      relato: est.relato,
      numeroNota: p.numero_nota,
      placa: p.placa,
      emissor: p.emissor,
      contratante: p.contratante,
      obraNome: obraNome ?? null,
      pesoNfKg: p.peso_nf != null ? Number(p.peso_nf) : null,
      pesoLiquidoKg:
        p.peso_liquido != null
          ? Number(p.peso_liquido)
          : p.peso_entrada != null && p.peso_saida != null
            ? Math.abs(Number(p.peso_entrada) - Number(p.peso_saida))
            : null,
      perfil: perfilAutor,
    });
    const dataOcorr = est.em ? new Date(est.em).toLocaleString("pt-BR") : "—";
    return (
      <div className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="grid grid-cols-[80px_1fr] gap-y-1">
            <span className="font-semibold text-muted-foreground">De:</span>
            <span className="truncate">{remetenteEmail}</span>
            <span className="font-semibold text-muted-foreground">Para:</span>
            <span className="break-words">{payload.para.join(", ")}</span>
            {payload.cc.length > 0 && (
              <>
                <span className="font-semibold text-muted-foreground">Cc:</span>
                <span className="break-words">{payload.cc.join(", ")}</span>
              </>
            )}
            <span className="font-semibold text-muted-foreground">Estágio:</span>
            <span className="font-medium">{est.label}</span>
            <span className="font-semibold text-muted-foreground">Data:</span>
            <span>{dataOcorr}</span>
            <span className="font-semibold text-muted-foreground">Assunto:</span>
            <span className="font-medium">{payload.assunto}</span>
          </div>
        </div>

        <div className="rounded-md border bg-background p-4 text-sm">
          <pre className="whitespace-pre-wrap font-sans leading-relaxed">{payload.corpoTexto}</pre>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Anexos ({fotos.length})
          </div>
          {fotos.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhuma foto anexada.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {fotos.map((e) => {
                const url = urlMap[e.storage_path];
                return (
                  <a
                    key={e.id}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative block overflow-hidden rounded-md border bg-muted"
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={e.nome ?? e.tipo}
                        className="h-32 w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
                        Sem preview
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1 text-[10px] font-medium text-white">
                      {e.nome ?? "foto"}
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Ocorrência registrada
          </DialogTitle>
        </DialogHeader>

        {p && <BlocoAlertaWhatsApp pesagemId={p.id} />}


        {estagios.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Sem detalhes de ocorrência.</div>
        ) : estagios.length === 1 ? (
          renderEstagio(estagios[0])
        ) : (
          <Tabs
            defaultValue={estagioInicial && estagios.some((e) => e.key === estagioInicial) ? estagioInicial : estagios[0].key}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              {estagios.map((est) => (
                <TabsTrigger key={est.key} value={est.key}>
                  {est.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {estagios.map((est) => (
              <TabsContent key={est.key} value={est.key} className="mt-4">
                {renderEstagio(est)}
              </TabsContent>
            ))}
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
