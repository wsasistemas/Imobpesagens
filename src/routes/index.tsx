import { useMemo } from "react";
import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell, useObraAtual } from "@/components/app-shell";
import { IconeDoMenu } from "@/components/icones/icone-colorido";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Página Inicial — Portal de Pesagem" },
      {
        name: "description",
        content:
          "Página inicial do Portal de Pesagem: acesse Pesagem, Dashboard, Ocorrências, WhatsApp, Configurações e treinamento.",
      },
      { property: "og:title", content: "Página Inicial — Portal de Pesagem" },
      {
        property: "og:description",
        content:
          "Selecione um módulo para começar a operar no Portal de Pesagem.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { next: undefined } });
  },
  component: HomePage,
});

type HomeCard = {
  title: string;
  description: string;
  url: string;
  /** Chave do ícone colorido (src/components/icones, a mesma do menu lateral). */
  icone: string;
  menu: string;
};

const FIRST_ROW: HomeCard[] = [
  {
    title: "Pesagem",
    description: "Controle de entrada e saída de veículos e materiais.",
    url: "/pesagem",
    icone: "pesagem",
    menu: "pesagem",
  },
  {
    title: "Ocorrências",
    description: "Relatórios de divergências e registros de eventos.",
    url: "/relatorios/ocorrencias",
    icone: "relatorios_ocorrencias",
    menu: "relatorios_ocorrencias",
  },
  {
    title: "Dashboard",
    description: "Indicadores de desempenho e estatísticas em tempo real.",
    url: "/dashboard",
    icone: "dashboard",
    menu: "dashboard",
  },
  {
    title: "WhatsApp",
    description: "Central de conversas e alertas de tolerância.",
    url: "/whatsapp",
    icone: "whatsapp",
    menu: "whatsapp",
  },
];

const SECOND_ROW: HomeCard[] = [
  {
    title: "Configurações",
    description: "Gestão de obras, usuários, perfis e parâmetros.",
    url: "/configuracoes",
    icone: "configuracoes",
    menu: "configuracoes",
  },
  {
    title: "Manual do Sistema",
    description: "Documentação técnica e guias de operação.",
    url: "/documentacao",
    icone: "documentacao",
    menu: "documentacao",
  },
  {
    title: "Centro de Treinamento",
    description: "Vídeos, manuais e materiais de capacitação para operadores.",
    url: "/treinamento",
    icone: "treinamento",
    menu: "treinamento",
  },
];

function ModuleCard({ card }: { card: HomeCard }) {
  return (
    <Link to={card.url} className="block h-full">
      <div className="group flex h-full flex-col rounded-xl border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft">
            <IconeDoMenu id={card.icone} tamanho={28} />
          </div>
          <h3 className="text-[15.5px] font-bold tracking-tight text-foreground">{card.title}</h3>
        </div>
        <p className="flex-grow text-[13px] leading-relaxed text-muted-foreground">{card.description}</p>
        <span className="mt-4 text-[12.5px] font-semibold text-primary">Acessar →</span>
      </div>
    </Link>
  );
}

function HomePage() {
  const [obraId, setObraId] = useObraAtual();
  const { user, displayName, menusPermitidos, roleLoading } = useAuth();

  const welcomeName = useMemo(() => {
    const name = displayName || user?.email?.split("@")[0] || "Usuário";
    return name.replace(/\./g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }, [displayName, user]);

  const allowed = (card: HomeCard) =>
    !!menusPermitidos[card.menu as keyof typeof menusPermitidos];

  const firstRow = FIRST_ROW.filter(allowed);
  const secondRow = SECOND_ROW.filter(allowed);

  if (roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando portal...</span>
      </div>
    );
  }

  return (
    <AppShell obraId={obraId} onObraChange={setObraId} menu="pesagem">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <header className="relative mb-8 overflow-hidden rounded-2xl px-6 py-6 text-primary-foreground brand-gradient sm:px-8">
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-[26px]">Bem-vindo, {welcomeName}</h1>
              <p className="mt-1 max-w-xl text-sm opacity-90">
                Selecione um módulo abaixo para começar a operar no Portal de Pesagem.
              </p>
            </div>
            {!!menusPermitidos.pesagem && (
              <Link
                to="/pesagem"
                className="inline-flex h-10 items-center gap-2 self-start rounded-lg bg-abobora px-4 text-sm font-semibold text-[oklch(0.25_0.04_50)] shadow-sm transition-transform hover:-translate-y-0.5 sm:self-auto"
              >
                <IconeDoMenu id="pesagem" tamanho={18} /> Nova pesagem
              </Link>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[5px] bg-abobora" />
        </header>

        <div className="space-y-4">
          {firstRow.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {firstRow.map((card) => (
                <ModuleCard key={card.url} card={card} />
              ))}
            </div>
          )}

          {secondRow.length > 0 && (
            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {secondRow.map((card) => (
                <ModuleCard key={card.url} card={card} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
