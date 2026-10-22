import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { documentosQueryOptions, registrarEvento } from "@/lib/sucata/sucata-queries";
import { CLASSE_NUM, TIPOS_DOCUMENTO } from "@/lib/sucata/tipos";
import { formatarDataHora } from "@/lib/sucata/validadores";
import { BUCKETS } from "@/integrations/db-schema";

const BUCKET = BUCKETS.sucataDocumentos;
const MAX_MB = 10;
const TIPOS_ARQUIVO = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export function DocumentosSucateiro({ sucateiroId }: { sucateiroId: string }) {
  const qc = useQueryClient();
  const { data: docs = [] } = useQuery(documentosQueryOptions(sucateiroId));
  const [tipo, setTipo] = useState("CARTAO_CNPJ");
  const [validade, setValidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const enviar = useMutation({
    mutationFn: async (file: File) => {
      if (!TIPOS_ARQUIVO.includes(file.type)) throw new Error("Envie PDF, JPG, PNG ou WEBP.");
      if (file.size > MAX_MB * 1024 * 1024) throw new Error(`Arquivo acima de ${MAX_MB} MB.`);
      const anteriores = docs.filter((d) => d.tipo === tipo && d.vigente);
      if (anteriores.length > 0 && !motivo.trim()) {
        throw new Error("Substituição de documento exige o motivo.");
      }
      const versao = Math.max(0, ...docs.filter((d) => d.tipo === tipo).map((d) => d.versao)) + 1;
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${sucateiroId}/${tipo}/v${versao}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const { error } = await supabase.from("sucata_sucateiro_documentos").insert({
        sucateiro_id: sucateiroId,
        tipo,
        storage_path: path,
        nome_arquivo: file.name,
        validade: validade || null,
        versao,
        motivo_substituicao: anteriores.length > 0 ? motivo.trim() : null,
        vigente: true,
      });
      if (error) throw error;
      // Versões anteriores deixam de ser vigentes, mas nunca são apagadas.
      for (const a of anteriores) {
        await supabase.from("sucata_sucateiro_documentos").update({ vigente: false }).eq("id", a.id);
      }
      await registrarEvento({
        entidade: "sucateiro_documento",
        entidadeId: sucateiroId,
        acao: anteriores.length > 0 ? "documento_substituido" : "documento_anexado",
        payload: { tipo, versao, motivo: motivo.trim() || null },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sucata", "documentos", sucateiroId] });
      setMotivo("");
      setValidade("");
      if (inputRef.current) inputRef.current.value = "";
      toast.success("Documento anexado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const baixar = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error || !data) { toast.error("Não foi possível abrir o documento."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <Label className="mb-1 block text-xs">Tipo de documento</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS_DOCUMENTO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 block text-xs">Validade (opcional)</Label>
          <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className={CLASSE_NUM} />
        </div>
        <div>
          <Label className="mb-1 block text-xs">Motivo da substituição</Label>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Obrigatório ao substituir" />
        </div>
        <div className="flex items-end">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) enviar.mutate(file); }}
          />
          <Button className="w-full" onClick={() => inputRef.current?.click()} disabled={enviar.isPending}>
            <FileUp className="mr-2 h-4 w-4" />
            {enviar.isPending ? "Enviando..." : "Anexar"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-left">Arquivo</th>
              <th className="p-2 text-left">Versão</th>
              <th className="p-2 text-left">Validade</th>
              <th className="p-2 text-left">Enviado em</th>
              <th className="p-2 text-left">Situação</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 && (
              <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Nenhum documento anexado.</td></tr>
            )}
            {docs.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="p-2">{TIPOS_DOCUMENTO.find((t) => t.value === d.tipo)?.label ?? d.tipo}</td>
                <td className="p-2">{d.nome_arquivo ?? "—"}</td>
                <td className={`p-2 ${CLASSE_NUM}`}>{d.versao}</td>
                <td className={`p-2 ${CLASSE_NUM}`}>
                  {d.validade ? new Date(`${d.validade}T12:00:00`).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className={`p-2 ${CLASSE_NUM}`}>{formatarDataHora(d.created_at)}</td>
                <td className="p-2">
                  <Badge variant="outline" className={d.vigente
                    ? "border-success/30 bg-success-soft text-success"
                    : "border-warning/30 bg-warning-soft text-warning"}>
                    {d.vigente ? "Vigente" : "Substituído"}
                  </Badge>
                </td>
                <td className="p-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => baixar(d.storage_path)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
