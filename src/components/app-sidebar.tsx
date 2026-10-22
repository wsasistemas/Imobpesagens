import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { IconeDoMenu } from "@/components/icones/icone-colorido";
import { supabase } from "@/integrations/supabase/client";
import wsaLogo from "@/assets/wsa-logo.png";
import { useAuth } from "@/hooks/useAuth";
import type { MenuKey } from "@/lib/permissoes-menu";
import { cn } from "@/lib/utils";

// Menu lateral no formato do Imobenviomassa: sidebar clara, grupos com título pequeno em maiúsculas,
// item ativo em degradê azul → abóbora e ícones coloridos (src/components/icones).

type Item = { title: string; url: string; icone: string; menu: MenuKey; admin?: boolean };
type Grupo = { titulo: string; itens: Item[] };

const grupos: Grupo[] = [
  {
    titulo: "Operação",
    itens: [
      { title: "Página Inicial", url: "/", icone: "home", menu: "pesagem" },
      { title: "Pesagem", url: "/pesagem", icone: "pesagem", menu: "pesagem" },
      { title: "Sucata", url: "/sucata", icone: "sucata", menu: "sucata" },
      { title: "Dashboard", url: "/dashboard", icone: "dashboard", menu: "dashboard" },
      { title: "Configurações", url: "/configuracoes", icone: "configuracoes", menu: "configuracoes" },
    ],
  },
  {
    titulo: "Relatórios",
    itens: [
      {
        title: "Ocorrências",
        url: "/relatorios/ocorrencias",
        icone: "relatorios_ocorrencias",
        menu: "relatorios_ocorrencias",
      },
    ],
  },
  {
    titulo: "Comunicação e integrações",
    itens: [
      // "Conectar assistente" (MCP) fica fora do menu: exige o servidor OAuth do Supabase ligado no ikvj, que é
      // configuração global do projeto compartilhado (decisão D5, 22/10/2026). A rota continua no código.
      { title: "WhatsApp", url: "/whatsapp", icone: "whatsapp", menu: "whatsapp" },
    ],
  },
  {
    titulo: "Capacitação",
    itens: [
      { title: "Manual do Sistema", url: "/documentacao", icone: "documentacao", menu: "documentacao", admin: true },
      { title: "Centro de Treinamento", url: "/treinamento", icone: "treinamento", menu: "treinamento" },
    ],
  },
];

const configSub: { title: string; aba: string }[] = [
  { title: "Obras", aba: "obras" },
  { title: "Operadores", aba: "acessos" },
  { title: "Perfis", aba: "perfis" },
  { title: "Permissões por Menu", aba: "permissoes" },
  { title: "Notas fiscais", aba: "notas" },
  { title: "SEFAZ", aba: "sefaz" },
  { title: "Balança", aba: "balanca" },
  { title: "Concreto", aba: "concreto" },
  { title: "Tolerâncias", aba: "tolerancias" },
  { title: "Densidades", aba: "densidades" },
  { title: "WhatsApp", aba: "whatsapp" },
  { title: "Manutenção", aba: "manutencao" },
];

/** Classes do item do menu (mesmas medidas do Imobenviomassa: 13.5px, py-2, ícone 20px). */
const itemCls = cn(
  "h-auto gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-sidebar-foreground transition-colors",
  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&>svg]:size-5",
  "data-[active=true]:bg-sidebar-primary data-[active=true]:bg-gradient-to-r data-[active=true]:from-sidebar-primary data-[active=true]:from-55% data-[active=true]:to-abobora",
  "data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-brand",
  "group-data-[collapsible=icon]:!p-1.5",
);

export function AppSidebar({ isAdmin }: { isAdmin: boolean; isOperador: boolean }) {
  const { menusPermitidos } = useAuth();
  const pode = (m: MenuKey) => !!menusPermitidos[m];
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const fecharSeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };
  const collapsed = state === "collapsed" && !isMobile;
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const abaAtual = useRouterState({
    select: (r) => (r.location.search as { aba?: string } | undefined)?.aba,
  });

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isActive = (path: string) => (path === "/" ? currentPath === "/" : currentPath.startsWith(path));
  const emConfiguracoes = currentPath.startsWith("/configuracoes");

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border px-3 py-0">
        <Link to="/" onClick={fecharSeMobile} className="flex items-center gap-2.5">
          <img
            src={wsaLogo}
            alt="WSA Sistemas"
            className={cn("shrink-0 rounded-full bg-card shadow-card", collapsed ? "h-8 w-8" : "h-10 w-10")}
          />
          {!collapsed && (
            <span className="min-w-0 leading-tight">
              <strong className="block truncate text-[15px] font-extrabold tracking-[-0.01em] text-foreground">
                Portal de Pesagem
              </strong>
              <small className="block truncate text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                WSA Sistemas
              </small>
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-1.5">
        {grupos.map((g) => {
          const itens = g.itens.filter((i) => pode(i.menu) && (!i.admin || isAdmin));
          if (itens.length === 0) return null;
          return (
            <SidebarGroup key={g.titulo} className="py-0">
              <SidebarGroupLabel className="h-auto px-2.5 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {g.titulo}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {itens.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title} className={itemCls}>
                        <Link to={item.url} onClick={fecharSeMobile}>
                          <IconeDoMenu id={item.icone} />
                          {!collapsed && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                      {item.url === "/configuracoes" && !collapsed && emConfiguracoes && (
                        <SidebarMenu className="mt-0.5 gap-0.5">
                          {configSub.map((s) => (
                            <SidebarMenuItem key={s.aba}>
                              <SidebarMenuButton
                                asChild
                                isActive={(abaAtual ?? "acessos") === s.aba}
                                className={cn(itemCls, "pl-8 text-[13px] [&>svg]:size-[18px]")}
                              >
                                <Link to="/configuracoes" search={{ aba: s.aba }} onClick={fecharSeMobile}>
                                  <IconeDoMenu id={`cfg_${s.aba}`} tamanho={18} />
                                  <span>{s.title}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="gap-0.5 border-t border-sidebar-border px-3 py-2.5">
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem className="hidden md:block">
            <SidebarMenuButton
              tooltip={collapsed ? "Expandir menu" : "Recolher menu"}
              className={itemCls}
              onClick={() => toggleSidebar()}
            >
              <IconeDoMenu id={collapsed ? "rodape_expandir" : "rodape_recolher"} />
              {!collapsed && <span>Recolher menu</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sair"
              className={itemCls}
              onClick={async () => {
                await queryClient.cancelQueries();
                queryClient.clear();
                await supabase.auth.signOut();
                navigate({ to: "/auth", search: { next: undefined }, replace: true });
              }}
            >
              <IconeDoMenu id="rodape_sair" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
