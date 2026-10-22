import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatarNomeUsuario(email?: string | null): string {
  if (!email) return "—";
  const local = email.split("@")[0] ?? "";
  if (!local) return "—";
  const partes = local.split(/[.\-_]+/).filter(Boolean);
  if (partes.length === 0) return "—";
  return partes
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}
