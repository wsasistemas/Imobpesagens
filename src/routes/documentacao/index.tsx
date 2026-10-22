import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/documentacao/')({
  component: DocumentationIndex,
});

function DocumentationIndex() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="space-y-4">
        <h2 className="text-3xl font-extrabold text-foreground border-b pb-2 border-primary/20">Portal de Pesagem - Visão Geral</h2>
        <p className="text-muted-foreground leading-relaxed">
          Este sistema foi desenvolvido pela <span className="text-primary font-semibold">WSA Sistemas</span> para construtoras, com o objetivo de automatizar e auditar o processo de pesagem de materiais (agregados, concreto, etc.) nas obras.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
          <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            Principais Objetivos
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Eliminar divergências entre NF e peso real.</li>
            <li>• Automatizar a captura de dados via balança (Serial).</li>
            <li>• Realizar OCR de Notas Fiscais e CT-e.</li>
            <li>• Gestão de traços de concreto (Carta de Traço).</li>
          </ul>
        </div>

        <div className="p-6 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
          <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            Stack Tecnológica
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• React 19 + TypeScript.</li>
            <li>• TanStack Start (Roteamento & SSR).</li>
            <li>• Tailwind CSS v4 + shadcn/ui.</li>
            <li>• Supabase (Auth, DB, Storage).</li>
          </ul>
        </div>
      </div>

      <section className="p-6 rounded-xl bg-muted/50 border border-primary/10">
        <h3 className="font-bold text-lg mb-4">Fluxo de Dados</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          O sistema opera em uma arquitetura de eventos onde a entrada do veículo dispara um registro temporário, que é consolidado apenas após a confirmação do peso da balança e a extração dos dados da NF via IA (Gemini 1.5 Flash).
        </p>
      </section>
    </div>
  );
}
