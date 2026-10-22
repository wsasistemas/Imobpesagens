import { createFileRoute, Link } from '@tanstack/react-router';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  GraduationCap,
  Home,
  Recycle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute('/treinamento/')({
  head: () => ({
    meta: [
      { title: "Centro de Treinamento — Portal de Pesagem" },
      {
        name: "description",
        content:
          "Centro de Treinamento do Portal de Pesagem com guias operacionais para pesagem e processo de sucata.",
      },
      { property: "og:title", content: "Centro de Treinamento — Portal de Pesagem" },
      {
        property: "og:description",
        content:
          "Guias passo a passo para orientar os usuários finais nas rotinas do Portal de Pesagem.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrainingPage,
});

type TrainingCard = {
  title: string;
  description: string;
  tip: string;
  icon: typeof GraduationCap;
  href: "/pesagem" | "/treinamento/sucata";
  cta: string;
};

const trainings: TrainingCard[] = [
  {
    title: "Operação de Pesagem",
    description:
      "Passo a passo para identificar a nota fiscal, capturar o peso pela balança e registrar as evidências da carga.",
    tip: "Use este guia para entrada e saída de materiais comuns da obra.",
    icon: GraduationCap,
    href: "/pesagem",
    cta: "Abrir pesagem",
  },
  {
    title: "Processo de Sucata",
    description:
      "Treinamento completo das 4 fases: entrada do caminhão vazio, saída carregada, emissão da NFA e encerramento com relatório fotográfico.",
    tip: "Use este guia antes de criar, revisar ou encerrar um processo de sucata.",
    icon: Recycle,
    href: "/treinamento/sucata",
    cta: "Ver treinamento",
  },
];

const quickSteps = [
  "Confira se a obra correta está selecionada.",
  "Registre fotos nítidas e com a placa legível quando solicitado.",
  "Revise peso, valores e dados bancários antes de solicitar a nota.",
  "Antes de encerrar, confira se todas as evidências obrigatórias foram anexadas.",
];

function TrainingPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-12 animate-in slide-in-from-bottom-4 duration-700">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="flex flex-col gap-6 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <GraduationCap className="h-4 w-4" />
              Centro de Treinamento
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-black tracking-tight text-foreground md:text-5xl">
                Treinamentos operacionais do Portal de Pesagem
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
                Escolha o treinamento desejado e siga as etapas na ordem correta para registrar cada processo com segurança e conformidade.
              </p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link to="/" className="gap-2">
              <Home className="h-4 w-4" />
              Voltar para o Menu Principal
            </Link>
          </Button>
        </header>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {trainings.map((training) => {
            const Icon = training.icon;
            return (
              <article key={training.title} className="flex h-full flex-col rounded-xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-primary/50">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <h2 className="text-xl font-bold text-foreground">{training.title}</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">{training.description}</p>
                  </div>
                </div>
                <div className="mt-6 flex items-start gap-3 rounded-md border border-primary/10 bg-primary/5 p-4">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-xs font-medium leading-relaxed text-primary/90">{training.tip}</p>
                </div>
                <div className="mt-6">
                  <Button asChild>
                    <Link to={training.href} className="gap-2">
                      {training.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-xl border border-border bg-muted/40 p-6">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Checklist rápido antes de operar</h2>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {quickSteps.map((step) => (
              <div key={step} className="flex items-start gap-3 rounded-md bg-card p-4 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
