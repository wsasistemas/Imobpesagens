import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** Abas da área de Sucata: lista de processos e resumo gerencial por obra. */
export function AbasSucata({ ativa }: { ativa: "processos" | "resumo" }) {
  const base =
    "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors border";
  const inativo = "border-transparent text-muted-foreground hover:bg-muted";
  const ativo = "border-primary/20 bg-primary-soft text-primary";
  return (
    <div className="flex flex-wrap gap-2 border-b pb-2">
      <Link to="/sucata" className={cn(base, ativa === "processos" ? ativo : inativo)}>
        Processos
      </Link>
      <Link to="/sucata/resumo" className={cn(base, ativa === "resumo" ? ativo : inativo)}>
        Resumo por obra
      </Link>
    </div>
  );
}
