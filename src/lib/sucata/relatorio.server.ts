// Servidor: envio do relatório fotográfico por e-mail, com o PDF anexado.
// Nunca importado por componentes — só por *.functions.ts.

const FROM = "Portal de Pesagem <nao-responda@imobsystems.com.br>";

/** Escapa texto antes de interpolar em HTML de e-mail. */
export function esc(valor: unknown): string {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function htmlRelatorio(p: {
  numero: string;
  obra: string;
  tipo: string;
  pesoKg: string;
  valor: string;
  data: string;
  versao: number;
}): { assunto: string; html: string; texto: string } {
  const assunto = `Relatório fotográfico — processo ${p.numero}`;
  const linhas: [string, string][] = [
    ["Obra", p.obra],
    ["Material", p.tipo],
    ["Peso aferido", p.pesoKg],
    ["Valor da coleta", p.valor],
    ["Data da coleta", p.data],
    ["Versão do relatório", String(p.versao)],
  ];
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1f2937">
    <h2 style="color:#B0202E;margin:0 0 4px">Relatório fotográfico do processo ${esc(p.numero)}</h2>
    <p style="margin:0 0 16px;font-size:14px">Documento gerado automaticamente pelo Portal de Pesagem. O arquivo em PDF segue anexo.</p>
    <table cellpadding="6" style="border-collapse:collapse;font-size:14px">
      ${linhas
        .map(
          ([r, v]) =>
            `<tr><td style="border:1px solid #e5e7eb;background:#f9fafb"><strong>${esc(r)}</strong></td><td style="border:1px solid #e5e7eb">${esc(v)}</td></tr>`,
        )
        .join("")}
    </table>
    <p style="margin-top:16px;font-size:12px;color:#6b7280">Processo encerrado. Não é necessário responder este e-mail.</p>
  </body></html>`;
  const texto = `Relatório fotográfico do processo ${p.numero}\n${linhas.map(([r, v]) => `${r}: ${v}`).join("\n")}\nPDF em anexo.`;
  return { assunto, html, texto };
}

/** Envia e-mail com anexo pelo conector Resend. */
export async function enviarEmailComAnexo(params: {
  para: string[];
  assunto: string;
  html: string;
  texto: string;
  anexo: { filename: string; contentBase64: string };
}): Promise<{ id: string }> {
  // Resend direto (fora do Lovable não existe o gateway connector-gateway.lovable.dev).
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) throw new Error("RESEND_API_KEY não configurada.");

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: params.para,
      subject: params.assunto,
      html: params.html,
      text: params.texto,
      attachments: [{ filename: params.anexo.filename, content: params.anexo.contentBase64 }],
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Falha no envio (${resp.status}): ${txt.slice(0, 200)}`);
  }
  const json = (await resp.json()) as { id?: string };
  return { id: json.id ?? "" };
}
