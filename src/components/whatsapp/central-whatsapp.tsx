import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Send, MessageCircle, Loader2, Check, CheckCheck, Clock, Building2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { enviarWhatsApp } from "@/lib/whatsapp/whatsapp.functions";
import { chaveContatoWhatsApp, soDigitos, variantesContatoWhatsApp } from "@/lib/whatsapp/telefone";

export type Contato = {
  telefone: string;
  nome: string;
  email: string | null;
  origem: "obra" | "usuario" | "conversa";
  detalhe?: string | null;
  obraId?: string | null;
};

type Mensagem = {
  id: string;
  contato_whatsapp: string;
  contato_nome: string | null;
  mensagem: string;
  direcao: string;
  status: string | null;
  created_at: string;
};



function formatarTelefone(raw: string): string {
  const d = soDigitos(raw);
  const base = d.startsWith("55") ? d.slice(2) : d;
  if (base.length === 11) return `(${base.slice(0, 2)}) ${base.slice(2, 7)}-${base.slice(7)}`;
  if (base.length === 10) return `(${base.slice(0, 2)}) ${base.slice(2, 6)}-${base.slice(6)}`;
  return raw;
}

export function CentralWhatsApp() {
  const qc = useQueryClient();
  const enviarFn = useServerFn(enviarWhatsApp);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<Contato | null>(null);
  const [texto, setTexto] = useState("");
  const [novoNumero, setNovoNumero] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);

  // Engenheiros das obras + usuários (coordenadores/admins) com telefone + números já usados
  const { data: contatos = [], isLoading: carregandoContatos } = useQuery({
    queryKey: ["whatsapp-contatos"],
    queryFn: async (): Promise<Contato[]> => {
      const [obras, perfis, conversas] = await Promise.all([
        supabase.from("obras").select("id, nome, engenheiro_nome, engenheiro_email").eq("ativo", true),
        supabase.from("profiles").select("id, nome, email, telefone, cargo"),
        supabase
          .from("whatsapp_mensagens")
          .select("contato_whatsapp, contato_nome, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      const mapa = new Map<string, Contato>();

      for (const p of perfis.data ?? []) {
        if (soDigitos(p.telefone).length < 10) continue;
        const tel = chaveContatoWhatsApp(p.telefone);
        mapa.set(tel, {
          telefone: tel,
          nome: p.nome ?? p.email ?? formatarTelefone(tel),
          email: p.email ?? null,
          origem: "usuario",
          detalhe: p.cargo ?? null,
        });
      }

      for (const o of obras.data ?? []) {
        if (!o.engenheiro_email && !o.engenheiro_nome) continue;
        // O cadastro de obra não guarda telefone: vincula pelo e-mail do engenheiro
        // quando ele também é usuário do portal.
        const porEmail = Array.from(mapa.values()).find(
          (c) => c.email && o.engenheiro_email && c.email.toLowerCase() === o.engenheiro_email.toLowerCase(),
        );
        if (porEmail) {
          mapa.set(porEmail.telefone, {
            ...porEmail,
            origem: "obra",
            detalhe: o.nome,
            obraId: o.id,
            nome: o.engenheiro_nome ?? porEmail.nome,
          });
        }
      }

      for (const m of conversas.data ?? []) {
        const tel = chaveContatoWhatsApp(m.contato_whatsapp);
        if (!tel || mapa.has(tel)) continue;
        mapa.set(tel, {
          telefone: tel,
          nome: m.contato_nome ?? formatarTelefone(tel),
          email: null,
          origem: "conversa",
        });
      }

      return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });

  const { data: mensagens = [], isLoading: carregandoMsgs } = useQuery({
    queryKey: ["whatsapp-mensagens", selecionado?.telefone],
    enabled: !!selecionado,
    refetchInterval: 20_000,
    queryFn: async (): Promise<Mensagem[]> => {
      const { data, error } = await supabase
        .from("whatsapp_mensagens")
        .select("id, contato_whatsapp, contato_nome, mensagem, direcao, status, created_at")
        // Alcança envios antigos gravados sem o 55 e respostas gravadas com o 55.
        .in("contato_whatsapp", variantesContatoWhatsApp(selecionado!.telefone))
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens.length]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return contatos;
    return contatos.filter(
      (c) => c.nome.toLowerCase().includes(t) || c.telefone.includes(soDigitos(t)) || (c.detalhe ?? "").toLowerCase().includes(t),
    );
  }, [contatos, busca]);

  const enviar = useMutation({
    mutationFn: async () =>
      (await enviarFn({
        data: {
          telefone: selecionado!.telefone,
          mensagem: texto.trim(),
          contatoNome: selecionado!.nome,
          ...(selecionado!.email ? { contatoEmail: selecionado!.email } : {}),
          ...(selecionado!.obraId ? { obraId: selecionado!.obraId } : {}),
        },
      })) as { ok: boolean; erro?: string },
    onSuccess: async (r) => {
      if (r.ok) {
        setTexto("");
        toast.success("Mensagem enviada.");
      } else {
        toast.error(r.erro ?? "Falha no envio.");
      }
      await qc.invalidateQueries({ queryKey: ["whatsapp-mensagens"] });
      await qc.invalidateQueries({ queryKey: ["whatsapp-contatos"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha no envio."),
  });

  const iconeStatus = (s: string | null) => {
    if (s === "READ" || s === "lida") return <CheckCheck className="h-3 w-3 text-info" />;
    if (s === "DELIVERED" || s === "entregue") return <CheckCheck className="h-3 w-3" />;
    if (s === "falha") return <Clock className="h-3 w-3 text-destructive" />;
    return <Check className="h-3 w-3" />;
  };

  return (
    <div className="grid h-[calc(100vh-11rem)] grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      <Card className="flex min-h-0 flex-col">
        <div className="border-b p-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar contato" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              placeholder="Novo número (DDD + número)"
              value={novoNumero}
              onChange={(e) => setNovoNumero(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={soDigitos(novoNumero).length < 10}
              onClick={() => {
                const tel = chaveContatoWhatsApp(novoNumero);
                setSelecionado({ telefone: tel, nome: formatarTelefone(tel), email: null, origem: "conversa" });
                setNovoNumero("");
              }}
            >
              Abrir
            </Button>
          </div>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          {carregandoContatos ? (
            <p className="p-4 text-sm text-muted-foreground">Carregando contatos…</p>
          ) : filtrados.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhum contato encontrado.</p>
          ) : (
            filtrados.map((c) => (
              <button
                key={c.telefone}
                onClick={() => setSelecionado(c)}
                className={`flex w-full items-start gap-2 border-b p-3 text-left hover:bg-muted/60 ${
                  selecionado?.telefone === c.telefone ? "bg-muted" : ""
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {c.nome.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.nome}</div>
                  <div className="truncate text-xs text-muted-foreground">{formatarTelefone(c.telefone)}</div>
                  {c.detalhe && (
                    <div className="mt-1 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                      {c.origem === "obra" && <Building2 className="h-3 w-3" />}
                      {c.detalhe}
                    </div>
                  )}
                </div>
                {c.origem === "obra" && <Badge variant="outline" className="text-[10px]">obra</Badge>}
              </button>
            ))
          )}
        </ScrollArea>
      </Card>

      <Card className="flex min-h-0 flex-col">
        {!selecionado ? (
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageCircle className="h-10 w-10" />
            <p className="text-sm">Selecione um contato para conversar.</p>
          </CardContent>
        ) : (
          <>
            <div className="flex items-center justify-between border-b p-3">
              <div>
                <div className="text-sm font-semibold">{selecionado.nome}</div>
                <div className="text-xs text-muted-foreground">{formatarTelefone(selecionado.telefone)}</div>
              </div>
              {selecionado.detalhe && <Badge variant="outline">{selecionado.detalhe}</Badge>}
            </div>
            <ScrollArea className="min-h-0 flex-1 p-4">
              {carregandoMsgs ? (
                <p className="text-sm text-muted-foreground">Carregando conversa…</p>
              ) : mensagens.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma mensagem com este contato.</p>
              ) : (
                <div className="space-y-2">
                  {mensagens.map((m) => (
                    <div key={m.id} className={`flex ${m.direcao === "enviada" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                          m.direcao === "enviada" ? "bg-primary text-white" : "bg-muted"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.mensagem}</p>
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-80">
                          {format(new Date(m.created_at), "dd/MM HH:mm")}
                          {m.direcao === "enviada" && iconeStatus(m.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div ref={fimRef} />
            </ScrollArea>
            <div className="flex items-end gap-2 border-t p-3">
              <Textarea
                rows={2}
                placeholder="Escreva a mensagem"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && texto.trim()) {
                    e.preventDefault();
                    enviar.mutate();
                  }
                }}
              />
              <Button onClick={() => enviar.mutate()} disabled={!texto.trim() || enviar.isPending}>
                {enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
