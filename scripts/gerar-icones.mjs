// Gera src/components/icones/icones.data.ts com os ícones coloridos (Iconify), embutidos no bundle: o <Icon> do Iconify
// buscaria cada ícone na api.iconify.design em tempo de execução. Mesmo modelo do Imobenviomassa.
// Para incluir um ícone: some nas listas abaixo e rode `npm run icones`.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Menu lateral e cards da Página Inicial: ícone colorido de cada item, pela chave do item.
const MENU = [
  ["home", "fluent-color:home-24"],
  ["pesagem", "fluent-emoji-flat:balance-scale"],
  ["sucata", "fluent-emoji-flat:recycling-symbol"],
  ["dashboard", "flat-color-icons:combo-chart"],
  ["configuracoes", "fluent-color:settings-24"],
  ["relatorios_ocorrencias", "fluent-color:warning-24"],
  ["whatsapp", "fluent-color:chat-24"],
  ["conectar_assistente", "fluent-color:bot-sparkle-24"],
  ["documentacao", "fluent-color:book-open-24"],
  ["treinamento", "flat-color-icons:graduation-cap"],
  // Submenus de Configurações (aba da tela).
  ["cfg_obras", "fluent-color:building-24"],
  ["cfg_acessos", "fluent-color:people-24"],
  ["cfg_perfis", "fluent-color:person-key-24"],
  ["cfg_permissoes", "fluent-color:lock-shield-24"],
  ["cfg_notas", "fluent-color:document-text-24"],
  ["cfg_sefaz", "fluent-color:building-government-24"],
  ["cfg_balanca", "fluent-emoji-flat:balance-scale"],
  ["cfg_concreto", "flat-color-icons:factory"],
  ["cfg_tolerancias", "flat-color-icons:line-chart"],
  ["cfg_densidades", "flat-color-icons:calculator"],
  ["cfg_whatsapp", "fluent-color:chat-24"],
  ["cfg_manutencao", "fluent-color:wrench-screwdriver-24"],
  // Rodapé do menu.
  ["rodape_recolher", "flat-color-icons:previous"],
  ["rodape_expandir", "flat-color-icons:next"],
  ["rodape_sair", "flat-color-icons:export"],
];

// Ícones ilustrativos das telas (KPIs, cabeçalhos, telas vazias): o Lucide que a tela já usa → o colorido.
// Botões de ação continuam com ícone de linha.
const LUCIDE = [
  ["AlertTriangle", "fluent-color:warning-24"],
  ["BarChart3", "flat-color-icons:bar-chart"],
  ["BookOpen", "fluent-color:book-open-24"],
  ["Bot", "fluent-color:bot-sparkle-24"],
  ["Building2", "fluent-color:building-24"],
  ["Calculator", "flat-color-icons:calculator"],
  ["Camera", "fluent-color:camera-24"],
  ["CheckCircle2", "fluent-color:checkmark-circle-24"],
  ["Clock", "fluent-color:clock-24"],
  ["FileText", "fluent-color:document-text-24"],
  ["GraduationCap", "flat-color-icons:graduation-cap"],
  ["History", "fluent-color:history-24"],
  ["Home", "fluent-color:home-24"],
  ["Info", "flat-color-icons:info"],
  ["KeyRound", "flat-color-icons:key"],
  ["LayoutDashboard", "flat-color-icons:combo-chart"],
  ["Lock", "fluent-color:lock-closed-24"],
  ["Mail", "fluent-color:mail-24"],
  ["MessageCircle", "fluent-color:chat-24"],
  ["MessageSquare", "fluent-color:chat-24"],
  ["Recycle", "fluent-emoji-flat:recycling-symbol"],
  ["Scale", "fluent-emoji-flat:balance-scale"],
  ["Settings", "fluent-color:settings-24"],
  ["ShieldAlert", "fluent-color:shield-checkmark-24"],
  ["ShieldCheck", "fluent-color:shield-checkmark-24"],
  ["Sparkles", "fluent-emoji-flat:sparkles"],
  ["Truck", "fluent-emoji-flat:delivery-truck"],
  ["TrendingUp", "fluent-color:data-trending-24"],
  ["Users", "fluent-color:people-24"],
  ["XCircle", "fluent-color:dismiss-circle-24"],
];

const colecoes = new Map();
const dadosDe = (nome) => {
  const [prefixo, icone] = nome.split(":");
  if (!colecoes.has(prefixo)) colecoes.set(prefixo, JSON.parse(readFileSync(require.resolve(`@iconify-json/${prefixo}/icons.json`), "utf8")));
  const c = colecoes.get(prefixo);
  const i = c.icons[icone];
  if (!i) throw new Error(`Ícone não existe: ${nome}`);
  return { body: i.body, width: i.width ?? c.width ?? 16, height: i.height ?? c.height ?? 16 };
};

const usados = [...new Set([...MENU.map(([, n]) => n), ...LUCIDE.map(([, n]) => n)])];
writeFileSync(
  new URL("../src/components/icones/icones.data.ts", import.meta.url),
  `// Gerado por scripts/gerar-icones.mjs (npm run icones). Não edite à mão.
import type { IconifyIcon } from "@iconify/react";
import { ${LUCIDE.map(([l]) => l).join(", ")}, type LucideIcon } from "lucide-react";

/** Ícone colorido de cada item do menu, pela chave do item. */
export const ICONE_DO_MENU: Record<string, string> = ${JSON.stringify(Object.fromEntries(MENU), null, 2)};

/** Ícone Lucide ilustrativo → nome do colorido. */
export const COLORIDO_DE = new Map<LucideIcon, string>([
${LUCIDE.map(([l, n]) => `  [${l}, ${JSON.stringify(n)}],`).join("\n")}
]);

export const DADOS_COLORIDOS: Record<string, IconifyIcon> = ${JSON.stringify(Object.fromEntries(usados.map((n) => [n, dadosDe(n)])), null, 2)};
`,
);
console.log(`${MENU.length} ícones do menu e ${LUCIDE.length} das telas gravados (${usados.length} desenhos).`);
