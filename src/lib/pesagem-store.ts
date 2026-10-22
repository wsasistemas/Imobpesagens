// Utilitários puros do domínio. Estado agora vive no Supabase (ver pesagem-queries.ts).

import type { Database } from "@/integrations/supabase/types";

export type PesagemRow = Database["public"]["Tables"]["pesagens"]["Row"];
export type EvidenciaRow = Database["public"]["Tables"]["evidencias"]["Row"];
export type ObraRow = Database["public"]["Tables"]["obras"]["Row"];
export type SefazCertRow = Database["public"]["Tables"]["sefaz_certificados"]["Row"];

export type FonteNota = Database["public"]["Enums"]["fonte_nota"];
export type FontePeso = Database["public"]["Enums"]["fonte_peso"];
export type StatusPesagem = Database["public"]["Enums"]["status_pesagem"];
export type TipoEvidencia = Database["public"]["Enums"]["tipo_evidencia"];

export type PesagemComEvidencias = PesagemRow & {
  evidencias: EvidenciaRow[];
};

export function pesoLiquido(p: Pick<PesagemRow, "peso_entrada" | "peso_saida" | "peso_liquido">): number | null {
  if (p.peso_liquido != null) return Number(p.peso_liquido);
  if (p.peso_entrada == null || p.peso_saida == null) return null;
  return Math.abs(Number(p.peso_entrada) - Number(p.peso_saida));
}

export function duracaoStr(p: Pick<PesagemRow, "entrou_em" | "saiu_em">): string {
  if (!p.entrou_em || !p.saiu_em) return "—";
  const ms = new Date(p.saiu_em).getTime() - new Date(p.entrou_em).getTime();
  if (ms < 0) return "—";
  const min = Math.floor(ms / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export function fmtKg(n: number | string | null | undefined): string {
  if (n == null || n === "") return "—";
  const num = typeof n === "string" ? Number(n) : n;
  if (Number.isNaN(num)) return "—";
  return `${(num / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} t`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const OBRA_KEY = "portal-pesagem:obra-atual";
export function loadObraAtualId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(OBRA_KEY);
}
export function saveObraAtualId(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OBRA_KEY, id);
}

export function clearObraAtualId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(OBRA_KEY);
}
