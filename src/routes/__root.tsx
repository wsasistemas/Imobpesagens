import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { SCRIPT_TEMA } from "@/lib/tema";

function ErrorDetails({ error }: { error: unknown }) {
  const err = error instanceof Error ? error : new Error(String(error ?? "Erro desconhecido"));
  const isDev = import.meta.env.DEV;
  return (
    <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
        {err.name || "Error"}
      </p>
      <p className="mt-1 break-words text-sm text-foreground">{err.message || "(sem mensagem)"}</p>
      {isDev && err.stack ? (
        <pre className="mt-3 max-h-64 overflow-auto rounded bg-background/80 p-2 text-[11px] leading-relaxed text-muted-foreground">
          {err.stack}
        </pre>
      ) : null}
    </div>
  );
}

class RootErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[RootErrorBoundary]", error, info);
    reportLovableError(error, { boundary: "react_root_error_boundary" });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-xl text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            A aplicação encontrou um erro
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Corrija o problema abaixo e recarregue a página.
          </p>
          <ErrorDetails error={this.state.error} />
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => location.reload()}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Recarregar
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Início
            </a>
          </div>
        </div>
      </div>
    );
  }
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página não carregou
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado ao renderizar. Detalhes do erro abaixo.
        </p>
        <ErrorDetails error={error} />
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Portal de Pesagem — WSA Sistemas" },
      {
        name: "description",
        content:
          "Portal de Pesagem para construtoras: pesagem rodoviária e recebimento de mercadorias por obra.",
      },
      { name: "author", content: "WSA Sistemas" },
      { property: "og:title", content: "Portal de Pesagem — WSA Sistemas" },
      {
        property: "og:description",
        content:
          "Portal de Pesagem para construtoras: pesagem rodoviária e recebimento de mercadorias por obra.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Portal de Pesagem — WSA Sistemas" },
      { name: "twitter:description", content: "Portal de Pesagem para construtoras: pesagem rodoviária e recebimento de mercadorias por obra." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5504d706-8c18-463d-a344-c958cf8bc5a2/id-preview-9df8a680--1bad69e0-95a9-4339-9b60-79b28eb3b3bc.lovable.app-1784645082180.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5504d706-8c18-463d-a344-c958cf8bc5a2/id-preview-9df8a680--1bad69e0-95a9-4339-9b60-79b28eb3b3bc.lovable.app-1784645082180.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <RootErrorBoundary>
        <Outlet />
      </RootErrorBoundary>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
