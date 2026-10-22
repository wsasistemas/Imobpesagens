import { createFileRoute, Outlet, Link, useRouterState } from '@tanstack/react-router';
import { AppShell, useObraAtual } from "@/components/app-shell";
import { BookOpen, ShieldCheck, FileText, HelpCircle, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute('/documentacao')({
  component: DocumentationLayout,
});

function DocumentationLayout() {
  const [obraId, setObraId] = useObraAtual();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  
  const navItems = [
    { title: "Visão Geral", icon: FileText, url: "/documentacao" },
    { title: "Arquitetura", icon: ShieldCheck, url: "/documentacao/arquitetura" },
    { title: "Configurações Técnicas", icon: HelpCircle, url: "/documentacao/configuracoes" },
  ];

  return (
    <AppShell obraId={obraId} onObraChange={setObraId} menu="documentacao">
      <div className="flex flex-col h-full bg-background">
        <header className="px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Documentação do Sistema</h1>
              <p className="text-xs text-muted-foreground">Manual técnico e especificações do Portal de Pesagem</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild className="gap-2">
            <Link to="/">
              <LogOut className="h-4 w-4" />
              Voltar ao Início
            </Link>
          </Button>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-64 border-r border-border p-4 space-y-2 hidden md:block">
            {navItems.map((item) => (
              <Link
                key={item.url}
                to={item.url}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  currentPath === item.url 
                    ? "bg-primary text-primary-foreground font-medium" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            ))}
          </aside>

          <main className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
            <Outlet />
          </main>
        </div>
      </div>
    </AppShell>
  );
}
