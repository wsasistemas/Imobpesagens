// Endpoint público para o pg_cron chamar periodicamente e rodar a varredura DistNSU.
// Autenticação: header `x-cron-secret` deve bater com o segredo VARREDURA_CRON_SECRET.
//
// STATUS ATUAL: o SOAP/mTLS SEFAZ com .pfx requer o certificado + senha carregados
// no Vault do banco. Enquanto isso não estiver feito, o endpoint apenas responde
// com o inventário dos certificados registrados. Quando o Vault estiver populado,
// implemente aqui a chamada ao serviço NFeDistribuicaoDFe e o UPSERT em
// public.notas_fiscais.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/varredura-distnsu")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const segredo = request.headers.get("x-cron-secret") ?? "";
        const esperado = process.env.VARREDURA_CRON_SECRET;
        if (!esperado) {
          return Response.json({ ok: false, motivo: "VARREDURA_CRON_SECRET não configurado." }, { status: 500 });
        }
        if (segredo !== esperado) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: certs, error } = await supabaseAdmin
          .from("sefaz_certificados")
          .select("id, obra_id, cnpj, ambiente, ultimo_nsu, vault_secret_name, ativo")
          .eq("ativo", true);
        if (error) {
          return Response.json({ ok: false, motivo: error.message }, { status: 500 });
        }

        // TODO: para cada certificado com vault_secret_name != null:
        //   1. Ler .pfx + senha do Vault
        //   2. Assinar/enviar SOAP NFeDistribuicaoDFe (ambiente, ultimo_nsu)
        //   3. Deserializar cada <docZip> (gunzip base64) e UPSERT em notas_fiscais
        //   4. Atualizar ultimo_nsu e notas_cache_count

        return Response.json({
          ok: true,
          processados: 0,
          certificados: certs?.length ?? 0,
          pendente_vault: (certs ?? []).filter((c) => !c.vault_secret_name).length,
          mensagem:
            "Endpoint pronto. Ative a integração SEFAZ carregando os .pfx no Vault (vault_secret_name) para começar a baixar NF-e.",
        });
      },
    },
  },
});
