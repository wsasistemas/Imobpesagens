// Chave canônica de contato WhatsApp: só dígitos, sempre com o DDI 55.
// Envios (digitados com DDD) e respostas (chegam com 55) precisam cair na mesma conversa.
export function soDigitos(v: string | null | undefined): string {
  return String(v ?? "").replace(/\D/g, "");
}

export function chaveContatoWhatsApp(raw: string | null | undefined): string {
  const d = soDigitos(raw);
  if (!d) return "";
  // DDD + número (10 ou 11 dígitos) → prefixa o país. Números maiores já vêm com DDI.
  return d.length <= 11 ? `55${d}` : d;
}

/** Variantes aceitas na consulta, para alcançar mensagens antigas gravadas sem o 55. */
export function variantesContatoWhatsApp(raw: string | null | undefined): string[] {
  const chave = chaveContatoWhatsApp(raw);
  if (!chave) return [];
  const semPais = chave.startsWith("55") && chave.length >= 12 ? chave.slice(2) : null;
  return semPais ? [chave, semPais] : [chave];
}
