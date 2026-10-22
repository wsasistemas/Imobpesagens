import { createFileRoute, Link } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Camera,
  CheckCircle2,
  FileCheck2,
  FileText,
  Home,
  Printer,
  Recycle,
  Truck,
  UserRoundCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute('/treinamento/sucata')({
  head: () => ({
    meta: [
      { title: "Treinamento do Processo de Sucata — Portal de Pesagem" },
      {
        name: "description",
        content:
          "Treinamento didático do processo de sucata no Portal de Pesagem, com as 4 fases e cuidados para o usuário final.",
      },
      { property: "og:title", content: "Treinamento do Processo de Sucata — Portal de Pesagem" },
      {
        property: "og:description",
        content:
          "Passo a passo operacional para entrada, saída, emissão da NFA e encerramento do processo de sucata.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScrapTrainingPage,
});

type TrainingPhase = {
  number: number;
  title: string;
  owner: string;
  icon: typeof Truck;
  objective: string;
  steps: string[];
  attention?: string;
};

const phases: TrainingPhase[] = [
  {
    number: 1,
    title: "Entrada do caminhão vazio",
    owner: "Operador de balança",
    icon: Truck,
    objective: "Abrir o processo, identificar o caminhão e registrar a tara oficial.",
    steps: [
      "Entre no menu Sucata e clique em Novo Processo.",
      "Selecione a obra e o sucateiro ativo.",
      "Digite a placa ou confirme a placa lida automaticamente pela foto.",
      "Anexe a foto 001 do caminhão vazio na balança.",
      "Anexe a foto 002 da frente do caminhão com a placa legível.",
      "Capture a tara pela balança e salve a entrada.",
    ],
    attention: "A foto da frente com placa é obrigatória. Se a leitura automática falhar, o usuário pode digitar a placa manualmente.",
  },
  {
    number: 2,
    title: "Saída do caminhão carregado",
    owner: "Operador de balança e Administrativo de Obra",
    icon: Camera,
    objective: "Registrar o peso bruto, revisar os valores e solicitar a nota somente após conferência.",
    steps: [
      "Abra o processo criado na Fase 1.",
      "Anexe a foto 004 da caçamba carregada.",
      "Capture o peso bruto pela balança.",
      "Confira o peso aferido calculado pelo sistema.",
      "Revise sucateiro, valor por kg, valor total, banco e conta para depósito.",
      "Clique em SOLICITAR NOTA FISCAL apenas quando os dados estiverem corretos.",
    ],
    attention: "O peso aferido, banco e número da conta ficam protegidos. A solicitação da nota não é automática.",
  },
  {
    number: 3,
    title: "Emissão da Nota Fiscal Avulsa",
    owner: "Contabilidade",
    icon: FileText,
    objective: "Emitir a NFA no modelo oficial e liberar a fase de encerramento.",
    steps: [
      "A Contabilidade abre a solicitação recebida.",
      "Confere remetente, destinatário, CFOP, discriminação, peso e valor.",
      "Visualiza a prévia A4 da NFA oficial.",
      "Confirma a emissão quando todos os dados estiverem corretos.",
      "O sistema registra a nota e libera a Fase 4.",
    ],
  },
  {
    number: 4,
    title: "Recibo, comprovante e encerramento",
    owner: "Administrativo de Obra",
    icon: FileCheck2,
    objective: "Comprovar o pagamento, gerar o relatório fotográfico e encerrar o processo.",
    steps: [
      "Anexe a foto 010 do recibo assinado.",
      "Anexe a foto 011 do comprovante de depósito.",
      "Confira a foto 012 da NFA anexada automaticamente.",
      "Gere o relatório fotográfico oficial.",
      "Confira a prévia do relatório antes de concluir.",
      "Encerre o processo para deixá-lo como CONCLUÍDO e somente leitura.",
    ],
    attention: "Depois de concluído, o processo não deve ser editado. O relatório emitido pode ser reimpresso ou reenviado preservando a versão original.",
  },
];

const roles = [
  {
    role: "Operador de balança",
    duty: "Registra entrada, tara, saída, peso bruto e fotos da balança.",
  },
  {
    role: "Administrativo de Obra",
    duty: "Revisa os dados, solicita a NFA, anexa recibo e comprovante e encerra o processo.",
  },
  {
    role: "Contabilidade",
    duty: "Confere os dados fiscais e emite a Nota Fiscal Avulsa.",
  },
  {
    role: "Coordenador / Engenheiro",
    duty: "Acompanha o histórico, cadastros, valores e reaberturas com auditoria.",
  },
];

const evidenceChecklist = [
  "001 — caminhão vazio na balança",
  "002 — frente do caminhão com placa",
  "004 — caçamba carregada",
  "010 — recibo assinado",
  "011 — comprovante de depósito",
  "012 — Nota Fiscal Avulsa anexada pelo sistema",
];

function ScrapTrainingPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-12 animate-in fade-in duration-500">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="space-y-6 border-b border-border pb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" asChild>
              <Link to="/treinamento" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Centro de Treinamento
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/" className="gap-2">
                <Home className="h-4 w-4" />
                Voltar para o Menu Principal
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <Recycle className="h-4 w-4" />
                Treinamento de Sucata
              </div>
              <h1 className="text-3xl font-black tracking-tight text-foreground md:text-5xl">
                Como fazer o Processo de Sucata
              </h1>
              <p className="max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
                Siga as 4 fases na ordem correta para registrar a retirada de sucata, solicitar a Nota Fiscal Avulsa e gerar o relatório fotográfico oficial.
              </p>
            </div>
            <div className="rounded-xl border border-primary/15 bg-primary/5 p-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <h2 className="font-bold text-foreground">Regra principal</h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Não avance de fase sem conferir fotos, peso, valor, sucateiro, banco e conta. A revisão evita erro na emissão da NFA.
              </p>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {roles.map((item) => (
            <div key={item.role} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <UserRoundCheck className="h-5 w-5 text-primary" />
              <h2 className="mt-3 text-base font-bold text-foreground">{item.role}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.duty}</p>
            </div>
          ))}
        </section>

        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Passo a passo das 4 fases</h2>
            <p className="mt-2 text-sm text-muted-foreground">Execute uma fase por vez e confira os pontos obrigatórios antes de continuar.</p>
          </div>

          <div className="grid grid-cols-1 gap-5">
            {phases.map((phase) => {
              const Icon = phase.icon;
              return (
                <article key={phase.number} className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                    <div className="space-y-4">
                      <div className="flex items-start gap-4">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-base font-bold text-primary-foreground">
                          {phase.number}
                        </span>
                        <div>
                          <h3 className="text-xl font-bold text-foreground">{phase.title}</h3>
                          <p className="mt-1 text-xs font-semibold uppercase text-muted-foreground">{phase.owner}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-md bg-muted/50 p-4">
                        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <p className="text-sm leading-relaxed text-muted-foreground">{phase.objective}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {phase.steps.map((step, index) => (
                        <div key={step} className="flex items-start gap-3 text-sm text-muted-foreground">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-xs font-bold text-primary">
                            {index + 1}
                          </span>
                          <span className="leading-relaxed">{step}</span>
                        </div>
                      ))}
                      {phase.attention && (
                        <div className="mt-4 flex items-start gap-3 rounded-md border border-primary/15 bg-primary/5 p-4">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <p className="text-xs font-medium leading-relaxed text-primary/90">{phase.attention}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Camera className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Evidências obrigatórias</h2>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {evidenceChecklist.map((item) => (
                <div key={item} className="rounded-md bg-muted/50 px-4 py-3 text-sm font-medium text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Banknote className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Revisão antes da nota</h2>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Na Fase 2, confira o sucateiro, o valor por quilo, o valor total e os dados bancários antes de clicar em SOLICITAR NOTA FISCAL. Essa conferência reduz retrabalho na Contabilidade.
            </p>
            <div className="mt-5 flex items-start gap-3 rounded-md border border-primary/15 bg-primary/5 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs font-medium leading-relaxed text-primary/90">
                O peso aferido é calculado pelo sistema e não deve ser digitado manualmente.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-muted/40 p-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
            <div>
              <div className="flex items-center gap-3">
                <Printer className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Depois de concluído</h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                O relatório emitido deve ser preservado. Para consultar, use reimpressão ou reenvio pela própria tela do processo.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md bg-card p-4">
                <h3 className="font-bold text-foreground">Reimprimir</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Abre a prévia interna do mesmo relatório salvo e permite imprimir ou baixar.</p>
              </div>
              <div className="rounded-md bg-card p-4">
                <h3 className="font-bold text-foreground">Reenviar</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Mostra a prévia antes do envio e registra o reenvio no histórico.</p>
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" asChild>
            <Link to="/treinamento" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Centro de Treinamento
            </Link>
          </Button>
          <Button asChild>
            <Link to="/" className="gap-2">
              Voltar para o Menu Principal
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </footer>
      </div>
    </div>
  );
}
