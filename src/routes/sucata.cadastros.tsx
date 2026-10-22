import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Users } from "lucide-react";
import { AppShell, useObraAtual } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { sucateirosQueryOptions } from "@/lib/sucata/sucata-queries";
import { CLASSE_NUM, type SucateiroRow } from "@/lib/sucata/tipos";
import { formatarCnpjSucata, formatarCpf, soDigitos } from "@/lib/sucata/validadores";
import { StatusSucateiro } from "@/components/sucata/status-badge";
import { FormSucateiro } from "@/components/sucata/form-sucateiro";
import { DocumentosSucateiro } from "@/components/sucata/documentos-sucateiro";
import { VeiculosSucateiro } from "@/components/sucata/form-veiculo";
import { CadastroTiposSucata } from "@/components/sucata/cadastro-tipos-sucata";
import { CadastroContasObra } from "@/components/sucata/cadastro-contas-obra";
import { CadastroDestinatariosRelatorio } from "@/components/sucata/cadastro-destinatarios-relatorio";
import { IconeIlustrativo } from "@/components/icones/icone-colorido";

export const Route = createFileRoute("/sucata/cadastros")({
  head: () => ({
    meta: [
      { title: "Cadastros de Sucata — Portal de Pesagem" },
      { name: "description", content: "Cadastro prévio de sucateiros, documentos, veículos por placa e tipos de sucata do módulo." },
      { property: "og:title", content: "Cadastros de Sucata — Portal de Pesagem" },
      { property: "og:description", content: "Sucateiros, documentos, veículos e tipos de sucata." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CadastrosPage,
});

function CadastrosPage() {
  const [obraId, setObraId] = useObraAtual();
  return (
    <AppShell obraId={obraId} onObraChange={setObraId} menu="sucata">
      <Conteudo obraId={obraId} />
    </AppShell>
  );
}

function Conteudo({ obraId }: { obraId: string | null }) {
  const { isAdmin, isSuperAdmin, isCoordenador } = useAuth();
  const podeEditar = isAdmin || isSuperAdmin;
  const podeEditarContas = isAdmin || isSuperAdmin || isCoordenador;
  const { data: sucateiros = [] } = useQuery(sucateirosQueryOptions());
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [edicao, setEdicao] = useState<SucateiroRow | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const reg = sucateiros.find((s) => s.id === id);
      if (reg) { setEdicao(reg); setAberto(true); }
    };
    window.addEventListener("sucata:abrir-sucateiro", handler);
    return () => window.removeEventListener("sucata:abrir-sucateiro", handler);
  }, [sucateiros]);

  const q = busca.trim().toLowerCase();
  const filtrados = sucateiros.filter((s) => {
    if (!q) return true;
    const doc = soDigitos(s.cnpj ?? s.cpf ?? "");
    return (
      (s.razao_social ?? "").toLowerCase().includes(q) ||
      (s.nome_completo ?? "").toLowerCase().includes(q) ||
      doc.includes(soDigitos(q))
    );
  });
  const atual = sucateiros.find((s) => s.id === selecionado) ?? null;

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <IconeIlustrativo icon={Users} size={26} />
        <div className="mr-auto">
          <h1 className="font-heading text-xl font-semibold">Cadastros de Sucata</h1>
          <p className="text-sm text-muted-foreground">
            O sucateiro só participa da pesagem quando estiver ATIVO e com veículo cadastrado.
          </p>
        </div>
        {podeEditar && (
          <Button onClick={() => { setEdicao(null); setAberto(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo sucateiro
          </Button>
        )}
      </div>

      <Tabs defaultValue="sucateiros">
        <TabsList>
          <TabsTrigger value="sucateiros">Sucateiros</TabsTrigger>
          <TabsTrigger value="tipos">Tipos de sucata</TabsTrigger>
          <TabsTrigger value="contas">Contas da obra</TabsTrigger>
          <TabsTrigger value="destinatarios">Destinatários do relatório</TabsTrigger>
        </TabsList>

        <TabsContent value="sucateiros" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
              <CardTitle className="font-heading text-base">Sucateiros</CardTitle>
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou documento"
                className="w-full sm:w-72"
              />
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Nome / Razão social</th>
                      <th className="p-2 text-left">Tipo</th>
                      <th className="p-2 text-left">Documento</th>
                      <th className="p-2 text-left">Município / UF</th>
                      <th className="p-2 text-left">Coligada</th>
                      <th className="p-2 text-left">Situação</th>
                      <th className="p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.length === 0 && (
                      <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Nenhum sucateiro cadastrado.</td></tr>
                    )}
                    {filtrados.map((s) => (
                      <tr
                        key={s.id}
                        className={`cursor-pointer border-t hover:bg-muted/40 ${selecionado === s.id ? "bg-muted/60" : ""}`}
                        onClick={() => setSelecionado(s.id)}
                      >
                        <td className="p-2 font-medium">{s.razao_social ?? s.nome_completo ?? "—"}</td>
                        <td className="p-2">{s.tipo_pessoa === "PJ" ? "Jurídica" : "Física"}</td>
                        <td className={`p-2 ${CLASSE_NUM}`}>
                          {s.tipo_pessoa === "PJ" ? formatarCnpjSucata(s.cnpj ?? "") : formatarCpf(s.cpf ?? "")}
                        </td>
                        <td className="p-2">{s.municipio} / {s.uf}</td>
                        <td className={`p-2 ${CLASSE_NUM}`}>{s.coligada_origem}</td>
                        <td className="p-2"><StatusSucateiro situacao={s.situacao} /></td>
                        <td className="p-2 text-right">
                          {podeEditar && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); setEdicao(s); setAberto(true); }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {atual && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-base">
                  {atual.razao_social ?? atual.nome_completo} — documentos e veículos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="documentos">
                  <TabsList>
                    <TabsTrigger value="documentos">Documentos</TabsTrigger>
                    <TabsTrigger value="veiculos">Veículos</TabsTrigger>
                  </TabsList>
                  <TabsContent value="documentos" className="pt-4">
                    <DocumentosSucateiro sucateiroId={atual.id} />
                  </TabsContent>
                  <TabsContent value="veiculos" className="pt-4">
                    <VeiculosSucateiro sucateiroId={atual.id} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tipos" className="pt-4">
          <CadastroTiposSucata podeEditar={podeEditar} />
        </TabsContent>

        <TabsContent value="contas" className="pt-4">
          <CadastroContasObra obraId={obraId} podeEditar={podeEditarContas} />
        </TabsContent>

        <TabsContent value="destinatarios" className="pt-4">
          <CadastroDestinatariosRelatorio obraId={obraId} podeEditar={podeEditarContas} />
        </TabsContent>
      </Tabs>

      <FormSucateiro aberto={aberto} onOpenChange={setAberto} registro={edicao} />
    </div>
  );
}
