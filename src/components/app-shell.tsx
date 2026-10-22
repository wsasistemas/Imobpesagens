import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert, LogOut, UserCircle2, KeyRound, Moon, Sun } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { obraComMovimentoQueryOptions, obrasQueryOptions } from "@/lib/pesagem-queries";
import { clearObraAtualId, loadObraAtualId, saveObraAtualId } from "@/lib/pesagem-store";
import { supabase } from "@/integrations/supabase/client";
import { useTema } from "@/lib/tema";
import wsaLogo from "@/assets/wsa-logo.png";
import type { MenuKey } from "@/lib/permissoes-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Valor sentinela do seletor: consulta consolidada de todas as obras liberadas. */
export const TODAS_OBRAS = "__todas__";


/** Destino de cada menu, em ordem de preferência para o fallback. */
const ROTA_MENU: { menu: MenuKey; to: string }[] = [
  { menu: "pesagem", to: "/pesagem" },
  { menu: "dashboard", to: "/dashboard" },
  { menu: "relatorios_ocorrencias", to: "/relatorios/ocorrencias" },
  { menu: "treinamento", to: "/treinamento" },
];

export function AppShell({
  children,
  obraId,
  onObraChange,
  menu,
}: {
  children: ReactNode;
  obraId: string;
  onObraChange: (id: string) => void;
  /** Menu exigido por esta tela; respeita a matriz de Permissões por Menu. */
  menu?: MenuKey;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const {
    user, loading, isAdmin, isOperador, ativo, roleLoading, mustChangePassword, displayName,
    coligadasPermitidas, verTodasColigadas, menusPermitidos,
  } = useAuth();
  const { data: obras = [], isLoading: obrasLoading } = useQuery(obrasQueryOptions(user?.id));
  const { data: obraComMovimento, isLoading: movLoading } = useQuery(
    obraComMovimentoQueryOptions(user?.id),
  );

  useEffect(() => {
    if (!loading && !user) {
      // Guarda o destino atual para o login devolver o usuário à tela pedida.
      const destino = `${location.pathname}${location.searchStr ?? ""}`;
      navigate({ to: "/auth", search: { next: destino === "/" ? undefined : destino } });
    }
  }, [user, loading, navigate, location.pathname, location.searchStr]);

  // Redireciona quem caiu numa tela sem permissão de menu para o primeiro menu liberado.
  useEffect(() => {
    if (roleLoading || !ativo || !menu) return;
    if (menusPermitidos[menu]) return;
    const destino = ROTA_MENU.find((r) => r.menu !== menu && menusPermitidos[r.menu])?.to;
    if (destino) navigate({ to: destino, replace: true });
  }, [roleLoading, ativo, menu, menusPermitidos, navigate]);

  // Senha provisória: força trocar antes de qualquer outra rota.
  useEffect(() => {
    if (!loading && user && mustChangePassword && location.pathname !== "/meu-perfil") {
      navigate({ to: "/meu-perfil", replace: true });
    }
  }, [loading, user, mustChangePassword, location.pathname, navigate]);


  useEffect(() => {
    if (obrasLoading || movLoading) return;
    if (!obras.length) {
      if (obraId) onObraChange("");
      clearObraAtualId();
      return;
    }
    const salvo = loadObraAtualId();
    const escolha = obraId || salvo;
    const valida = escolha === TODAS_OBRAS || obras.some((o) => o.id === escolha);

    if (!valida) {
      // Sem escolha válida: com várias obras liberadas, abre no consolidado.
      const preferida =
        obras.length > 1
          ? TODAS_OBRAS
          : (obraComMovimento && obras.find((o) => o.id === obraComMovimento)?.id) ?? obras[0].id;
      onObraChange(preferida);
      saveObraAtualId(preferida);

    } else if (!obraId && salvo) {
      onObraChange(salvo);
    }
  }, [obras, obrasLoading, movLoading, obraComMovimento, obraId, onObraChange]);

  if (loading || roleLoading || obrasLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { next: undefined }, replace: true });
  };

  // Usuário autenticado mas ainda sem role: tela de espera.
  if (!ativo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft text-warning">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-semibold">Aguardando ativação</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cadastro recebido. Um administrador precisa liberar seu acesso ao Portal
            de Pesagem antes de você poder operar.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Conectado como <span className="font-medium">{user.email}</span>.
          </p>
          <Button variant="outline" className="mt-6 w-full" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    );
  }

  // Sem coligada liberada: nenhuma obra é visível para este usuário.
  if (!verTodasColigadas && coligadasPermitidas.length === 0 && obras.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft text-warning">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-semibold">Nenhuma coligada liberada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Seu usuário ainda não possui coligada vinculada. Solicite ao administrador a liberação
            das coligadas que você deve acessar.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Conectado como <span className="font-medium">{user.email}</span>.
          </p>
          <Button variant="outline" className="mt-6 w-full" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar isAdmin={isAdmin} isOperador={isOperador} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/90 px-2 backdrop-blur sm:gap-3 sm:px-4">
            <SidebarTrigger className="shrink-0" />
            {obras.length > 0 && (
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
                <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:inline">
                  Obra
                </span>
                <Select
                  value={obraId || undefined}
                  onValueChange={(id) => {
                    saveObraAtualId(id);
                    onObraChange(id);
                  }}
                >
                  <SelectTrigger className="h-9 w-full min-w-0 bg-card text-xs sm:w-[320px]">
                    <SelectValue placeholder="Selecione a obra" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODAS_OBRAS} className="text-xs font-semibold">
                      Todas as obras
                    </SelectItem>
                    {obras.map((o) => (

                      <SelectItem key={o.id} value={o.id} className="text-xs">
                        {o.coligada} – {o.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-2 text-sm sm:gap-3">

              <BotaoTema />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Abrir menu do usuário"
                    className="inline-flex items-center gap-2.5 rounded-full border bg-card py-1 pl-1 pr-1 transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/40 sm:pr-3"
                  >
                    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-abobora-soft text-[11.5px] font-bold text-abobora-dark ring-1 ring-abobora/50">
                      {(displayName ?? user.email ?? "??").slice(0, 2).toUpperCase()}
                    </span>
                    <span className="hidden flex-col text-left leading-tight sm:flex">
                      <strong className="max-w-[180px] truncate text-[12.5px]">{displayName ?? user.email}</strong>
                      <small className="text-[11px] text-muted-foreground">{isAdmin ? "Administrador" : "Operador"}</small>
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 overflow-hidden rounded-xl border-border/50 shadow-xl">
                  <DropdownMenuLabel className="bg-muted/30 pb-3 pt-3">
                    <div className="font-heading text-sm font-semibold">{displayName ?? "Usuário"}</div>
                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{user.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer py-2 font-heading text-sm" onClick={() => navigate({ to: "/meu-perfil" })}>
                    <UserCircle2 className="mr-2 h-4 w-4 text-primary" /> Meu perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer py-2 font-heading text-sm" onClick={() => navigate({ to: "/meu-perfil" })}>
                    <KeyRound className="mr-2 h-4 w-4 text-primary" /> Alterar senha
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer py-2 font-heading text-sm font-semibold text-destructive focus:bg-destructive/10 focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" /> Sair do Sistema
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="min-w-0 flex-1">{children}</main>
          <footer className="border-t bg-sidebar px-4 py-3 sm:px-6">
            <div className="flex flex-col items-center justify-between gap-2 text-center sm:flex-row sm:gap-4 sm:text-left">
              <div className="flex items-center gap-2">
                <img src={wsaLogo} alt="" className="h-6 w-6 rounded-full bg-card shadow-card" />
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                  WSA Sistemas • Portal de Pesagem
                </span>
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-dimmer">
                Exclusivo para uso interno
              </div>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}

/** Botão sol/lua do cabeçalho: alterna o tema claro/escuro (src/lib/tema.ts). */
function BotaoTema() {
  const [tema, setTema] = useTema();
  const escuro = tema === "escuro";
  return (
    <button
      type="button"
      onClick={() => setTema(escuro ? "claro" : "escuro")}
      aria-label={escuro ? "Usar tema claro" : "Usar tema escuro"}
      title={escuro ? "Tema claro" : "Tema escuro"}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {escuro ? <Moon className="h-[17px] w-[17px] text-primary" /> : <Sun className="h-[17px] w-[17px] text-abobora" />}
    </button>
  );
}

/** Hook auxiliar: obraId inicial (localStorage) e persistência automática. */
export function useObraAtual(): [string, (id: string) => void] {
  const [obraId, setObraId] = useState<string>("");
  useEffect(() => {
    const salvo = loadObraAtualId();
    if (salvo) setObraId(salvo);
  }, []);
  const set = useCallback((id: string) => {
    saveObraAtualId(id);
    setObraId(id);
  }, []);
  return [obraId, set];
}
