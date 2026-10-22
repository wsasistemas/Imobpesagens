import type { OcorrenciaPayload } from "@/lib/ocorrencia";

export type AnexoEmail = {
  filename: string;
  storage_path: string;
};

export type EmailResendParams = {
  para: string[];
  cc?: string[];
  assunto: string;
  corpoTexto: string;
  replyTo?: string;
  anexos?: AnexoEmail[];
};

const FROM_DEFAULT = "Portal de Pesagem <nao-responda@imobsystems.com.br>";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function enviarEmailViaGateway(params: EmailResendParams): Promise<{ id: string }> {
  // Resend direto (fora do Lovable não existe o gateway connector-gateway.lovable.dev).
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) throw new Error("RESEND_API_KEY não configurada.");

  const blocos = params.corpoTexto.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const htmlBlocos = blocos
    .map((bloco) => {
      const linhas = bloco.split("\n").filter((l) => l.length > 0);
      if (linhas.length === 0) return "";
      const todasBullet = linhas.every((l) => /^\s*•\s+/.test(l));
      if (todasBullet) {
        const itens = linhas
          .map((l) => l.replace(/^\s*•\s+/, ""))
          .map(
            (t) =>
              `<li style="margin:0 0 4px 0;padding-left:14px;text-indent:-14px">• ${escapeHtml(t)}</li>`,
          )
          .join("");
        return `<ul style="margin:0 0 14px 0;padding:0;list-style:none">${itens}</ul>`;
      }
      const conteudo = linhas.map((l) => escapeHtml(l)).join("<br>");
      return `<p style="margin:0 0 14px 0">${conteudo}</p>`;
    })
    .join("");

  const htmlBody = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#334155;max-width:640px">${htmlBlocos}</div>`;

  const body: Record<string, unknown> = {
    from: FROM_DEFAULT,
    to: params.para,
    subject: params.assunto,
    text: params.corpoTexto,
    html: htmlBody,
  };
  if (params.cc && params.cc.length > 0) body.cc = params.cc;
  if (params.replyTo) body.reply_to = params.replyTo;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Resend ${resp.status}: ${errText.slice(0, 400)}`);
  }
  const json = (await resp.json()) as { id?: string };
  return { id: json.id ?? "" };
}

export async function enviarEmailComAnexos(
  params: EmailResendParams,
  baixarAnexo: (path: string) => Promise<{ filename: string; content: string } | null>,
): Promise<{ id: string }> {
  // Resend direto (fora do Lovable não existe o gateway connector-gateway.lovable.dev).
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) throw new Error("RESEND_API_KEY não configurada.");

  const attachments: Array<{ filename: string; content: string }> = [];
  for (const a of params.anexos ?? []) {
    const anexo = await baixarAnexo(a.storage_path);
    if (anexo) attachments.push(anexo);
  }

  const blocos = params.corpoTexto.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const htmlBlocos = blocos
    .map((bloco) => {
      const linhas = bloco.split("\n").filter((l) => l.length > 0);
      if (linhas.length === 0) return "";
      const todasBullet = linhas.every((l) => /^\s*•\s+/.test(l));
      if (todasBullet) {
        const itens = linhas
          .map((l) => l.replace(/^\s*•\s+/, ""))
          .map(
            (t) =>
              `<li style="margin:0 0 4px 0;padding-left:14px;text-indent:-14px">• ${escapeHtml(t)}</li>`,
          )
          .join("");
        return `<ul style="margin:0 0 14px 0;padding:0;list-style:none">${itens}</ul>`;
      }
      const conteudo = linhas.map((l) => escapeHtml(l)).join("<br>");
      return `<p style="margin:0 0 14px 0">${conteudo}</p>`;
    })
    .join("");

  const htmlBody = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#334155;max-width:640px">${htmlBlocos}</div>`;

  const body: Record<string, unknown> = {
    from: FROM_DEFAULT,
    to: params.para,
    subject: params.assunto,
    text: params.corpoTexto,
    html: htmlBody,
  };
  if (params.cc && params.cc.length > 0) body.cc = params.cc;
  if (params.replyTo) body.reply_to = params.replyTo;
  if (attachments.length > 0) body.attachments = attachments;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Resend ${resp.status}: ${errText.slice(0, 400)}`);
  }
  const json = (await resp.json()) as { id?: string };
  return { id: json.id ?? "" };
}
