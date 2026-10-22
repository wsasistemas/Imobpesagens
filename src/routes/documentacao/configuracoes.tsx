import { createFileRoute } from '@tanstack/react-router';
import { Settings2, Key, RefreshCcw, Bell } from "lucide-react";

export const Route = createFileRoute('/documentacao/configuracoes')({
  component: TechConfigsPage,
});

function TechConfigsPage() {
  const configs = [
    {
      label: "OCR (Gemini)",
      status: "Ativo",
      desc: "Modelo Flash 1.5 configurado para leitura de DANFE e DACTE.",
      icon: Key
    },
    {
      label: "Notificações (Resend)",
      status: "Conectado",
      desc: "Domínio imobsystems.com.br autenticado para envios transacionais.",
      icon: Bell
    },
    {
      label: "Sync Balança",
      status: "Manual/Serial",
      desc: "Web Serial API habilitada para navegadores baseados em Chromium.",
      icon: RefreshCcw
    }
  ];

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
      <section className="space-y-4">
        <h2 className="text-3xl font-extrabold text-foreground border-b pb-2 border-primary/20">Configurações Técnicas</h2>
        <p className="text-muted-foreground">
          Gerenciamento de chaves, integrações e serviços externos que sustentam a operação do portal.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {configs.map((cfg, i) => (
          <div key={i} className="p-6 rounded-2xl bg-card border border-border flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-primary/5 flex items-center justify-center">
                <cfg.icon className="h-5 w-5 text-primary" />
              </div>
              <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-success/10 text-success">
                {cfg.status}
              </span>
            </div>
            <div>
              <h4 className="font-bold text-foreground">{cfg.label}</h4>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{cfg.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 rounded-2xl border border-dashed border-border flex items-center justify-center flex-col gap-3 text-center py-12">
        <Settings2 className="h-10 w-10 text-muted-foreground/30" />
        <h3 className="font-medium text-muted-foreground">Painel de Administração Lovable</h3>
        <p className="text-xs text-muted-foreground max-w-xs">
          Para alterar chaves de API ou segredos do sistema, acesse a aba "Secrets" no ambiente de desenvolvimento Lovable Cloud.
        </p>
      </div>
    </div>
  );
}
