// Botão "Certificado Digital" da Fase 3: lê o certificado A1 (.pfx/.p12) da
// própria máquina, apenas no navegador, e devolve o texto da estampa que sai
// nas informações complementares da nota. Arquivo e senha ficam em memória e
// nunca são enviados nem gravados.
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  aberto: boolean;
  onFechar: () => void;
  onEstampar: (texto: string) => void;
};

type Titular = { titular: string; emissor: string; valido: string };

function textoDoNome(nome: { attributes: { name?: string; shortName?: string; value?: unknown }[] }): string {
  const cn = nome.attributes.find((a) => a.shortName === "CN" || a.name === "commonName");
  return typeof cn?.value === "string" ? cn.value : "—";
}

export function CertificadoDigitalDialog({ aberto, onFechar, onEstampar }: Props) {
  const [senha, setSenha] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [lendo, setLendo] = useState(false);
  const [externo, setExterno] = useState("");

  const limpar = () => {
    setSenha("");
    setArquivo(null);
    setExterno("");
  };

  const ler = async () => {
    if (!arquivo) {
      toast.error("Escolha o arquivo do certificado (.pfx ou .p12).");
      return;
    }
    setLendo(true);
    try {
      const forge = (await import("node-forge")).default;
      const buffer = await arquivo.arrayBuffer();
      const binario = forge.util.createBuffer(new Uint8Array(buffer));
      const asn1 = forge.asn1.fromDer(binario);
      const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);
      const sacos = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
      const cert = sacos.map((s) => s.cert).find((c) => !!c);
      if (!cert) throw new Error("Certificado não encontrado no arquivo.");

      const dados: Titular = {
        titular: textoDoNome(cert.subject),
        emissor: textoDoNome(cert.issuer),
        valido: `${cert.validity.notBefore.toLocaleDateString("pt-BR")} a ${cert.validity.notAfter.toLocaleDateString("pt-BR")}`,
      };
      const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      onEstampar(
        [
          "ASSINADO DIGITALMENTE",
          `Titular: ${dados.titular}`,
          `Emissor do certificado: ${dados.emissor}`,
          `Validade: ${dados.valido}`,
          `Assinatura em: ${agora}`,
        ].join("\n"),
      );
      limpar();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível ler o certificado.";
      toast.error(msg.includes("Invalid password") ? "Senha do certificado incorreta." : msg);
    } finally {
      setLendo(false);
    }
  };

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v) {
          limpar();
          onFechar();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Certificado Digital</DialogTitle>
          <DialogDescription>
            Escolha o certificado da sua máquina (arquivo .pfx ou .p12) e informe a senha. O arquivo e a
            senha são usados só neste momento, para ler os dados do titular — nada fica guardado no sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Arquivo do certificado</Label>
            <Input
              type="file"
              accept=".pfx,.p12"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-2">
            <Label>Senha do certificado</Label>
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="off" />
          </div>
          <Button onClick={ler} disabled={lendo || !arquivo} className="w-full">
            {lendo ? "Lendo certificado…" : "Ler e estampar na nota"}
          </Button>

          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <Label className="text-xs">
              Certificado em token ou cartão (A3)? Cole aqui a identificação da assinatura feita fora do
              sistema.
            </Label>
            <Textarea value={externo} onChange={(e) => setExterno(e.target.value)} rows={3} />
            <Button
              variant="outline"
              size="sm"
              disabled={externo.trim().length < 5}
              onClick={() => {
                const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
                onEstampar(
                  ["ASSINADO DIGITALMENTE (assinatura externa)", externo.trim(), `Registrado em: ${agora}`].join("\n"),
                );
                limpar();
              }}
            >
              Registrar assinatura externa
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
