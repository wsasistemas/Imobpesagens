import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Copy, FileText } from "lucide-react";
import { AppShell, useObraAtual } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { CLASSE_NUM } from "@/lib/sucata/tipos";
import { dadosNfa } from "@/lib/sucata/nfa.functions";
import { FormularioNfa } from "@/components/sucata/formulario-nfa";
import { IconeIlustrativo } from "@/components/icones/icone-colorido";

export const Route = createFileRoute("/sucata/$id/nfa")({
  validateSearch: (busca: Record<string, unknown>): { foco?: "emissao" } => ({
    foco: busca["foco"] === "emissao" ? "emissao" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Nota Fiscal Avulsa da sucata — Portal de Pesagem" },
      { name: "description", content: "Dados para emissão da Nota Fiscal Avulsa da venda de sucata e anexo da nota original." },
      { property: "og:title", content: "Nota Fiscal Avulsa da sucata — Portal de Pesagem" },
      { property: "og:description", content: "Emissão, anexo e envio da Nota Fiscal Avulsa da coleta de sucata." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NfaPage,
  errorComponent: () => <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar os dados da NFA.</div>,
  notFoundComponent: () => <div className="p-6 text-sm text-muted-foreground">Processo não encontrado.</div>,
});

function NfaPage() {
  const [obraId, setObraId] = useObraAtual();
  return (
    <AppShell obraId={obraId} onObraChange={setObraId} menu="sucata">
      <Conteudo />
    </AppShell>
  );
}

function Conteudo() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { isAdmin, isSuperAdmin, isContador } = useAuth();
  const podeEmitir = isAdmin || isSuperAdmin || isContador;
  const { foco } = Route.useSearch();
  const refNumero = useRef<HTMLInputElement>(null);
  const blocoEmissao = useRef<HTMLDivElement>(null);

  const buscarDados = useServerFn(dadosNfa);


  const { data: dados, isLoading } = useQuery({
    queryKey: ["sucata", "nfa", id],
    staleTime: 15_000,
    queryFn: () => buscarDados({ data: { processoId: id } }),
  });

  const [numero, setNumero] = useState("");
  const [emissao, setEmissao] = useState("");

  useEffect(() => {
    if (!dados) return;
    // A numeração da Nota Fiscal Avulsa começa em 00001 e pode ser corrigida.
    setNumero(dados.nfaNumero ?? "00001");
    setEmissao(dados.nfaEmissao ?? new Date().toISOString().slice(0, 10));
  }, [dados]);

  // Vindo do botão do e-mail, a tela já abre no bloco de emissão com o cursor no número.
  useEffect(() => {
    if (foco !== "emissao" || !dados) return;
    blocoEmissao.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const t = setTimeout(() => refNumero.current?.focus(), 400);
    return () => clearTimeout(t);
  }, [foco, dados]);

  const copiar = async () => {
    if (!dados) return;
    const texto = dados.campos.map((c) => `${c.rotulo}: ${c.valor}`).join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Dados copiados para o emissor.");
    } catch {
      toast.error("Não foi possível copiar os dados.");
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <IconeIlustrativo icon={FileText} size={26} />
        <div className="mr-auto">
          <h1 className={`font-heading text-xl font-semibold ${CLASSE_NUM}`}>{dados?.numero ?? (isLoading ? "Carregando..." : "—")}</h1>
          <p className="text-sm text-muted-foreground">Nota Fiscal Avulsa — Contabilidade.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/sucata/$id" params={{ id }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Processo
          </Link>
        </Button>
      </div>

      {dados && !dados.aprovadoEm && (
        <div className="rounded-lg border border-primary-dark bg-primary-soft p-3 text-sm text-primary-dark">
          Este processo ainda não foi aprovado pelo administrativo da obra. A emissão da NFA está bloqueada.
        </div>
      )}
      {dados?.impedimento && (
        <div className="rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
          Impedimento registrado: {dados.impedimento}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="font-heading text-base">Dados para emissão (somente leitura)</CardTitle>
            <Button size="sm" variant="outline" onClick={copiar}>
              <Copy className="mr-2 h-4 w-4" /> Copiar dados
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {dados?.pessoaFisica && dados.avisoPf && (
              <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {dados.avisoPf}
              </p>
            )}
            <dl className="grid gap-2 text-sm">
              {(dados?.campos ?? []).map((c) => (
                <div key={c.rotulo} className="grid grid-cols-[11rem_1fr] gap-2 border-b py-1 last:border-b-0">
                  <dt className="text-muted-foreground">{c.rotulo}</dt>
                  <dd className={`font-medium ${/kg|Valor|Data|Placa|Processo/.test(c.rotulo) ? CLASSE_NUM : ""}`}>{c.valor}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">
              O valor é o informado pelo sucateiro no aceite e não pode ser alterado nesta tela.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4" ref={blocoEmissao}>
          {dados && (
            <FormularioNfa
              processoId={id}
              dados={dados}
              podeEditar={podeEmitir}
              numero={numero}
              onNumero={setNumero}
              emissao={emissao}
              onEmissao={setEmissao}
              refNumero={refNumero}
              onConfirmado={() => qc.invalidateQueries({ queryKey: ["sucata"] })}
            />
          )}
        </div>
      </div>
      {!podeEmitir && (
        <p className="text-sm text-muted-foreground">Seu perfil não permite emitir ou anexar a Nota Fiscal Avulsa.</p>
      )}
    </div>
  );
}
