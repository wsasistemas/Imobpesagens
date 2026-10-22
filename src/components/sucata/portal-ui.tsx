import type { ReactNode } from "react";
import { formatarKg } from "@/lib/sucata/validadores";

/** Moldura das páginas públicas de coleta: identidade do Portal de Pesagem, mobile primeiro. */
export function PortalMoldura({ numero, children }: { numero: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-muted px-3 py-6">
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="bg-primary px-4 py-3 text-white">
          <div className="font-heading text-sm font-semibold tracking-wide">PORTAL DE PESAGEM</div>
          <div className="text-xs text-white/80">Coleta de sucata</div>
        </div>
        <div className="px-4 py-5">{children}</div>
        {numero && (
          <div className="border-t bg-muted px-4 py-3 text-xs text-muted-foreground">
            Processo <span className="font-mono tabular-nums">{numero}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

export function LinhaDado({
  rotulo,
  valor,
  tipo,
  mono,
}: {
  rotulo: string;
  valor: string | number | null | undefined;
  tipo?: "kg" | "data";
  mono?: boolean;
}) {
  const texto =
    tipo === "kg"
      ? `${formatarKg(typeof valor === "number" ? valor : null)} kg`
      : tipo === "data"
        ? dataBR(typeof valor === "string" ? valor : null)
        : (valor ?? "—").toString();
  const usaMono = mono || tipo === "kg";
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <span className="text-foreground">{rotulo}</span>
      <span className={usaMono ? "font-mono tabular-nums text-foreground" : "text-right text-foreground"}>{texto}</span>
    </div>
  );
}

export function MostradorPeso({ kg }: { kg: number | null }) {
  return (
    <div className="mt-4 rounded-xl bg-foreground p-4 text-center">
      <div className="text-xs tracking-widest text-muted-foreground">PESO AFERIDO</div>
      <div className="font-mono text-3xl font-bold tabular-nums text-success">{formatarKg(kg)} kg</div>
    </div>
  );
}

export function AvisoLeitura({ texto }: { texto: string }) {
  return (
    <PortalMoldura numero="">
      <div className="py-8 text-center text-sm text-foreground">{texto}</div>
    </PortalMoldura>
  );
}
