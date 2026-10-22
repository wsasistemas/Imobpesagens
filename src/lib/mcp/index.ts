import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarObras from "./tools/listar-obras";
import listarPesagens from "./tools/listar-pesagens";
import obterPesagem from "./tools/obter-pesagem";
import resumoConferencia from "./tools/resumo-conferencia";

// O issuer OAuth precisa ser o host direto do Supabase (o ref sobrevive ao publish).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "portal-pesagem-mcp",
  title: "Portal de Pesagem",
  version: "0.1.0",
  instructions:
    "Ferramentas do Portal de Pesagem. Use `listar_obras` para descobrir obras, `listar_pesagens` para buscar registros por placa, nota, contratante, status ou período, `obter_pesagem` para detalhar um registro (itens da NF, ocorrências e evidências) e `resumo_conferencia` para comparar peso aferido × peso da nota por fornecedor. Todo acesso respeita as permissões do usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listarObras, listarPesagens, obterPesagem, resumoConferencia],
});
