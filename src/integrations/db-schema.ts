// Schema do Portal de Pesagem no Supabase ImobSystem (ikvjaowvpvxojvcfwnct). Ponto único usado pelos clientes do
// Supabase (navegador, servidor, middleware e MCP). VITE_DB_SCHEMA permite apontar para outro schema sem mexer no código.
// O tipo fica "public" porque o types.ts descreve as tabelas sob essa chave; a estrutura é a mesma no schema do app.
export const DB_SCHEMA = (import.meta.env.VITE_DB_SCHEMA || "imobpesagens") as "public";

/** Pastas de arquivos (buckets) do app: no ImobSystem os buckets são compartilhados, por isso o prefixo. */
export const BUCKETS = {
  evidencias: "imobpesagens-evidencias",
  sucataDocumentos: "imobpesagens-sucata-documentos",
  sucataEvidencias: "imobpesagens-sucata-evidencias",
  sucataRelatorios: "imobpesagens-sucata-relatorios",
} as const;
