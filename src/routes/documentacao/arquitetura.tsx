import { createFileRoute } from '@tanstack/react-router';
import { Layers, Database, Cpu, Network } from "lucide-react";

export const Route = createFileRoute('/documentacao/arquitetura')({
  component: ArchitecturePage,
});

function ArchitecturePage() {
  const components = [
    {
      title: "Frontend (Client)",
      icon: Cpu,
      description: "SPA desenvolvido em React 19 com TanStack Router para navegação rápida e estado global persistente."
    },
    {
      title: "Edge Runtime",
      icon: Network,
      description: "Lógica de servidor e OCR processada em Cloudflare Workers (TanStack Start), garantindo baixa latência."
    },
    {
      title: "Backend (Lovable Cloud)",
      icon: Database,
      description: "Banco de dados PostgreSQL com RLS (Row Level Security) para isolamento total de dados entre obras."
    },
    {
      title: "Integração de IA",
      icon: Layers,
      description: "Gemini 1.5 Flash via AI Gateway para extração de dados estruturados de PDFs e imagens de notas fiscais."
    }
  ];

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
      <section className="space-y-4">
        <h2 className="text-3xl font-extrabold text-foreground border-b pb-2 border-primary/20">Arquitetura Técnica</h2>
        <p className="text-muted-foreground leading-relaxed">
          O sistema foi projetado para ser resiliente, seguro e escalável, utilizando as tecnologias mais modernas de 2026.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4">
        {components.map((comp, i) => (
          <div key={i} className="flex gap-6 p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <comp.icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground mb-1">{comp.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{comp.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-8 rounded-2xl bg-primary/5 border border-primary/10">
        <h3 className="font-bold text-xl mb-4">Segurança e RLS</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          Cada requisição ao banco de dados é filtrada automaticamente pelo nível de acesso do usuário. Operadores podem apenas ver dados de suas próprias obras, enquanto Administradores têm visão consolidada.
        </p>
        <div className="bg-success/20 p-4 rounded-lg font-mono text-xs text-success border border-success/20">
          SELECT * FROM pesagens WHERE obra_id IN (SELECT obra_id FROM vinculo_operador WHERE user_id = auth.uid());
        </div>
      </div>
    </div>
  );
}
