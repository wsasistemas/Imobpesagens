import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BUCKETS } from "@/integrations/db-schema";

type AppRole = "admin" | "operador" | "coordenador" | "superadmin" | "contador" | "administrativo_obra";

export type UsuarioAdmin = {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  whatsapp: string | null; // whatsapp_e164 do perfil
  ativo: boolean;
  criado_em: string;
  ultimo_login: string | null;
  roles: AppRole[];
  obras: string[]; // obra_ids liberadas
  coligadas: string[]; // codcoligada liberadas
  engenheiroColigadas: string[]; // coligadas em que é engenheiro responsável
  engenheiroTodas: boolean; // admin/superadmin responsável por todas as coligadas
};

export type Coligada = { codcoligada: string; nome: string };



// Administração é liberada para os perfis admin e superadmin.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ehAdministrador(context: any): Promise<boolean> {
  const [adminRes, superRes] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "superadmin" }),
  ]);
  if (adminRes.error) throw new Error(adminRes.error.message);
  if (superRes.error) throw new Error(superRes.error.message);
  return Boolean(adminRes.data) || Boolean(superRes.data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(context: any) {
  if (!(await ehAdministrador(context))) {
    throw new Error("Apenas administradores podem executar esta ação.");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertSuperAdmin(context: any) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "superadmin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas o Super Admin pode executar esta ação.");
}

// Login único do ImobSystem: o auth.users é compartilhado com os outros sistemas Imob. Esta função lê todas as
// páginas (o padrão do Supabase é 50 por página) para achar um login pelo id ou pelo e-mail.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function listarTodosLogins(supabaseAdmin: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todos: any[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    todos.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return todos;
}

/** Ids de quem tem vínculo com o Portal de Pesagem (perfil ou papel). Os demais logins são de outros sistemas. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function idsDoApp(supabaseAdmin: any): Promise<Set<string>> {
  const [perfis, papeis] = await Promise.all([
    supabaseAdmin.from("profiles").select("id"),
    supabaseAdmin.from("user_roles").select("user_id"),
  ]);
  if (perfis.error) throw new Error(perfis.error.message);
  if (papeis.error) throw new Error(papeis.error.message);
  return new Set<string>([
    ...(perfis.data ?? []).map((p: { id: string }) => p.id),
    ...(papeis.data ?? []).map((r: { user_id: string }) => r.user_id),
  ]);
}

export const listarEmailsUsuarios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ ids: z.array(z.string().uuid()).max(500) }).parse(i))
  .handler(async ({ data }): Promise<Record<string, string>> => {
    if (data.ids.length === 0) return {};
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const set = new Set(data.ids);
    const out: Record<string, string> = {};
    for (const u of await listarTodosLogins(supabaseAdmin)) {
      if (set.has(u.id)) out[u.id] = u.email ?? "";
    }
    return out;
  });

export const listarUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsuarioAdmin[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Só quem tem vínculo com o Portal de Pesagem: o auth é compartilhado com os outros sistemas Imob.
    const doApp = await idsDoApp(supabaseAdmin);
    const users = (await listarTodosLogins(supabaseAdmin)).filter((u) => !!u.email && doApp.has(u.id));

    const ids = users.map((u) => u.id);
    if (ids.length === 0) return [];

    const [{ data: rolesRows, error: rolesErr }, { data: acessosRows, error: acessosErr }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
      supabaseAdmin.from("obra_acessos").select("user_id, obra_id").in("user_id", ids),
    ]);

    // Marcação global de engenheiro responsável (todas as coligadas).
    const todasSet = new Set<string>();
    const inativosNoApp = new Set<string>();
    const whatsappByUser = new Map<string, string>();
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const perfis = await (supabaseAdmin as any)
        .from("profiles")
        .select("id, engenheiro_todas_coligadas, whatsapp_e164, ativo")
        .in("id", ids);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const p of (perfis.data ?? []) as any[]) {
        if (p.ativo === false) inativosNoApp.add(p.id);
        if (p.engenheiro_todas_coligadas) todasSet.add(p.id);
        const w = typeof p.whatsapp_e164 === "string" ? p.whatsapp_e164.trim() : "";
        if (w) whatsappByUser.set(p.id, w);
      }
    }
    // A coluna engenheiro_responsavel só existe após a aplicação da migração.
    let coligRows: unknown[] | null = null;
    {
      const comFlag = await supabaseAdmin
        .from("usuario_coligadas")
        .select("user_id, codcoligada, engenheiro_responsavel")
        .in("user_id", ids);
      if (comFlag.error) {
        const semFlag = await supabaseAdmin
          .from("usuario_coligadas")
          .select("user_id, codcoligada")
          .in("user_id", ids);
        if (semFlag.error) throw new Error(semFlag.error.message);
        coligRows = semFlag.data;
      } else {
        coligRows = comFlag.data;
      }
    }

    const coligByUser = new Map<string, string[]>();
    const engByUser = new Map<string, string[]>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((coligRows ?? []) as any[]).forEach((c) => {
      const arr = coligByUser.get(c.user_id) ?? [];
      arr.push(c.codcoligada);
      coligByUser.set(c.user_id, arr);
      if (c.engenheiro_responsavel) {
        const e = engByUser.get(c.user_id) ?? [];
        e.push(c.codcoligada);
        engByUser.set(c.user_id, e);
      }
    });
    if (rolesErr) throw new Error(rolesErr.message);
    if (acessosErr) throw new Error(acessosErr.message);

    const rolesByUser = new Map<string, AppRole[]>();
    (rolesRows ?? []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesByUser.set(r.user_id, arr);
    });
    const obrasByUser = new Map<string, string[]>();
    (acessosRows ?? []).forEach((a) => {
      const arr = obrasByUser.get(a.user_id) ?? [];
      arr.push(a.obra_id);
      obrasByUser.set(a.user_id, arr);
    });

    return users
      .map((u) => {
        // Ativo = liberado no Portal de Pesagem (profiles.ativo). O login em si não é bloqueado aqui.
        const ativo = !inativosNoApp.has(u.id);
        const meta = (u.user_metadata ?? {}) as {
          display_name?: string;
          full_name?: string;
          phone?: string;
          celular?: string;
        };
        // O serviço de autenticação devolve "" (e não null) quando não há telefone.
        const naoVazio = (v?: string | null) =>
          typeof v === "string" && v.trim() !== "" ? v.trim() : null;
        return {
          id: u.id,
          email: u.email ?? "",
          display_name: naoVazio(meta.display_name) ?? naoVazio(meta.full_name),
          phone: naoVazio(u.phone) ?? naoVazio(meta.phone) ?? naoVazio(meta.celular),
          whatsapp: whatsappByUser.get(u.id) ?? null,
          ativo,
          criado_em: u.created_at,
          ultimo_login: u.last_sign_in_at ?? null,
          roles: rolesByUser.get(u.id) ?? [],
          obras: obrasByUser.get(u.id) ?? [],
          coligadas: (coligByUser.get(u.id) ?? []).sort((a, b) => a.localeCompare(b)),
          engenheiroColigadas: (engByUser.get(u.id) ?? []).sort((a, b) => a.localeCompare(b)),
          engenheiroTodas: todasSet.has(u.id),
        };
      })
      .sort((a, b) => a.email.localeCompare(b.email));
  });



export const listarColigadas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Coligada[]> => {
    const { data, error } = await context.supabase
      .from("obras")
      .select("coligada, nome")
      .order("coligada");
    if (error) throw new Error(error.message);
    const map = new Map<string, string>();
    for (const o of data ?? []) {
      const cod = (o.coligada ?? "").trim();
      if (!cod) continue;
      if (!map.has(cod)) map.set(cod, o.nome ?? cod);
    }
    return [...map.entries()]
      .map(([codcoligada, nome]) => ({ codcoligada, nome }))
      .sort((a, b) => a.codcoligada.localeCompare(b.codcoligada, "pt-BR", { numeric: true }));
  });

export const definirColigadasUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        userId: z.string().uuid(),
        coligadas: z
          .array(
            z.object({
              codcoligada: z.string().trim().min(1).max(20),
              nome: z.string().max(160).optional(),
              engenheiroResponsavel: z.boolean().optional(),
            }),
          )
          .max(200),
        whatsapp: z.string().trim().max(20).optional(),
        engenheiroTodas: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;

    const { error: delErr } = await db
      .from("usuario_coligadas")
      .delete()
      .eq("user_id", data.userId);
    if (delErr) throw new Error(delErr.message);

    if (data.coligadas.length) {
      // Podem coexistir vários responsáveis pela mesma coligada
      // (engenheiro da coligada + admins com abrangência total).
      const base = data.coligadas.map((c) => ({
        user_id: data.userId,
        codcoligada: c.codcoligada,
        nome: c.nome ?? null,
      }));
      const { error: insErr } = await db.from("usuario_coligadas").insert(
        base.map((b, i) => ({
          ...b,
          engenheiro_responsavel: data.coligadas[i]?.engenheiroResponsavel === true,
        })),
      );
      if (insErr) throw new Error(insErr.message);
    }

    const perfilUpdate: Record<string, unknown> = {};
    if (data.whatsapp !== undefined) {
      const { normalizarE164 } = await import("@/lib/whatsapp/meta.server");
      perfilUpdate['whatsapp_e164'] = normalizarE164(data.whatsapp);
    }

    if (data.engenheiroTodas !== undefined) {
      // A abrangência total é exclusiva dos perfis admin/superadmin.
      const { data: roles } = await db
        .from("user_roles")
        .select("role")
        .eq("user_id", data.userId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ehAdmin = ((roles ?? []) as any[]).some(
        (r) => r.role === "admin" || r.role === "superadmin",
      );
      perfilUpdate['engenheiro_todas_coligadas'] = data.engenheiroTodas === true && ehAdmin;
    }

    if (Object.keys(perfilUpdate).length) {
      const { error: perfErr } = await db.from("profiles").update(perfilUpdate).eq("id", data.userId);
      if (perfErr) throw new Error(perfErr.message);
    }


    return { ok: true as const };
  });

export const minhasColigadas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { data, error } = await context.supabase
      .from("usuario_coligadas")
      .select("codcoligada")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { codcoligada: string }) => r.codcoligada);
  });

export const concederAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid(), obraId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("obra_acessos")
      .upsert({ user_id: data.userId, obra_id: data.obraId }, { onConflict: "user_id,obra_id" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const revogarAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid(), obraId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("obra_acessos")
      .delete()
      .eq("user_id", data.userId)
      .eq("obra_id", data.obraId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const definirRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "operador", "coordenador", "superadmin", "contador", "administrativo_obra"]),
        conceder: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // ninguém pode remover o próprio admin/superadmin (evita se trancar fora)
    if (
      !data.conceder &&
      (data.role === "admin" || data.role === "superadmin") &&
      data.userId === context.userId
    ) {
      throw new Error("Você não pode remover a sua própria permissão de administrador.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.conceder) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role as never }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const inserirNotaManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        obraId: z.string().uuid(),
        chave: z.string().regex(/^\d{44}$/, "Chave da NF-e deve ter 44 dígitos."),
        numero: z.string().optional(),
        emissao: z.string().optional(),
        emissor: z.string().optional(),
        emissor_cnpj: z.string().optional(),
        transportadora: z.string().optional(),
        placa: z.string().optional(),
        uf: z.string().optional(),
        descricao: z.string().optional(),
        peso: z.number().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("notas_fiscais").upsert(
      {
        chave: data.chave,
        obra_id: data.obraId,
        numero: data.numero ?? null,
        emissao: data.emissao ?? null,
        emissor: data.emissor ?? null,
        emissor_cnpj: data.emissor_cnpj ?? null,
        transportadora: data.transportadora ?? null,
        placa: data.placa ?? null,
        uf: data.uf ?? null,
        descricao: data.descricao ?? null,
        peso: data.peso ?? null,
        fonte: "manual",
      },
      { onConflict: "chave" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---------------- edição de usuário / senha ----------------

export const atualizarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        userId: z.string().uuid(),
        displayName: z.string().max(120).optional(),
        email: z
          .string()
          .trim()
          .toLowerCase()
          .email("E-mail inválido")
          .max(255)
          .optional(),
        celular: z
          .string()
          .trim()
          .max(32)
          .optional()
          .transform((v) => (v === "" ? undefined : v)),
        ativo: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.ativo === false && data.userId === context.userId) {
      throw new Error("Você não pode desativar a si mesmo.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cur, error: getErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (getErr) throw new Error(getErr.message);

    // Atualização de metadados (nome + celular) num único update
    if (typeof data.displayName === "string" || typeof data.celular !== "undefined") {
      const metaAtual = (cur.user?.user_metadata ?? {}) as Record<string, unknown>;
      const meta: Record<string, unknown> = { ...metaAtual };
      if (typeof data.displayName === "string") meta.display_name = data.displayName;
      if (typeof data.celular !== "undefined") meta.celular = data.celular ?? null;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        user_metadata: meta,
      });
      if (error) throw new Error(error.message);
    }

    // Atualização de e-mail: muda o login único (vale em todos os sistemas Imob), por isso só o Super Admin.
    if (data.email && data.email !== (cur.user?.email ?? "").toLowerCase()) {
      await assertSuperAdmin(context);
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        email: data.email,
        email_confirm: true,
      });
      if (error) throw new Error(error.message);
    }

    // Ativo/inativo vale só no Portal de Pesagem (profiles.ativo): o login continua nos outros sistemas Imob.
    if (typeof data.ativo === "boolean") {
      const { error } = await supabaseAdmin
        .from("profiles")
        .upsert({ id: data.userId, ativo: data.ativo, email: cur.user?.email ?? null }, { onConflict: "id" });
      if (error) throw new Error(error.message);
    }

    return { ok: true as const };
  });


// ---------------- novo usuário (login único do ImobSystem) ----------------

/**
 * Cadastra uma pessoa no Portal de Pesagem. Se o e-mail já tem login em outro sistema Imob, reaproveita esse login
 * sem trocar a senha; se não tem, cria o login com senha provisória (troca obrigatória no primeiro acesso).
 */
export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email("E-mail inválido").max(255),
        nome: z.string().trim().min(2, "Informe o nome").max(120),
        celular: z.string().trim().max(32).optional(),
        roles: z
          .array(z.enum(["admin", "operador", "coordenador", "superadmin", "contador", "administrativo_obra"]))
          .min(1, "Escolha ao menos um perfil"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ userId: string; reaproveitado: boolean; senhaProvisoria: string | null }> => {
    await assertAdmin(context);
    if (data.roles.includes("superadmin")) await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const existente = (await listarTodosLogins(supabaseAdmin)).find(
      (u) => (u.email ?? "").toLowerCase() === data.email,
    );

    let userId: string;
    let senhaProvisoria: string | null = null;
    if (existente) {
      userId = existente.id;
    } else {
      senhaProvisoria = gerarSenhaProvisoria();
      const { data: criado, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: senhaProvisoria,
        email_confirm: true,
        user_metadata: { display_name: data.nome, celular: data.celular ?? null, must_change_password: true },
      });
      if (error || !criado.user) throw new Error(error?.message ?? "Não foi possível criar o login.");
      userId = criado.user.id;
    }

    const { error: perfErr } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, nome: data.nome, email: data.email, telefone: data.celular ?? null, ativo: true }, { onConflict: "id" });
    if (perfErr) throw new Error(perfErr.message);

    const { error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(data.roles.map((role) => ({ user_id: userId, role: role as never })), { onConflict: "user_id,role" });
    if (rolesErr) throw new Error(rolesErr.message);

    return { userId, reaproveitado: !!existente, senhaProvisoria };
  });

function gerarSenhaProvisoria(): string {
  const alfa = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const num = "23456789";
  const min = "abcdefghijkmnpqrstuvwxyz";
  const all = alfa + num + min;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let out = pick(alfa) + pick(num) + pick(min);
  for (let i = 0; i < 9; i++) out += pick(all);
  return out;
}

export const redefinirSenhaUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ senhaProvisoria: string }> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur, error: getErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (getErr) throw new Error(getErr.message);
    const senha = gerarSenhaProvisoria();
    const meta = { ...(cur.user?.user_metadata ?? {}), must_change_password: true };
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: senha,
      user_metadata: meta,
    });
    if (error) throw new Error(error.message);
    return { senhaProvisoria: senha };
  });


// ---------------- edição de registro de pesagem (super admin) ----------------

const SUPER_ADMIN_EMAIL = "wsasistemas.ia@gmail.com";

const itemNfSchema = z.object({
  descricao: z.string().max(300).optional().nullable(),
  quantidade: z.number().nullable().optional(),
  unidade: z.string().max(16).optional().nullable(),
  valor_unitario: z.number().nullable().optional(),
});

const pesagemEdicaoSchema = z.object({
  id: z.string().uuid(),
  numero_nota: z.string().max(60).nullable().optional(),
  emissor: z.string().max(200).nullable().optional(),
  contratante: z.string().max(200).nullable().optional(),
  chave_nfe: z.string().max(60).nullable().optional(),
  descricao: z.string().max(2000).nullable().optional(),
  placa: z.string().max(20).nullable().optional(),
  transportadora: z.string().max(200).nullable().optional(),
  motorista: z.string().max(200).nullable().optional(),
  modelo: z.string().max(80).nullable().optional(),
  marca: z.string().max(80).nullable().optional(),
  carreta: z.string().max(80).nullable().optional(),
  uf: z.string().max(2).nullable().optional(),
  valor_total_nf: z.number().nullable().optional(),
  qtd_total: z.number().nullable().optional(),
  peso_nf: z.number().nullable().optional(),
  peso_entrada: z.number().nullable().optional(),
  peso_saida: z.number().nullable().optional(),
  itens_nf: z.array(itemNfSchema).max(60).nullable().optional(),
  // Carta de traço corrigida manualmente pelo super admin
  traco_id: z.string().uuid().nullable().optional(),
  traco_confirmado_manual: z.boolean().nullable().optional(),
  fornecedor_confirmado_manual: z.boolean().nullable().optional(),
  peso_esperado: z.number().nullable().optional(),
  tolerancia_aplicada: z.number().nullable().optional(),
  volume_m3: z.number().nullable().optional(),
  diferenca_kg: z.number().nullable().optional(),
  diferenca_pct: z.number().nullable().optional(),
  status_afericao: z.string().max(30).nullable().optional(),
  status: z.enum([
    "rascunho_entrada",
    "aguardando_saida",
    "rascunho_saida",
    "concluida",
    "recusado",
    "fechada_com_ocorrencia",
    "aguardando_saida_ocorrencia",
  ]).optional(),
}).extend({
  justificativa: z.string().trim().min(10, "Descreva a justificativa (mín. 10 caracteres).").max(1000),
});

export type LogPesagem = {
  id: string;
  evento: string;
  justificativa: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  alteracoes: { campo: string; de: any; para: any }[];
  usuario_nome: string | null;
  usuario_email: string | null;
  created_at: string;
};

export const atualizarPesagemAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => pesagemEdicaoSchema.parse(i))
  .handler(async ({ data, context }) => {
    const email = String(
      (context.claims as { email?: string } | undefined)?.email ?? "",
    ).toLowerCase();
    const isAdmin = await ehAdministrador(context);
    if (!isAdmin) {
      throw new Error("Apenas administradores podem editar registros.");
    }
    const { id, justificativa, ...campos } = data;
    const patch = Object.fromEntries(
      Object.entries(campos).filter(([, v]) => typeof v !== "undefined"),
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Snapshot anterior para calcular o diff campo a campo.
    const { data: antes } = await supabaseAdmin
      .from("pesagens")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const iguais = (a: unknown, b: unknown) => {
      if (a == null && b == null) return true;
      if (typeof a === "number" || typeof b === "number") {
        const na = a == null ? null : Number(a);
        const nb = b == null ? null : Number(b);
        return na === nb;
      }
      if (typeof a === "object" || typeof b === "object") {
        return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
      }
      return String(a ?? "") === String(b ?? "");
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registroAntes = (antes ?? {}) as any;
    const alteracoes = Object.entries(patch)
      .filter(([campo, valor]) => !iguais(registroAntes[campo], valor))
      .map(([campo, valor]) => ({ campo, de: registroAntes[campo] ?? null, para: valor ?? null }));

    const { error } = await supabaseAdmin
      .from("pesagens")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", id);
    if (error) throw new Error(error.message);

    if (alteracoes.length > 0) {
      const { data: perfil } = await supabaseAdmin
        .from("profiles")
        .select("nome")
        .eq("id", context.userId)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin.from("pesagem_logs" as any) as any).insert({
        pesagem_id: id,
        evento: "edicao",
        justificativa,
        alteracoes,
        usuario_id: context.userId,
        usuario_nome: perfil?.nome ?? null,
        usuario_email: email,
      });
    }

    return { id, ...patch, ok: true as const, alteradas: alteracoes.length };
  });

/** Registra um evento de fase (entrada, saída, ocorrência) na trilha de auditoria. */
export const registrarLogPesagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        pesagem_id: z.string().uuid(),
        evento: z.enum(["entrada", "saida", "ocorrencia"]),
        justificativa: z.string().trim().max(1000).nullable().optional(),
        alteracoes: z
          .array(z.object({ campo: z.string(), de: z.unknown().nullable(), para: z.unknown().nullable() }))
          .max(60)
          .optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const email = String((context.claims as { email?: string } | undefined)?.email ?? "").toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("nome")
      .eq("id", context.userId)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin.from("pesagem_logs" as any) as any).insert({
      pesagem_id: data.pesagem_id,
      evento: data.evento,
      justificativa: data.justificativa ?? null,
      alteracoes: data.alteracoes ?? [],
      usuario_id: context.userId,
      usuario_nome: perfil?.nome ?? null,
      usuario_email: email,
    });
    return { ok: true as const };
  });

/** Lista os logs (fases e edições) de um registro de pesagem. */
export const listarLogsPesagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ pesagem_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: logs, error } = await (context.supabase.from("pesagem_logs" as any) as any)
      .select("id, evento, justificativa, alteracoes, usuario_nome, usuario_email, created_at")
      .eq("pesagem_id", data.pesagem_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (logs ?? []) as unknown as LogPesagem[];
  });


/* ── Recálculo do peso da NF ─────────────────────────────────── */

/** Grava itens corrigidos + peso da NF recalculado em um registro. */
export const corrigirItensNf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), itens: z.array(itemNfSchema.extend({ unidade_normalizada: z.string().nullable().optional() })).max(80) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { pesoNfReferencia } = await import("@/lib/unidades");
    const { identificarConcreto, validarCargaConcreto } = await import("@/lib/concreto");
    const { getFornecedoresConcreto } = await import("@/lib/concreto.functions");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: atual, error: errLer } = await supabaseAdmin
      .from("pesagens")
      .select("qtd_total, emissor, descricao, peso_entrada, peso_saida")
      .eq("id", data.id)
      .maybeSingle();
    if (errLer) throw new Error(errLer.message);

    let novoKg: number | null = null;
    const fornecedores = await getFornecedoresConcreto({ data: undefined });
    
    // Tenta identificar nos itens (mais detalhado) ou na descrição do cabeçalho
    const descParaBusca = data.itens.length > 0 
      ? data.itens.map(i => `${i.descricao || ""} ${i.unidade || ""}`).join(" | ")
      : (atual?.descricao ?? "");
      
    const idRes = identificarConcreto(atual?.emissor ?? "", descParaBusca, fornecedores as any);

    if (idRes?.traco) {
      const temCimento = data.itens.some(i => (i.descricao || "").toUpperCase().includes("CIMENTO"));
      let vol = Number(atual?.qtd_total ?? 0);
      
      // Formato B: Materiais secos (Ex: CONCREVIT)
      if (temCimento) {
        const itemCimento = data.itens.find(i => (i.descricao || "").toUpperCase().includes("CIMENTO"));
        const qtdCimento = Number(itemCimento?.quantidade ?? 0);
        // Consumo de cimento (kg/m³) - se não tiver no traço, usamos média de 300kg/m³ como fallback técnico
        const consumoTraco = 300; 
        if (qtdCimento > 0) {
           vol = qtdCimento / consumoTraco;
        }
      }

      const res = validarCargaConcreto({
        fornecedor: idRes.fornecedor,
        traco: idRes.traco,
        volume: vol,
        modo: "dupla",
        pesoEntrada: Number(atual?.peso_entrada ?? 0),
        pesoSaida: Number(atual?.peso_saida ?? 0),
        pesoNF: 0
      });
      novoKg = res.esperado;
    } else {
      const ref = pesoNfReferencia({ itens_nf: data.itens, qtd_total: atual?.qtd_total ?? null });
      novoKg = ref.kg;
    }

    const { error } = await supabaseAdmin
      .from("pesagens")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ 
        itens_nf: data.itens as any, 
        peso_nf: novoKg ?? null
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const, pesoNfKg: novoKg };
  });

export type ResultadoReprocessamento = {
  analisados: number;
  atualizados: number;
  suspeitos: number;
};

/** Reprocessa o peso da NF de todos os registros com itens gravados. */
export const reprocessarPesosNf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResultadoReprocessamento> => {
    await assertAdmin(context);
    const { pesoNfReferencia, detectarUnidadesSuspeitas } = await import("@/lib/unidades");
    const { identificarConcreto, validarCargaConcreto } = await import("@/lib/concreto");
    const { getFornecedoresConcreto } = await import("@/lib/concreto.functions");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: linhas, error } = await supabaseAdmin
      .from("pesagens")
      .select("id, itens_nf, qtd_total, peso_nf, peso_liquido, emissor, descricao, peso_entrada, peso_saida")
      .limit(5000);
    if (error) throw new Error(error.message);

    const fornecedores = await getFornecedoresConcreto({ data: undefined });

    let atualizados = 0;
    let suspeitos = 0;
    for (const p of linhas ?? []) {
      const itens = Array.isArray(p.itens_nf) ? p.itens_nf : [];
      if (detectarUnidadesSuspeitas(itens as never[], Number(p.peso_liquido ?? 0))) suspeitos++;

      let novoKg: number | null = null;
      const descParaBusca = itens.length > 0 
        ? itens.map((i: any) => `${i.descricao || ""} ${i.unidade || ""}`).join(" | ")
        : (p.descricao ?? "");
      
      const idRes = identificarConcreto(p.emissor ?? "", descParaBusca, fornecedores as any);

      if (idRes?.traco) {
        const itensNf = itens as any[];
        const temCimento = itensNf.some((i: any) => (i.descricao || "").toUpperCase().includes("CIMENTO"));
        let vol = Number(p.qtd_total ?? 0);

        if (temCimento) {
          const itemCimento = itensNf.find((i: any) => (i.descricao || "").toUpperCase().includes("CIMENTO"));
          const qtdCimento = Number((itemCimento as any)?.quantidade ?? 0);
          const consumoTraco = 300; 
          if (qtdCimento > 0) vol = qtdCimento / consumoTraco;
        }

        const res = validarCargaConcreto({
          fornecedor: idRes.fornecedor,
          traco: idRes.traco,
          volume: vol,
          modo: "dupla",
          pesoEntrada: Number(p.peso_entrada ?? 0),
          pesoSaida: Number(p.peso_saida ?? 0),
          pesoNF: 0
        });
        
        // CORREÇÃO DEFINITIVA: Se foi identificado como Carta Traço, o peso_nf DEVE ser o esperado (Densidade Teórica)
        novoKg = res.esperado;
      } else if (itens.length > 0) {
        const ref = pesoNfReferencia({ itens_nf: itens, qtd_total: p.qtd_total });
        novoKg = ref.kg ?? null;
      }

      const atualKg = p.peso_nf != null ? Number(p.peso_nf) : null;
      // Se identificamos concreto agora, ou se o peso mudou
      if (novoKg != null && (atualKg === null || Math.abs(atualKg - novoKg) > 0.01)) {
        const updateObj: any = { peso_nf: novoKg };
        
        // Se temos um traço identificado, garantimos que a flag de requer_conferencia_eng seja avaliada
        // ou atualizada conforme necessário. Para reprocessamento em lote, focamos no peso.
        
        const { error: errUp } = await supabaseAdmin
          .from("pesagens")
          .update(updateObj)
          .eq("id", p.id);
        if (!errUp) atualizados++;
      }
    }
    return { analisados: (linhas ?? []).length, atualizados, suspeitos };
  });

export const excluirPesagensLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ ids: z.array(z.string().uuid()).max(100) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Primeiro buscamos os caminhos das evidências para limpar o storage
    const { data: evidencias } = await supabaseAdmin
      .from("evidencias")
      .select("storage_path")
      .in("pesagem_id", data.ids);

    if (evidencias && evidencias.length > 0) {
      const paths = evidencias.map((e) => e.storage_path);
      await supabaseAdmin.storage.from(BUCKETS.evidencias).remove(paths);
    }

    const { error } = await supabaseAdmin
      .from("pesagens")
      .delete()
      .in("id", data.ids);

    if (error) throw new Error(error.message);
    return { ok: true as const, count: data.ids.length };
  });

