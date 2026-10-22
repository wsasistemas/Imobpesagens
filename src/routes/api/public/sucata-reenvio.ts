// Rotina diária (manhã) do módulo Sucata: reenvia o link de aceite depois do prazo
// e avisa o administrativo da obra quando o sucateiro não responde.
// Autenticação: header `x-cron-secret` igual ao segredo VARREDURA_CRON_SECRET.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sucata-reenvio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const esperado = process.env.VARREDURA_CRON_SECRET;
        if (!esperado) return Response.json({ ok: false, motivo: "Segredo não configurado." }, { status: 500 });
        if ((request.headers.get("x-cron-secret") ?? "") !== esperado) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { PROCESSO_ACEITE_SELECT, assuntoAceite, gerarToken, htmlAceite, textoAceite, nomeSucateiro } =
          await import("@/lib/sucata/aceite.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { notificar, parametros, paramNumero, registrarEventoServidor } = await import(
          "@/lib/sucata/notificacoes.server"
        );

        const params = await parametros(supabaseAdmin);
        const horasReenvio = paramNumero(params, "reenvio_horas", 48);
        const diasAlerta = paramNumero(params, "alerta_admin_dias", 5);
        const diasToken = paramNumero(params, "token_validade_dias", 7);
        const agora = Date.now();
        const base = process.env.PORTAL_BASE_URL ?? "https://imobpesagens.vercel.app";

        const { data: pendentes, error } = await supabaseAdmin
          .from("sucata_processos")
          .select(PROCESSO_ACEITE_SELECT)
          .is("aceite_em", null)
          .is("contestacao_em", null)
          .not("notificado_em", "is", null)
          .limit(200);
        if (error) return Response.json({ ok: false, motivo: error.message }, { status: 500 });

        let reenviados = 0;
        let alertados = 0;

        for (const linha of pendentes ?? []) {
          const p = linha as never as import("@/lib/sucata/aceite.server").ProcessoAceite;
          const bruto = linha as unknown as {
            notificado_em: string | null;
            reenvio_em: string | null;
            alerta_admin_em: string | null;
          };
          if (!bruto.notificado_em) continue;
          const horas = (agora - new Date(bruto.notificado_em).getTime()) / 3_600_000;
          const destinatario = p.sucateiro?.email_coleta;

          if (!bruto.reenvio_em && horas >= horasReenvio && destinatario) {
            const { token, hash } = gerarToken();
            const expira = new Date(agora + diasToken * 24 * 3_600_000).toISOString();
            await supabaseAdmin
              .from("sucata_processos")
              .update({ aceite_token_hash: hash, aceite_token_expira_em: expira, reenvio_em: new Date().toISOString() })
              .eq("id", p.id);
            const link = `${base}/coleta/aceite/${token}`;
            const r = await notificar(supabaseAdmin, {
              processoId: p.id,
              tipo: "REENVIO_ACEITE",
              destinatario,
              assunto: `Lembrete — ${assuntoAceite(p)}`,
              html: htmlAceite(p, link, `${link}?contestar=1`),
              texto: textoAceite(p, link),
            });
            await registrarEventoServidor(supabaseAdmin, {
              processoId: p.id,
              acao: "reenvio_aceite",
              fase: "F05",
              coligada: p.coligada_origem,
              payload: { destinatario, horas_sem_resposta: Math.round(horas), envio: r.ok ? "ENVIADA" : "FALHA" },
            });
            reenviados += 1;
            continue;
          }

          const admin = p.obra?.engenheiro_email;
          if (!bruto.alerta_admin_em && horas >= diasAlerta * 24 && admin) {
            await supabaseAdmin
              .from("sucata_processos")
              .update({ alerta_admin_em: new Date().toISOString() })
              .eq("id", p.id);
            await notificar(supabaseAdmin, {
              processoId: p.id,
              tipo: "ALERTA_SEM_RESPOSTA",
              destinatario: admin,
              assunto: `Sucateiro sem resposta — processo ${p.numero} — ${p.obra?.nome ?? "obra"}`,
              html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#334155">
<p>O processo <b>${p.numero}</b> (placa ${p.placa}, obra ${p.obra?.nome ?? "—"}) está há
${Math.floor(horas / 24)} dias sem o aceite do peso pelo sucateiro
<b>${nomeSucateiro(p.sucateiro)}</b>.</p><p>Entre em contato para dar andamento.</p></div>`,
              texto: `Processo ${p.numero} sem aceite do sucateiro há ${Math.floor(horas / 24)} dias.`,
            });
            await registrarEventoServidor(supabaseAdmin, {
              processoId: p.id,
              acao: "alerta_sem_resposta",
              fase: "F07",
              coligada: p.coligada_origem,
              payload: { destinatario: admin, dias_sem_resposta: Math.floor(horas / 24) },
            });
            alertados += 1;
          }
        }

        return Response.json({ ok: true, avaliados: pendentes?.length ?? 0, reenviados, alertados });
      },
    },
  },
});
