import { useEffect, useSyncExternalStore } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  menusPermitidosPara,
  type AppRoleKey,
  type MenuKey,
} from "@/lib/permissoes-menu";

export type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isOperador: boolean;
  isCoordenador: boolean;
  isContador: boolean;
  isAdministrativoObra: boolean;
  isSuperAdmin: boolean;
  ativo: boolean;
  roleLoading: boolean;
  mustChangePassword: boolean;
  displayName: string | null;
  menusPermitidos: Record<MenuKey, boolean>;
  coligadasPermitidas: string[];
  verTodasColigadas: boolean;
};


// Sessão compartilhada por todos os componentes. Antes cada useAuth guardava a sua cópia e nascia "carregando":
// depois do login, Página Inicial, moldura e menu montavam um após o outro e cada um mostrava a própria tela de
// carga (a tela piscava várias vezes). Agora há um ouvinte só, e quem monta depois já recebe a sessão conhecida.
let sessaoAtual: Session | null | undefined; // undefined = ainda não lida
let clienteQuery: QueryClient | null = null;
const ouvintes = new Set<() => void>();
let iniciado = false;
let ultimoUsuario: string | null | undefined;

function definirSessao(sess: Session | null) {
  sessaoAtual = sess;
  ouvintes.forEach((avisar) => avisar());
}

function iniciarSessao() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  supabase.auth.onAuthStateChange((evt, sess) => {
    const usuario = sess?.user?.id ?? null;
    if (evt === "SIGNED_OUT") clienteQuery?.clear();
    // O Supabase repete SIGNED_IN ao voltar para a aba: só recarrega papéis/obras se o usuário mudou.
    if ((evt === "SIGNED_IN" && usuario !== ultimoUsuario) || evt === "USER_UPDATED") {
      clienteQuery?.invalidateQueries({ queryKey: ["role"] });
      clienteQuery?.invalidateQueries({ queryKey: ["menus-permitidos"] });
      clienteQuery?.invalidateQueries({ queryKey: ["obras"] });
      clienteQuery?.invalidateQueries({ queryKey: ["minhas-coligadas"] });
    }
    ultimoUsuario = usuario;
    definirSessao(sess);
  });
  supabase.auth.getSession().then(({ data }) => {
    if (ultimoUsuario === undefined) ultimoUsuario = data.session?.user?.id ?? null;
    if (sessaoAtual === undefined) definirSessao(data.session);
  });
}

function assinarSessao(avisar: () => void) {
  ouvintes.add(avisar);
  iniciarSessao();
  return () => {
    ouvintes.delete(avisar);
  };
}

export function useAuth(): AuthState {
  const qc = useQueryClient();
  useEffect(() => {
    clienteQuery = qc;
  }, [qc]);
  const sessaoLida = useSyncExternalStore(
    assinarSessao,
    () => sessaoAtual,
    () => undefined,
  );
  const session = sessaoLida ?? null;
  const loading = sessaoLida === undefined;

  const userId = session?.user?.id ?? null;

  const { data: isAdmin = false, isPending: adminLoading } = useQuery({
    queryKey: ["role", userId, "admin"],
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: false,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId!,
        _role: "admin",
      });
      if (error) throw error;
      return !!data;
    },
  });

  const { data: isOperador = false, isPending: opLoading } = useQuery({
    queryKey: ["role", userId, "operador"],
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: false,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId!,
        _role: "operador",
      });
      if (error) throw error;
      return !!data;
    },
  });

  const { data: isCoordenador = false, isPending: coordLoading } = useQuery({
    queryKey: ["role", userId, "coordenador"],
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId!,
        _role: "coordenador",
      });
      if (error) throw error;
      return !!data;
    },
  });

  const { data: isContador = false, isPending: contadorLoading } = useQuery({
    queryKey: ["role", userId, "contador"],
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId!,
        _role: "contador",
      });
      if (error) throw error;
      return !!data;
    },
  });

  const { data: isSuperAdmin = false, isPending: superLoading } = useQuery({
    queryKey: ["role", userId, "superadmin"],
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId!,
        _role: "superadmin",
      });
      if (error) throw error;
      return !!data;
    },
  });

  const { data: isAdministrativoObra = false, isPending: administrativoLoading } = useQuery({
    queryKey: ["role", userId, "administrativo_obra"],
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId!,
        _role: "administrativo_obra",
      });
      if (error) throw error;
      return !!data;
    },
  });

  const { data: matriz, isPending: matrizLoading } = useQuery({
    queryKey: ["menus-permitidos"],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfil_menu_permissoes")
        .select("role, menu_key, permitido");
      if (error) throw error;
      const m: Record<string, Record<string, boolean>> = {};
      for (const r of data ?? []) {
        m[r.role] = { ...(m[r.role] ?? {}), [r.menu_key]: r.permitido };
      }
      return m;
    },
  });

  const { data: coligadasPermitidas = [] } = useQuery({
    queryKey: ["minhas-coligadas", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnMount: "always",
    retry: false,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("usuario_coligadas")
        .select("codcoligada")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.codcoligada);
    },
  });

  const roles: AppRoleKey[] = [];
  if (isSuperAdmin) roles.push("superadmin");
  if (isAdmin) roles.push("admin");
  if (isCoordenador) roles.push("coordenador");
  if (isOperador) roles.push("operador");
  if (isContador) roles.push("contador");
  if (isAdministrativoObra) roles.push("administrativo_obra");

  const user = session?.user ?? null;
  const meta = (user?.user_metadata ?? {}) as {
    display_name?: string;
    full_name?: string;
    must_change_password?: boolean;
  };

  return {
    session,
    user,
    loading,
    isAdmin: isAdmin || isSuperAdmin,
    isOperador,
    isCoordenador,
    isContador,
    isAdministrativoObra,
    isSuperAdmin,
    ativo: isAdmin || isOperador || isCoordenador || isContador || isSuperAdmin || isAdministrativoObra,
    // Só aguarda enquanto há sessão e alguma consulta ainda não resolveu (sucesso ou erro).
    roleLoading:
      !!userId &&
      (adminLoading ||
        opLoading ||
        coordLoading ||
        contadorLoading ||
        superLoading ||
        administrativoLoading ||
        matrizLoading),
    mustChangePassword: !!meta.must_change_password,
    displayName: meta.display_name ?? meta.full_name ?? null,
    menusPermitidos: menusPermitidosPara(roles, matriz),
    coligadasPermitidas,
    verTodasColigadas: isAdmin || isSuperAdmin,
  };
}

