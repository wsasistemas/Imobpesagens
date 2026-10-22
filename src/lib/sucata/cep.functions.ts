import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EnderecoCep = {
  encontrado: boolean;
  cep: string;
  logradouro: string;
  bairro: string;
  municipio: string;
  uf: string;
};

const entrada = z.object({
  cep: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 8, "CEP deve ter 8 dígitos"),
});

const TTL_MS = 24 * 60 * 60 * 1000;
const LIMITE = 500;
const cache = new Map<string, { em: number; dado: EnderecoCep }>();

function guardar(cep: string, dado: EnderecoCep) {
  if (cache.size >= LIMITE) {
    const primeiro = cache.keys().next().value;
    if (primeiro) cache.delete(primeiro);
  }
  cache.set(cep, { em: Date.now(), dado });
}

async function buscarJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!resp.ok) return null;
    return (await resp.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Consulta o CEP no servidor. O navegador nunca fala com o serviço externo. */
export const consultarCep = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => entrada.parse(i))
  .handler(async ({ data }): Promise<EnderecoCep> => {
    const cep = data.cep;
    const vazio: EnderecoCep = { encontrado: false, cep, logradouro: "", bairro: "", municipio: "", uf: "" };

    const guardado = cache.get(cep);
    if (guardado && Date.now() - guardado.em < TTL_MS) return guardado.dado;

    // BrasilAPI primeiro; uma retentativa e depois ViaCEP como alternativa.
    let bruto =
      (await buscarJson(`https://brasilapi.com.br/api/cep/v2/${cep}`)) ??
      (await buscarJson(`https://brasilapi.com.br/api/cep/v2/${cep}`));
    let achado: EnderecoCep | null = null;

    if (bruto && texto(bruto["city"])) {
      achado = {
        encontrado: true,
        cep,
        logradouro: texto(bruto["street"]),
        bairro: texto(bruto["neighborhood"]),
        municipio: texto(bruto["city"]),
        uf: texto(bruto["state"]).toUpperCase(),
      };
    } else {
      bruto = await buscarJson(`https://viacep.com.br/ws/${cep}/json/`);
      if (bruto && bruto["erro"] !== true && texto(bruto["localidade"])) {
        achado = {
          encontrado: true,
          cep,
          logradouro: texto(bruto["logradouro"]),
          bairro: texto(bruto["bairro"]),
          municipio: texto(bruto["localidade"]),
          uf: texto(bruto["uf"]).toUpperCase(),
        };
      }
    }

    if (!achado) {
      console.info(`consulta de CEP sem resultado: ${cep}`);
      return vazio;
    }
    guardar(cep, achado);
    return achado;
  });
