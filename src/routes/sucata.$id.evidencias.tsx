import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell, useObraAtual } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { CapturaEvidencias } from "@/components/sucata/captura-evidencias";

export const Route = createFileRoute("/sucata/$id/evidencias")({
  head: () => ({
    meta: [
      { title: "Captura de evidências — Portal de Pesagem" },
      { name: "description", content: "Sequência obrigatória de 12 fotos do processo de sucata, com rótulo fixo, geolocalização e envio offline." },
      { property: "og:title", content: "Captura de evidências — Portal de Pesagem" },
      { property: "og:description", content: "Registro fotográfico obrigatório da coleta de sucata em campo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EvidenciasPage,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar as evidências.</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm text-muted-foreground">Processo não encontrado.</div>,
});

function EvidenciasPage() {
  const { id } = Route.useParams();
  const [obraId, setObraId] = useObraAtual();
  return (
    <AppShell obraId={obraId} onObraChange={setObraId} menu="sucata">
      <div className="space-y-4 p-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/sucata/$id" params={{ id }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao processo
          </Link>
        </Button>
        <CapturaEvidencias processoId={id} />
      </div>
    </AppShell>
  );
}
