/** Validação e formatação de documentos (módulo Sucata). */

export function soDigitos(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

export function validarCpf(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += Number(d[i]) * (10 - i);
  let dv1 = (s * 10) % 11;
  if (dv1 === 10) dv1 = 0;
  if (dv1 !== Number(d[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += Number(d[i]) * (11 - i);
  let dv2 = (s * 10) % 11;
  if (dv2 === 10) dv2 = 0;
  return dv2 === Number(d[10]);
}

export function validarCnpj(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    let p = len - 7;
    let s = 0;
    for (let i = 0; i < len; i++) {
      s += Number(d[i]) * p;
      p = p - 1 < 2 ? 9 : p - 1;
    }
    const r = 11 - (s % 11);
    return r >= 10 ? 0 : r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export function formatarCpf(valor: string): string {
  const d = soDigitos(valor).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function formatarCnpjSucata(valor: string): string {
  const d = soDigitos(valor).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function formatarCep(valor: string): string {
  const d = soDigitos(valor).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

export function normalizarPlaca(valor: string): string {
  return (valor ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

export function formatarKg(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
