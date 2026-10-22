import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BUCKETS } from "@/integrations/db-schema";

const anexoSchema = z.object({
  filename: z.string().min(1).max(200),
  storage_path: z.string().min(1).max(500),
});

export const enviarEmailResend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        para: z.array(z.string().email()).min(1).max(20),
        cc: z.array(z.string().email()).max(20).optional(),
        assunto: z.string().min(1).max(300),
        corpoTexto: z.string().min(1).max(50000),
        replyTo: z.string().email().optional(),
        anexos: z.array(anexoSchema).max(10).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { enviarEmailComAnexos, enviarEmailViaGateway } = await import("@/lib/email/resend.server");

    const baixarAnexo = async (storagePath: string): Promise<{ filename: string; content: string } | null> => {
      const { data: blob, error } = await context.supabase.storage
        .from(BUCKETS.evidencias)
        .download(storagePath);
      if (error || !blob) return null;
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.byteLength; i++) bin += String.fromCharCode(buf[i]);
      const b64 = btoa(bin);
      const filename = data.anexos?.find((a) => a.storage_path === storagePath)?.filename ?? "anexo";
      return { filename, content: b64 };
    };

    if (data.anexos && data.anexos.length > 0) {
      return enviarEmailComAnexos(data, baixarAnexo);
    }
    return enviarEmailViaGateway(data);
  });
