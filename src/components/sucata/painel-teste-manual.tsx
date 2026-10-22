// Painel de preenchimento manual (teste do fluxo) — visível só para Admin/TI.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CLASSE_NUM } from "@/lib/sucata/tipos";
import { salvarProcessoManual } from "@/lib/sucata/teste-manual.functions";

type Estado = {
  tara_kg: string;
  bruto_kg: string;
  peso_deposito_kg: string;
  saida_em: string;
  aceite_em: string;
  valor_total: string;
  recibo_modo: string;
  pagamento_valor: string;
  pagamento_data: string;
  aprovado_em: string;
  aprovacao_observacao: string;
  nfa_numero: string;
  nfa_emissao: string;
  concluido_em: string;
  fase: string;
};

const VAZIO: Estado = {
  tara_kg: "", bruto_kg: "", peso_deposito_kg: "", saida_em: "", aceite_em: "",
  valor_total: "", recibo_modo: "", pagamento_valor: "", pagamento_data: "",
  aprovado_em: "", aprovacao_observacao: "", nfa_numero: "", nfa_emissao: "",
  concluido_em: "", fase: "",
};

/**
 * Aceita "1.500,50", "1500,50" e "1500.50": o ÚLTIMO separador (vírgula ou ponto)
 * é o decimal; os demais são milhar. Exceção pt-BR: um único ponto seguido de
 * exatamente 3 dígitos e sem vírgula ("1.500") é milhar.
 */
function num(v: string): number | undefined {
  const s = v.trim();
  if (s === "") return undefined;
  const ultimoSep = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  const milharBr = /^\d{1,3}(\.\d{3})+$/.test(s);
  let normalizado: string;
  if (ultimoSep < 0 || milharBr) {
    normalizado = s.replace(/\D/g, "");
  } else {
    const inteiro = s.slice(0, ultimoSep).replace(/\D/g, "");
    const decimal = s.slice(ultimoSep + 1).replace(/\D/g, "");
    normalizado = `${inteiro || "0"}.${decimal || "0"}`;
  }
  const n = Number(normalizado);
  return !Number.isFinite(n) || n <= 0 ? undefined : n;
}
function dataHora(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
function texto(v: string): string | undefined {
  return v.trim() === "" ? undefined : v.trim();
}

export function PainelTesteManual({ processoId }: { processoId: string }) {
  const [f, setF] = useState<Estado>(VAZIO);
  const qc = useQueryClient();
  const salvar = useServerFn(salvarProcessoManual);
  const set = (k: keyof Estado, v: string) => setF((a) => ({ ...a, [k]: v }));

  const mut = useMutation({
    mutationFn: async () => {
      const campos = {
        tara_kg: num(f.tara_kg),
        bruto_kg: num(f.bruto_kg),
        peso_deposito_kg: num(f.peso_deposito_kg),
        saida_em: dataHora(f.saida_em),
        aceite_em: dataHora(f.aceite_em),
        valor_total: num(f.valor_total),
        recibo_modo: (texto(f.recibo_modo) as "SISTEMA" | "PROPRIO" | undefined) ?? undefined,
        pagamento_valor: num(f.pagamento_valor),
        pagamento_data: texto(f.pagamento_data),
        aprovado_em: dataHora(f.aprovado_em),
        aprovacao_observacao: texto(f.aprovacao_observacao),
        nfa_numero: texto(f.nfa_numero),
        nfa_emissao: texto(f.nfa_emissao),
        concluido_em: dataHora(f.concluido_em),
        fase: texto(f.fase),
      };
      const limpos = Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== undefined));
      if (Object.keys(limpos).length === 0) throw new Error("Preencha ao menos um campo.");
      return salvar({ data: { processoId, campos: limpos } });
    },
    onSuccess: (r) => {
      toast.success(`Valores de teste gravados (${r.aplicados.length} campo(s)).`);
      setF(VAZIO);
      qc.invalidateQueries({ queryKey: ["sucata"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="border-warning/30 bg-warning-soft/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-heading text-base text-warning">
          <FlaskConical className="h-4 w-4" /> Preenchimento manual (teste do fluxo)
        </CardTitle>
        <p className="text-xs text-warning/80">
          Só para Administrador e TI. Preencha o que quiser testar — o processo fica marcado como
          teste e cada gravação entra no histórico. Deixe em branco o que não quer alterar.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Campo rotulo="Tara (kg)" valor={f.tara_kg} onChange={(v) => set("tara_kg", v)} mono />
        <Campo rotulo="Bruto (kg)" valor={f.bruto_kg} onChange={(v) => set("bruto_kg", v)} mono />
        <Campo rotulo="Balança do depósito (kg)" valor={f.peso_deposito_kg} onChange={(v) => set("peso_deposito_kg", v)} mono />
        <Campo rotulo="Saída em" tipo="datetime-local" valor={f.saida_em} onChange={(v) => set("saida_em", v)} />
        <Campo rotulo="Peso aceito em" tipo="datetime-local" valor={f.aceite_em} onChange={(v) => set("aceite_em", v)} />
        <Campo rotulo="Valor total (R$)" valor={f.valor_total} onChange={(v) => set("valor_total", v)} mono />
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Recibo</Label>
          <Select value={f.recibo_modo} onValueChange={(v) => set("recibo_modo", v)}>
            <SelectTrigger><SelectValue placeholder="Não alterar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="SISTEMA">Recibo do sistema</SelectItem>
              <SelectItem value="PROPRIO">Recibo próprio do comprador</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Campo rotulo="Pagamento (R$)" valor={f.pagamento_valor} onChange={(v) => set("pagamento_valor", v)} mono />
        <Campo rotulo="Data do pagamento" tipo="date" valor={f.pagamento_data} onChange={(v) => set("pagamento_data", v)} />
        <Campo rotulo="Aprovado em" tipo="datetime-local" valor={f.aprovado_em} onChange={(v) => set("aprovado_em", v)} />
        <Campo rotulo="Observação da aprovação" valor={f.aprovacao_observacao} onChange={(v) => set("aprovacao_observacao", v)} />
        <Campo rotulo="Número da NFA" valor={f.nfa_numero} onChange={(v) => set("nfa_numero", v)} mono />
        <Campo rotulo="Emissão da NFA" tipo="date" valor={f.nfa_emissao} onChange={(v) => set("nfa_emissao", v)} />
        <Campo rotulo="Concluído em" tipo="datetime-local" valor={f.concluido_em} onChange={(v) => set("concluido_em", v)} />
        <Campo rotulo="Fase (ex.: F08)" valor={f.fase} onChange={(v) => set("fase", v.toUpperCase())} mono />
        <div className="sm:col-span-2 lg:col-span-3">
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Gravando..." : "Gravar valores de teste"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Campo({
  rotulo, valor, onChange, tipo = "text", mono,
}: { rotulo: string; valor: string; onChange: (v: string) => void; tipo?: string; mono?: boolean }) {
  return (
    <div>
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</Label>
      <Input
        type={tipo}
        inputMode={mono ? "decimal" : undefined}
        placeholder={mono ? "ex.: 1.500,50" : undefined}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={mono ? CLASSE_NUM : ""}
      />
    </div>
  );
}
