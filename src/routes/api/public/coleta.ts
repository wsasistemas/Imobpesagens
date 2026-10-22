// Portal externo do sucateiro — ÚNICO ponto de acesso, sem login.
// O token é validado aqui (hash SHA-256) e todas as leituras/gravações usam a
// chave de serviço no servidor. Nenhuma tabela é exposta ao papel anônimo e
// nunca devolvemos dados de outro processo.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const corpo = z.object({
  token: z.string().min(20).max(200),
  acao: z.enum(["consultar", "aceitar", "contestar", "informar_valor"]),
  motivo: z.string().min(3).max(1000).optional(),
  valor_total: z.number().positive().max(9_999_999).optional(),
  recibo_modo: z.enum(["SISTEMA", "PROPRIO"]).optional(),
});

// Limite de tentativas por token e por IP (janela deslizante em memória do worker).
const JANELA_MS = 60_000;
const LIMITE = 30;
const tentativas = new Map<string, number[]>();

function excedeu(chave: string): boolean {
  const agora = Date.now();
  const lista = (tentativas.get(chave) ?? []).filter((t) => agora - t < JANELA_MS);
  lista.push(agora);
  tentativas.set(chave, lista);
  if (tentativas.size > 5000) tentativas.clear();
  return lista.length > LIMITE;
}

export const Route = createFileRoute("/api/public/coleta")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: z.infer<typeof corpo>;
        try {
          body = corpo.parse(await request.json());
        } catch {
          return Response.json({ ok: false, motivo: "Requisição inválida." }, { status: 400 });
        }

        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          null;

        if (excedeu(`t:${body.token}`) || (ip && excedeu(`i:${ip}`))) {
          return Response.json(
            { ok: false, motivo: "Muitas tentativas. Aguarde um minuto e tente novamente." },
            { status: 429 },
          );
        }

        const { hashToken, PROCESSO_ACEITE_SELECT, nomeSucateiro, documentoSucateiro } = await import(
          "@/lib/sucata/aceite.server"
        );
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { registrarEventoServidor, notificar } = await import("@/lib/sucata/notificacoes.server");

        const hash = hashToken(body.token);
        const { data: proc } = await supabaseAdmin
          .from("sucata_processos")
          .select(PROCESSO_ACEITE_SELECT)
          .eq("aceite_token_hash", hash)
          .maybeSingle();

        if (!proc) {
          return Response.json({ ok: false, motivo: "Link inválido." }, { status: 404 });
        }
        const p = proc as never as import("@/lib/sucata/aceite.server").ProcessoAceite;

        const expirado = !!p.aceite_token_expira_em && new Date(p.aceite_token_expira_em) < new Date();
        const modo = expirado
          ? "LEITURA"
          : p.aceite_em === null
            ? "ACEITE"
            : p.valor_total === null
              ? "VALOR"
              : "LEITURA";

        const exibicao = {
          numero: p.numero,
          obra: p.obra?.nome ?? null,
          placa: p.placa,
          tipo: p.tipo?.nome ?? null,
          tara_kg: p.tara_kg,
          bruto_kg: p.bruto_kg,
          peso_aferido_kg: p.peso_aferido_kg,
          data_coleta: p.saida_em ?? p.entrada_em,
          comprador: nomeSucateiro(p.sucateiro),
          documento: documentoSucateiro(p.sucateiro),
          municipio_uf: p.sucateiro ? `${p.sucateiro.municipio}/${p.sucateiro.uf}` : null,
          valor_total: p.valor_total,
          valor_por_tonelada: p.valor_por_tonelada,
          recibo_modo: p.recibo_modo,
          aceite_em: p.aceite_em,
          contestacao_em: p.contestacao_em,
          contestacao_motivo: p.contestacao_motivo,
          faixa_min: p.tipo?.valor_ton_min ?? null,
          faixa_max: p.tipo?.valor_ton_max ?? null,
          expirado,
        };

        if (body.acao === "consultar") {
          return Response.json({ ok: true, modo, processo: exibicao });
        }

        if (expirado) {
          return Response.json(
            { ok: false, modo: "LEITURA", processo: exibicao, motivo: "Este link expirou. Fale com a obra para receber um novo." },
            { status: 200 },
          );
        }

        if (body.acao === "aceitar") {
          if (p.aceite_em) {
            return Response.json({ ok: true, modo: p.valor_total === null ? "VALOR" : "LEITURA", processo: exibicao });
          }
          const agora = new Date().toISOString();
          const { error } = await supabaseAdmin
            .from("sucata_processos")
            .update({
              aceite_em: agora,
              aceite_ip: ip,
              aceite_email: p.sucateiro?.email_coleta ?? null,
              fase: "F07",
              contestacao_em: null,
              contestacao_motivo: null,
            })
            .eq("id", p.id);
          if (error) return Response.json({ ok: false, motivo: "Não foi possível registrar o aceite." }, { status: 500 });

          await registrarEventoServidor(supabaseAdmin, {
            processoId: p.id,
            acao: "peso_aceito",
            fase: "F07",
            coligada: p.coligada_origem,
            payload: { peso_aferido_kg: p.peso_aferido_kg, ip, email: p.sucateiro?.email_coleta ?? null },
            usuarioNome: nomeSucateiro(p.sucateiro),
            usuarioEmail: p.sucateiro?.email_coleta ?? null,
          });
          return Response.json({ ok: true, modo: "VALOR", processo: { ...exibicao, aceite_em: agora } });
        }

        if (body.acao === "contestar") {
          if (!body.motivo) {
            return Response.json({ ok: false, motivo: "Descreva o motivo da contestação." }, { status: 400 });
          }
          const agora = new Date().toISOString();
          const { error } = await supabaseAdmin
            .from("sucata_processos")
            .update({ contestacao_em: agora, contestacao_motivo: body.motivo, fase: "F07" })
            .eq("id", p.id);
          if (error) return Response.json({ ok: false, motivo: "Não foi possível registrar a contestação." }, { status: 500 });

          await registrarEventoServidor(supabaseAdmin, {
            processoId: p.id,
            acao: "peso_contestado",
            fase: "F07",
            coligada: p.coligada_origem,
            payload: { motivo: body.motivo, ip },
            usuarioNome: nomeSucateiro(p.sucateiro),
            usuarioEmail: p.sucateiro?.email_coleta ?? null,
          });

          const admin = p.obra?.engenheiro_email;
          if (admin) {
            await notificar(supabaseAdmin, {
              processoId: p.id,
              tipo: "CONTESTACAO_ADMIN",
              destinatario: admin,
              assunto: `Peso contestado — ${p.obra?.nome ?? "obra"} — processo ${p.numero}`,
              html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#334155">
<p>O sucateiro <b>${nomeSucateiro(p.sucateiro)}</b> contestou o peso aferido do processo <b>${p.numero}</b>
(placa ${p.placa}, obra ${p.obra?.nome ?? "—"}).</p>
<p><b>Motivo informado:</b><br>${body.motivo.replace(/</g, "&lt;")}</p></div>`,
              texto: `Peso contestado no processo ${p.numero}. Motivo: ${body.motivo}`,
            });
          }
          return Response.json({ ok: true, modo: "LEITURA", processo: { ...exibicao, contestacao_em: agora, contestacao_motivo: body.motivo } });
        }

        // informar_valor
        if (!p.aceite_em) {
          return Response.json({ ok: false, motivo: "É preciso aceitar o peso antes de informar o valor." }, { status: 400 });
        }
        if (p.valor_total !== null) {
          return Response.json({ ok: true, modo: "LEITURA", processo: exibicao });
        }
        if (!body.valor_total || !body.recibo_modo) {
          return Response.json({ ok: false, motivo: "Informe o valor total e a forma do recibo." }, { status: 400 });
        }

        const { data: atualizado, error: erroValor } = await supabaseAdmin
          .from("sucata_processos")
          .update({ valor_total: body.valor_total, recibo_modo: body.recibo_modo, fase: "F08" })
          .eq("id", p.id)
          .select("valor_total, valor_por_tonelada, recibo_modo")
          .single();
        if (erroValor || !atualizado) {
          return Response.json({ ok: false, motivo: "Não foi possível gravar o valor." }, { status: 500 });
        }

        const porTon = atualizado.valor_por_tonelada;
        const min = p.tipo?.valor_ton_min ?? null;
        const max = p.tipo?.valor_ton_max ?? null;
        const foraDaFaixa =
          porTon !== null && ((min !== null && porTon < min) || (max !== null && porTon > max));

        await registrarEventoServidor(supabaseAdmin, {
          processoId: p.id,
          acao: "valor_informado",
          fase: "F08",
          coligada: p.coligada_origem,
          payload: {
            valor_total: atualizado.valor_total,
            valor_por_tonelada: porTon,
            recibo_modo: atualizado.recibo_modo,
            faixa_min: min,
            faixa_max: max,
            fora_da_faixa: foraDaFaixa,
            ip,
          },
          usuarioNome: nomeSucateiro(p.sucateiro),
          usuarioEmail: p.sucateiro?.email_coleta ?? null,
        });

        return Response.json({
          ok: true,
          modo: "LEITURA",
          fora_da_faixa: foraDaFaixa,
          processo: {
            ...exibicao,
            valor_total: atualizado.valor_total,
            valor_por_tonelada: porTon,
            recibo_modo: atualizado.recibo_modo,
          },
        });
      },
    },
  },
});
