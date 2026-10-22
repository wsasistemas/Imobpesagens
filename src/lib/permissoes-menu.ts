export type AppRoleKey = "superadmin" | "admin" | "coordenador" | "operador" | "contador" | "administrativo_obra";

export const PERFIS: { role: AppRoleKey; nome: string }[] = [
  { role: "superadmin", nome: "SuperAdmin" },
  { role: "admin", nome: "Administradores" },
  { role: "coordenador", nome: "Coordenadores" },
  { role: "operador", nome: "Operadores" },
  { role: "contador", nome: "Contabilidade" },
  { role: "administrativo_obra", nome: "Administrativo de Obra" },
];

export type MenuKey =
  | "pesagem"
  | "sucata"
  | "dashboard"
  | "relatorios_ocorrencias"
  | "configuracoes"
  | "whatsapp"
  | "whatsapp_bulk"
  | "conectar_assistente"
  | "documentacao"
  | "treinamento";

export const MENUS: { key: MenuKey; nome: string; grupo: string }[] = [
  { key: "pesagem", nome: "Pesagem", grupo: "Operação" },
  { key: "sucata", nome: "Sucata", grupo: "Operação" },
  { key: "dashboard", nome: "Dashboard", grupo: "Operação" },
  { key: "configuracoes", nome: "Configurações", grupo: "Operação" },
  { key: "relatorios_ocorrencias", nome: "Ocorrências", grupo: "Relatórios" },
  { key: "whatsapp", nome: "WhatsApp", grupo: "WhatsApp" },
  { key: "whatsapp_bulk", nome: "Disparo em Massa", grupo: "WhatsApp" },
  { key: "conectar_assistente", nome: "Conectar assistente", grupo: "Integrações" },
  { key: "documentacao", nome: "Manual do Sistema", grupo: "Documentação" },
  { key: "treinamento", nome: "Centro de Treinamento", grupo: "Capacitação" },
];


/** Configuração recomendada (usada pelo botão "Restaurar padrão" e como fallback). */
export const PADRAO: Record<AppRoleKey, Record<MenuKey, boolean>> = {
  superadmin: {
    sucata: true,
    pesagem: true,
    dashboard: true,
    relatorios_ocorrencias: true,
    configuracoes: true,
    whatsapp: true,
    whatsapp_bulk: true,
    conectar_assistente: true,
    documentacao: true,
    treinamento: true,
  },
  admin: {
    sucata: true,
    pesagem: true,
    dashboard: true,
    relatorios_ocorrencias: true,
    configuracoes: true,
    whatsapp: true,
    whatsapp_bulk: true,
    conectar_assistente: true,
    documentacao: true,
    treinamento: true,
  },
  coordenador: {
    sucata: true,
    pesagem: false,
    dashboard: true,
    relatorios_ocorrencias: true,
    configuracoes: false,
    whatsapp: true,
    whatsapp_bulk: false,
    conectar_assistente: true,
    documentacao: false,
    treinamento: true,
  },
  contador: {
    sucata: true,
    pesagem: false,
    dashboard: false,
    relatorios_ocorrencias: false,
    configuracoes: false,
    whatsapp: false,
    whatsapp_bulk: false,
    conectar_assistente: false,
    documentacao: false,
    treinamento: false,
  },
  operador: {
    sucata: true,
    pesagem: true,
    dashboard: false,
    relatorios_ocorrencias: true,
    configuracoes: false,
    whatsapp: false,
    whatsapp_bulk: false,
    conectar_assistente: true,
    documentacao: false,
    treinamento: true,
  },
  administrativo_obra: {
    sucata: true,
    pesagem: false,
    dashboard: false,
    relatorios_ocorrencias: false,
    configuracoes: false,
    whatsapp: false,
    whatsapp_bulk: false,
    conectar_assistente: false,
    documentacao: false,
    treinamento: false,
  },
};


export function menusPermitidosPara(
  roles: AppRoleKey[],
  matriz: Record<string, Record<string, boolean>> | undefined,
): Record<MenuKey, boolean> {
  const base = matriz ?? PADRAO;
  const out = {} as Record<MenuKey, boolean>;
  for (const m of MENUS) {
    out[m.key] = roles.some((r) => {
      if (r === "superadmin") return true;
      return !!base[r]?.[m.key];
    });
  }
  return out;
}
