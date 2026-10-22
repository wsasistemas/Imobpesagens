import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, ShieldAlert } from "lucide-react";
import { AppShell, useObraAtual } from "@/components/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CentralWhatsApp } from "@/components/whatsapp/central-whatsapp";
import { LogsAlertasTolerancia } from "@/components/whatsapp/logs-alertas-tolerancia";

export const Route = createFileRoute("/whatsapp/")({
  head: () => ({
    meta: [
      { title: "WhatsApp — Portal de Pesagem" },
      {
        name: "description",
        content: "Central de conversas WhatsApp com engenheiros e coordenadores das obras.",
      },
      { property: "og:title", content: "WhatsApp — Portal de Pesagem" },
      {
        property: "og:description",
        content: "Central de conversas WhatsApp com engenheiros e coordenadores das obras.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhatsAppPage,
});

function WhatsAppPage() {
  const [obraId, setObraId] = useObraAtual();
  return (
    <AppShell obraId={obraId} onObraChange={setObraId} menu="whatsapp">
      <div className="mx-auto max-w-7xl p-4 lg:p-6">
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Conversas com engenheiros e coordenadores das obras, pelo número oficial da empresa.
        </p>
        <Tabs defaultValue="central">
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger className="shrink-0 text-xs sm:text-sm" value="central">
              <MessageSquare className="mr-1 h-4 w-4" />Central
            </TabsTrigger>
            <TabsTrigger className="shrink-0 text-xs sm:text-sm" value="alertas">
              <ShieldAlert className="mr-1 h-4 w-4" />Logs de Alertas de Tolerância
            </TabsTrigger>
          </TabsList>
          <TabsContent value="central"><CentralWhatsApp /></TabsContent>
          <TabsContent value="alertas"><LogsAlertasTolerancia /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
