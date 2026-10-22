import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { AppShell, TODAS_OBRAS, useObraAtual } from "@/components/app-shell";
import { AbasSucata } from "@/components/sucata/abas-sucata";
import { ResumoPorObra } from "@/components/sucata/resumo-por-obra";
import { IconeIlustrativo } from "@/components/icones/icone-colorido";

export const Route = createFileRoute("/sucata/resumo")({
  head: () => ({
    meta: [
      { title: "Resumo de sucata por obra — Portal de Pesagem" },
      {
        name: "description",
        content:
          "Acompanhamento gerencial da sucata por obra: peso aferido, valor total e processos concluídos.",
      },
      { property: "og:title", content: "Resumo de sucata por obra — Portal de Pesagem" },
      {
        property: "og:description",
        content: "Peso, valor e processos concluídos de sucata por obra.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResumoSucataPage,
});

function ResumoSucataPage() {
  const [obraId, setObraId] = useObraAtual();
  return (
    <AppShell obraId={obraId} onObraChange={setObraId} menu="sucata">
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <IconeIlustrativo icon={BarChart3} size={26} />
          <div>
            <h1 className="font-heading text-xl font-semibold">Resumo de sucata por obra</h1>
            <p className="text-sm text-muted-foreground">
              Peso aferido, valor e processos concluídos por obra, para acompanhamento do coordenador.
            </p>
          </div>
        </div>
        <AbasSucata ativa="resumo" />
        <ResumoPorObra obraId={obraId === TODAS_OBRAS || !obraId ? null : obraId} />
      </div>
    </AppShell>
  );
}
