import { createFileRoute, Link } from "@tanstack/react-router";
import { Recycle, Users } from "lucide-react";
import { AppShell, TODAS_OBRAS, useObraAtual } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ListaProcessos } from "@/components/sucata/lista-processos";
import { AbasSucata } from "@/components/sucata/abas-sucata";
import { IconeIlustrativo } from "@/components/icones/icone-colorido";


export const Route = createFileRoute("/sucata/")({
  head: () => ({
    meta: [
      { title: "Sucata — Portal de Pesagem" },
      { name: "description", content: "Processos de venda de sucata ferrosa retirada das obras, com tara na entrada e peso bruto na saída." },
      { property: "og:title", content: "Sucata — Portal de Pesagem" },
      { property: "og:description", content: "Controle dos processos de sucata ferrosa das obras." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SucataPage,
});

function SucataPage() {
  const [obraId, setObraId] = useObraAtual();
  return (
    <AppShell obraId={obraId} onObraChange={setObraId} menu="sucata">
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <IconeIlustrativo icon={Recycle} size={26} />
          <div className="mr-auto">
            <h1 className="font-heading text-xl font-semibold">Sucata</h1>
            <p className="text-sm text-muted-foreground">
              A pesagem de sucata é feita na tela de Pesagem, com o botão SUCATA ativado.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/sucata/cadastros">
              <Users className="mr-2 h-4 w-4" /> Cadastros
            </Link>
          </Button>
          <Button asChild>
            <Link to="/pesagem">Ir para pesagem</Link>
          </Button>
        </div>
        <AbasSucata ativa="processos" />
        <ListaProcessos obraId={obraId === TODAS_OBRAS || !obraId ? null : obraId} />

      </div>
    </AppShell>
  );
}
