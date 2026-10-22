import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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


export function useAuth(): AuthState {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((evt, sess) => {
      setSession(sess);
      if (evt === "SIGNED_OUT") {
        qc.clear();
      }
      if (evt === "SIGNED_IN" || evt === "USER_UPDATED") {
        qc.invalidateQueries({ queryKey: ["role"] });
        qc.invalidateQueries({ queryKey: ["obras"] });
        qc.invalidateQueries({ queryKey: ["minhas-coligadas"] });
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

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

