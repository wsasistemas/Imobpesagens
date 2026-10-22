// Fase 3: fluxo de recusa via mailto (sem configuração de e-mail transacional ainda).
// Quando o domínio de e-mail for configurado (Cloud → Emails), podemos trocar por
// createServerFn + sendLovableEmail. Por ora, montamos o e-mail e abrimos o cliente.

export type RecusaPayload = {
  para: string;
  cc?: string[];
  assunto: string;
  corpoTexto: string;
};



export function montarPayloadRecusa(args: {
  emailFornecedor: string;
  numeroNota: string;
  placa: string;
  emissor: string;
  obraNome: string;
  pesoNfKg: number | null;
  pesoLiquidoKg: number | null;
  divergenciaKg: number | null;
  observacoes?: string;
  usuarioNome?: string;
}): RecusaPayload {
  const linhas = [
    `Prezados,`,
    ``,
    `Após a dupla pesagem realizada na obra ${args.obraNome}, o peso líquido apurado do carregamento abaixo está abaixo do mínimo aceitável em relação à NF-e. Por isso, a obra destinatária RECUSA o recebimento e solicita a retirada imediata da carga.`,
    ``,
    `• NF nº: ${args.numeroNota || "—"}`,
    `• Emissor: ${args.emissor || "—"}`,
    `• Placa: ${args.placa || "—"}`,
    `• Peso NF: ${args.pesoNfKg != null ? args.pesoNfKg.toLocaleString("pt-BR") + " kg" : "—"}`,
    `• Peso líquido apurado: ${args.pesoLiquidoKg != null ? args.pesoLiquidoKg.toLocaleString("pt-BR") + " kg" : "—"}`,
    `• Divergência: ${args.divergenciaKg != null ? args.divergenciaKg.toLocaleString("pt-BR") + " kg" : "—"}`,
    ``,
    args.observacoes ? `Observações: ${args.observacoes}` : ``,
    ``,
    `Fotos e evidências desta pesagem estão registradas em nosso Portal.`,
    ``,
    `Atenciosamente,`,
    `${args.usuarioNome || "Portaria"} — Obra ${args.obraNome}`,
  ]
    .filter((l) => l !== "")
    .join("\n");

  return {
    para: args.emailFornecedor,
    cc: [],
    assunto: `RECUSA de recebimento — NF ${args.numeroNota || "?"} — ${args.emissor || ""}`.trim(),
    corpoTexto: linhas,
  };
}

export function mailtoUrl(p: RecusaPayload): string {
  const params = new URLSearchParams();
  if (p.cc?.length) params.set("cc", p.cc.join(","));
  params.set("subject", p.assunto);
  params.set("body", p.corpoTexto);
  return `mailto:${encodeURIComponent(p.para)}?${params.toString()}`;
}
