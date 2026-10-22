// Gera a estrutura do schema imobpesagens (Supabase ImobSystem) a partir do estado final das migrations do Lovable.
//
// Pré-requisito: container `imobpes-pg` (public.ecr.aws/supabase/postgres:17.11.0.004) com as 86 migrations de
// supabase/migrations + drizzle/migrations reproduzidas e 1_preparar_replica.sql aplicado. Passo a passo em
// supabase/imobsystem/gerador/README.md.
//
// Saída:
//   supabase/imobsystem/migrations/20261022120000_imobpesagens_01_estrutura.sql
//   supabase/imobsystem/migrations/20261022120100_imobpesagens_02_configuracao_inicial.sql
//   supabase/imobsystem/sql-editor/1_aplicar_estrutura.sql   (= 01, numa transação com trava)
//   supabase/imobsystem/sql-editor/3_configuracao_inicial.sql (= 02)
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const CONTAINER = "imobpes-pg";
const SCHEMA = "imobpesagens";
const raiz = new URL("../", import.meta.url);

const pgDump = (...args) =>
  execFileSync("docker", ["exec", CONTAINER, "pg_dump", "-U", "supabase_admin", "-d", "postgres", ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, MSYS_NO_PATHCONV: "1" },
  });

const paraSchema = (sql) =>
  sql
    .replace(/\bpublic\./g, `${SCHEMA}.`)
    .replace(/search_path TO 'public'/g, `search_path TO '${SCHEMA}'`);

// ---------------------------------------------------------------- estrutura
let ddl = pgDump("-s", "-n", "public", "--no-owner");
const linhas = ddl.split(/\r?\n/);
const fora = (l) =>
  /^\\(un)?restrict\b/.test(l) || // meta-comando do pg_dump 17.6+, não roda no SQL Editor
  /^ALTER DEFAULT PRIVILEGES/.test(l) || // os nossos vêm no cabeçalho
  /ON SCHEMA public/.test(l) ||
  /^CREATE SCHEMA public;/.test(l) ||
  /^COMMENT ON SCHEMA public/.test(l) ||
  /^(GRANT|REVOKE) .* (TO|FROM) (anon|postgres|PUBLIC);$/.test(l);
ddl = paraSchema(linhas.filter((l) => !fora(l)).join("\n")).replace(/\n{3,}/g, "\n\n");

if (/\bpublic\b\./.test(ddl)) throw new Error("Sobrou referência a public. no DDL");
for (const proibido of ["auth.users FOR EACH", "handle_new_user_profile", "TO anon", "calper"]) {
  if (ddl.toLowerCase().includes(proibido.toLowerCase())) throw new Error(`DDL contém "${proibido}"`);
}

const cabecalho = `-- =====================================================================================================
-- Portal de Pesagem (imobpesagens) — estrutura do schema no Supabase ImobSystem (ikvjaowvpvxojvcfwnct)
-- Gerado por supabase/imobsystem/gerador/gerar.mjs a partir do estado final das migrations do Lovable
-- (supabase/migrations + drizzle/migrations), com os ajustes de gerador/1_preparar_replica.sql:
--   • sem gatilho em auth.users (o auth é compartilhado com os outros sistemas Imob);
--   • sem dados (tabelas vazias); configuração inicial em migration própria;
--   • leitura das tabelas de referência só para quem tem papel no app (usuario_do_app());
--   • nada para o anon; funções com search_path = ${SCHEMA}.
-- Aditiva: só cria objetos no schema ${SCHEMA}. Não altera public, auth nem outros schemas.
-- NÃO EDITAR À MÃO: ajuste o gerador e gere de novo.
-- =====================================================================================================

create schema if not exists ${SCHEMA};
comment on schema ${SCHEMA} is 'Portal de Pesagem (WSA Sistemas): pesagem rodoviária, sucata, tolerâncias e alertas.';

revoke all on schema ${SCHEMA} from public;
revoke all on schema ${SCHEMA} from anon;
grant usage on schema ${SCHEMA} to authenticated, service_role;

alter default privileges for role postgres in schema ${SCHEMA} revoke all on tables from public, anon;
alter default privileges for role postgres in schema ${SCHEMA} revoke all on sequences from public, anon;
alter default privileges for role postgres in schema ${SCHEMA} revoke execute on functions from public, anon;
alter default privileges for role postgres in schema ${SCHEMA} grant all on tables to service_role;
alter default privileges for role postgres in schema ${SCHEMA} grant all on sequences to service_role;
alter default privileges for role postgres in schema ${SCHEMA} grant all on functions to service_role;
`;

// Storage: buckets com o prefixo do app (no ImobSystem os buckets são compartilhados entre os sistemas).
// As policies de storage.objects valem para TODOS os buckets do projeto: o filtro do bucket vem num CASE antes do
// cast para uuid, para nunca avaliar o cast em arquivo de outro sistema.
const B = { ev: `${SCHEMA}-evidencias`, doc: `${SCHEMA}-sucata-documentos`, sev: `${SCHEMA}-sucata-evidencias`, rel: `${SCHEMA}-sucata-relatorios` };
const papel = (...p) => p.map((x) => `${SCHEMA}.has_role(auth.uid(), '${x}'::${SCHEMA}.app_role)`).join(" or ");
const obra = `${SCHEMA}.tem_acesso_obra(((storage.foldername(name))[1])::uuid)`;
const policies = [
  [`${SCHEMA}_evidencias_select`, "select", "using", `case when bucket_id = '${B.ev}' then ${obra} else false end`],
  [`${SCHEMA}_evidencias_insert`, "insert", "with check", `case when bucket_id = '${B.ev}' then ${obra} else false end`],
  [`${SCHEMA}_evidencias_delete`, "delete", "using", `case when bucket_id = '${B.ev}' then ${obra} else false end`],
  [`${SCHEMA}_sucata_docs_select`, "select", "using", `bucket_id = '${B.doc}' and (${papel("admin", "superadmin", "coordenador", "operador")})`],
  [`${SCHEMA}_sucata_docs_insert`, "insert", "with check", `bucket_id = '${B.doc}' and (${papel("admin", "superadmin", "operador")})`],
  [`${SCHEMA}_sucata_evid_select`, "select", "using", `bucket_id = '${B.sev}' and ${SCHEMA}.sucata_pode_ler()`],
  [`${SCHEMA}_sucata_evid_insert`, "insert", "with check", `bucket_id = '${B.sev}' and ${SCHEMA}.sucata_pode_escrever()`],
  [`${SCHEMA}_sucata_relatorios_select`, "select", "using", `bucket_id = '${B.rel}' and ${SCHEMA}.sucata_pode_ler()`],
];
const storage = `
-- =====================================================================================================
-- Storage: buckets privados com prefixo ${SCHEMA}- e policies com nome próprio
-- =====================================================================================================
insert into storage.buckets (id, name, public)
values ${Object.values(B).map((b) => `('${b}', '${b}', false)`).join(",\n       ")}
on conflict (id) do nothing;

${policies
  .map(
    ([nome, cmd, clausula, expr]) => `drop policy if exists ${nome} on storage.objects;
create policy ${nome} on storage.objects for ${cmd} to authenticated
  ${clausula} (${expr});`,
  )
  .join("\n\n")}
`;

const estrutura = `${cabecalho}\n${ddl.trim()}\n${storage}`;

// ---------------------------------------------------------------- configuração inicial (não é histórico)
const CONFIG = [
  "perfil_descricoes",
  "perfil_menu_permissoes",
  "tolerancias_padrao",
  "tolerancias_material",
  "densidades_material",
  "fornecedores_concreto",
  "tracos_concreto",
  "sucata_tipos",
  "sucata_parametros",
  "sucata_cfop",
];
let dados = pgDump("-a", "--column-inserts", "--on-conflict-do-nothing", "--no-owner", ...CONFIG.flatMap((t) => ["-t", `public.${t}`]));
dados = paraSchema(dados.split(/\r?\n/).filter((l) => /^INSERT INTO /.test(l)).join("\n"));
if (/calper/i.test(dados)) throw new Error("Configuração inicial contém 'calper'");
const configuracao = `-- =====================================================================================================
-- Portal de Pesagem (imobpesagens) — configuração inicial (não é histórico)
-- Perfis e permissões de menu, tolerâncias padrão, densidades, concreteiras e traços, tipos de sucata,
-- parâmetros e CFOP. Copiado das migrations do Lovable, sem a marca Calper e sem e-mails @calper.com.br.
-- Pode rodar de novo: on conflict do nothing.
-- Gerado por supabase/imobsystem/gerador/gerar.mjs. NÃO EDITAR À MÃO.
-- =====================================================================================================

${dados}
`;

// ---------------------------------------------------------------- arquivos
const trava = `-- Trava: se a estrutura já existe, para aqui (rollback) sem alterar nada.
do $trava$
begin
  if to_regclass('${SCHEMA}.pesagens') is not null then
    raise exception 'O schema ${SCHEMA} já tem a estrutura aplicada. Nada foi alterado.';
  end if;
end
$trava$;
`;
const gravar = (caminho, texto) => writeFileSync(new URL(caminho, raiz), texto.replace(/\r\n/g, "\n"));
gravar("migrations/20261022120000_imobpesagens_01_estrutura.sql", estrutura);
gravar("migrations/20261022120100_imobpesagens_02_configuracao_inicial.sql", configuracao);
gravar(
  "sql-editor/1_aplicar_estrutura.sql",
  `-- Rodar no SQL Editor do projeto ikvjaowvpvxojvcfwnct (ImobSystem). Tudo numa transação: se der erro, nada fica pela metade.
-- Conteúdo igual a migrations/20261022120000_imobpesagens_01_estrutura.sql. Depois: 2_expor_schema_api.sql.
begin;

${trava}
${estrutura}
commit;
`,
);
gravar(
  "sql-editor/3_configuracao_inicial.sql",
  `-- Rodar no SQL Editor do projeto ikvjaowvpvxojvcfwnct (ImobSystem), depois do 1 e do 2. Pode rodar de novo.
-- Conteúdo igual a migrations/20261022120100_imobpesagens_02_configuracao_inicial.sql.
begin;

${configuracao}
commit;
`,
);
const n = (re) => (estrutura.match(re) ?? []).length;
console.log(
  `estrutura: ${n(/^CREATE TABLE /gm)} tabelas, ${n(/^CREATE FUNCTION /gm)} funções, ${n(/^CREATE TYPE /gm)} enums, ` +
    `${n(/^CREATE POLICY /gm)} policies + ${policies.length} de storage, ${n(/^CREATE TRIGGER /gm)} gatilhos; ` +
    `configuração: ${dados.split("\n").filter(Boolean).length} linhas`,
);
