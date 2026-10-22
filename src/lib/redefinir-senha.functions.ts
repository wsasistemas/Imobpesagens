import { createServerFn } from "@tanstack/react-start";
import { exigirPoliticaSenha } from "@/lib/senha";

// "Esqueceu a senha?" (tela de login) — migração 20261022140000_imobpesagens_04_redefinir_senha.
// Mesmo padrão do Imobenviomassa (Cerebro: esqueci-a-senha-com-token-proprio-no-app).
//
// O link é gerado e enviado pelo próprio app (Resend), e não pelo e-mail de recuperação do Supabase: no ikvj
// compartilhado o link padrão cai no Site URL de outro sistema quando o endereço não está na allowlist.
//
// Regras:
// - resposta SEMPRE igual, exista ou não a conta (não revela quem tem cadastro);
// - token aleatório de 32 bytes, de uso único, vale 30 min; no banco fica só o sha-256;
// - limite: 3 pedidos por e-mail e 10 por IP a cada hora (contados em senha_redefinicao);
// - o link usa a origem da requisição só se ela estiver na lista de origens do portal (evita host injection);
// - só quem está ativo no Portal de Pesagem recebe o link. A conta de login é a mesma dos outros sistemas Imob.

export const MSG_PEDIDO_RECEBIDO =
  "Se o e-mail tiver cadastro ativo, enviamos um link para redefinir a senha. Ele vale por 30 minutos.";
const MSG_LINK_INVALIDO = 'Este link é inválido ou expirou. Peça um novo em "Esqueceu a senha?".';

const VALIDADE_MIN = 30;
const LIMITE_EMAIL_HORA = 3;
const LIMITE_IP_HORA = 10;

async function sha256(texto: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(texto).digest("hex");
}

function origemValida(raw: string | undefined | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(local && u.protocol === "http:")) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Origem do link: a da requisição se for uma das origens do portal; senão PORTAL_BASE_URL / domínio de produção. */
async function origemDoPortal(): Promise<string | null> {
  const permitidas = [
    process.env.PORTAL_BASE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ]
    .map(origemValida)
    .filter((o): o is string => !!o);
  let pedida: string | null = null;
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    pedida =
      origemValida(req?.headers.get("origin")) ??
      origemValida(req?.url ? new URL(req.url).origin : null);
  } catch {
    /* fora de requisição */
  }
  if (pedida) {
    const host = new URL(pedida).hostname;
    if (permitidas.includes(pedida) || host === "localhost" || host === "127.0.0.1") return pedida;
  }
  return permitidas[0] ?? null;
}

async function ipDaRequisicao(): Promise<string> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const h = getRequest()?.headers;
    const ip = h?.get("x-forwarded-for")?.split(",")[0]?.trim() || h?.get("x-real-ip")?.trim();
    return ip || "desconhecido";
  } catch {
    return "desconhecido";
  }
}

async function jitter(minMs: number, maxMs: number) {
  await new Promise((r) => setTimeout(r, minMs + Math.floor(Math.random() * (maxMs - minMs))));
}

/** Ativo no Portal de Pesagem = tem papel e o perfil não está inativo (mesma regra de imobpesagens.has_role). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ativoNoApp(supabaseAdmin: any, userId: string): Promise<{ ativo: boolean; nome: string | null }> {
  const [{ data: papeis }, { data: perfil }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).limit(1),
    supabaseAdmin.from("profiles").select("nome, ativo").eq("id", userId).maybeSingle(),
  ]);
  return { ativo: (papeis ?? []).length > 0 && perfil?.ativo !== false, nome: perfil?.nome ?? null };
}

export const solicitarRedefinicaoSenha = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => {
    const email = String(input?.email ?? "")
      .trim()
      .toLowerCase()
      .slice(0, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");
    return { email };
  })
  .handler(async ({ data }): Promise<{ mensagem: string }> => {
    const inicio = Date.now();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = await ipDaRequisicao();
    const resposta = async () => {
      // Tempo de resposta parecido com ou sem conta (o envio do e-mail demora).
      const resto = 900 - (Date.now() - inicio);
      if (resto > 0) await jitter(resto, resto + 300);
      return { mensagem: MSG_PEDIDO_RECEBIDO };
    };

    // Limite por e-mail e por IP (conta também os pedidos de e-mail sem cadastro).
    const umaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [porEmail, porIp] = await Promise.all([
      supabaseAdmin
        .from("senha_redefinicao" as never)
        .select("id", { count: "exact", head: true })
        .eq("email", data.email)
        .gte("criado_em", umaHora),
      ip === "desconhecido"
        ? Promise.resolve({ count: 0 })
        : supabaseAdmin
            .from("senha_redefinicao" as never)
            .select("id", { count: "exact", head: true })
            .eq("ip", ip)
            .gte("criado_em", umaHora),
    ]);
    if ((porEmail.count ?? 0) >= LIMITE_EMAIL_HORA || (porIp.count ?? 0) >= LIMITE_IP_HORA) {
      console.warn("[redefinir-senha] limite de pedidos atingido");
      return resposta();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { data: uid } = await db.rpc("auth_id_por_email", { p_email: data.email });
    const membro = uid ? await ativoNoApp(db, uid as string) : null;

    if (!uid || !membro?.ativo) {
      await db.from("senha_redefinicao").insert({ email: data.email, ip });
      return resposta();
    }

    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(32).toString("base64url");
    const expira = new Date(Date.now() + VALIDADE_MIN * 60 * 1000);
    const { error: insErr } = await db.from("senha_redefinicao").insert({
      user_id: uid,
      email: data.email,
      token_hash: await sha256(token),
      ip,
      expira_em: expira.toISOString(),
    });
    if (insErr) {
      console.error("[redefinir-senha] gravar pedido:", insErr.message);
      return resposta();
    }

    const origem = await origemDoPortal();
    if (!origem) {
      console.error("[redefinir-senha] origem do portal não configurada (PORTAL_BASE_URL)");
      return resposta();
    }
    try {
      const { enviarEmailViaGateway } = await import("@/lib/email/resend.server");
      const link = `${origem}/redefinir-senha?token=${encodeURIComponent(token)}`;
      await enviarEmailViaGateway({
        para: [data.email],
        assunto: "Redefinição de senha — Portal de Pesagem",
        corpoTexto:
          `Olá${membro.nome ? `, ${membro.nome}` : ""}.\n\n` +
          `Recebemos um pedido para redefinir a sua senha do Portal de Pesagem.\n` +
          `Abra o link abaixo em até ${VALIDADE_MIN} minutos (ele só pode ser usado uma vez):\n\n${link}\n\n` +
          `A mesma conta também é usada nos outros sistemas da WSA Sistemas.\n` +
          `Se não foi você, ignore este e-mail: a senha atual continua valendo.`,
      });
    } catch (e) {
      console.error("[redefinir-senha] e-mail não enviado:", e instanceof Error ? e.message : String(e));
    }
    return resposta();
  });

export const conferirLinkRedefinicao = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => ({
    token: String(input?.token ?? "").slice(0, 200),
  }))
  .handler(async ({ data }): Promise<{ valido: boolean; email: string | null }> => {
    if (data.token.length < 20) return { valido: false, email: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: p } = await (supabaseAdmin as any)
      .from("senha_redefinicao")
      .select("email, expira_em, usado_em")
      .eq("token_hash", await sha256(data.token))
      .maybeSingle();
    const valido = !!p && !p.usado_em && !!p.expira_em && new Date(p.expira_em).getTime() > Date.now();
    return { valido, email: valido ? p.email : null };
  });

export const redefinirSenhaComToken = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; novaSenha: string }) => {
    const token = String(input?.token ?? "").slice(0, 200);
    const novaSenha = typeof input?.novaSenha === "string" ? input.novaSenha.slice(0, 128) : "";
    if (token.length < 20) throw new Error(MSG_LINK_INVALIDO);
    exigirPoliticaSenha(novaSenha);
    return { token, novaSenha };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;

    // Consome o token de forma atômica: só um pedido consegue marcar usado_em.
    const agora = new Date().toISOString();
    const { data: p } = await db
      .from("senha_redefinicao")
      .update({ usado_em: agora })
      .eq("token_hash", await sha256(data.token))
      .is("usado_em", null)
      .gt("expira_em", agora)
      .select("id, user_id, email")
      .maybeSingle();
    if (!p?.user_id) throw new Error(MSG_LINK_INVALIDO);

    if (!(await ativoNoApp(db, p.user_id)).ativo) {
      throw new Error("Sua conta não tem acesso ao Portal de Pesagem. Fale com o administrador.");
    }

    const { data: atual } = await supabaseAdmin.auth.admin.getUserById(p.user_id);
    const meta = { ...(atual.user?.user_metadata ?? {}), must_change_password: false };
    const { error } = await supabaseAdmin.auth.admin.updateUserById(p.user_id, {
      password: data.novaSenha,
      user_metadata: meta,
    });
    if (error) {
      console.error("[redefinir-senha] updateUserById:", error.message);
      // Senha recusada pelo Auth (ex.: vazada/fraca): devolve o link para tentar de novo.
      await db.from("senha_redefinicao").update({ usado_em: null }).eq("id", p.id);
      throw new Error("Não foi possível gravar a nova senha. Tente outra senha.");
    }

    // Outros links pendentes deixam de valer.
    await db.from("senha_redefinicao").update({ usado_em: agora }).eq("user_id", p.user_id).is("usado_em", null);
    return { ok: true };
  });
