import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthNs }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Requisição de autorização inválida.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth", search: { next: location.pathname + location.searchStr } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center p-6 text-sm text-muted-foreground">
      Não foi possível carregar esta solicitação de autorização: {String((error as Error)?.message ?? error)}
    </main>
  ),
  component: Consent,
});

function Consent() {
  const details = Route.useLoaderData() as any;
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const nomeCliente = details?.client?.name ?? "um aplicativo";

  async function decidir(aprovar: boolean) {
    setBusy(true);
    setErro(null);
    const { data, error } = aprovar
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setErro(error.message);
      return;
    }
    const destino = data?.redirect_url ?? data?.redirect_to;
    if (!destino) {
      setBusy(false);
      setErro("O servidor de autorização não retornou um redirecionamento.");
      return;
    }
    window.location.href = destino;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-xl border bg-background p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xs text-muted-foreground">Portal de Pesagem</div>
            <div className="font-semibold">Autorizar acesso</div>
          </div>
        </div>

        <h1 className="mt-6 text-lg font-semibold tracking-tight">
          Conectar {nomeCliente} à sua conta
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {nomeCliente} poderá consultar obras, registros de pesagem, notas fiscais e conferências
          usando as suas permissões. Nenhum dado além do seu acesso atual será exposto.
        </p>

        {erro && (
          <p role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {erro}
          </p>
        )}

        <div className="mt-8 flex gap-3">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decidir(false)}>
            Recusar
          </Button>
          <Button className="flex-1" disabled={busy} onClick={() => decidir(true)}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aprovar
          </Button>
        </div>
      </div>
    </main>
  );
}
