import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { obrasQueryOptions } from "@/lib/pesagem-queries";
import { salvarSucateiro, sucateirosQueryOptions } from "@/lib/sucata/sucata-queries";
import {
  CLASSE_NUM, ROTULO_SITUACAO_SUCATEIRO, TIPOS_CONTA, TITULARIDADES, UFS,
  type SucateiroRow,
} from "@/lib/sucata/tipos";
import {
  formatarCep, formatarCnpjSucata, formatarCpf, soDigitos, validarCnpj, validarCpf,
} from "@/lib/sucata/validadores";
import { useBuscaCep } from "@/hooks/useBuscaCep";

type Form = {
  tipo_pessoa: "PJ" | "PF";
  razao_social: string; nome_fantasia: string; inscricao_estadual: string;
  inscricao_municipal: string; cnae: string; cnpj: string;
  nome_completo: string; cpf: string; rg: string; orgao_emissor: string; data_nascimento: string;
  cep: string; logradouro: string; numero: string; complemento: string;
  bairro: string; municipio: string; uf: string;
  email_coleta: string; email_financeiro: string; telefone: string; contato_responsavel: string;
  banco: string; agencia: string; conta: string; tipo_conta: string; titularidade: string; chave_pix: string;
  valor_por_kg: string;
  situacao: string; observacoes: string; coligada_origem: string;
};

const VAZIO: Form = {
  tipo_pessoa: "PJ",
  razao_social: "", nome_fantasia: "", inscricao_estadual: "", inscricao_municipal: "", cnae: "", cnpj: "",
  nome_completo: "", cpf: "", rg: "", orgao_emissor: "", data_nascimento: "",
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", municipio: "", uf: "",
  email_coleta: "", email_financeiro: "", telefone: "", contato_responsavel: "",
  banco: "", agencia: "", conta: "", tipo_conta: "Corrente", titularidade: "Própria", chave_pix: "",
  valor_por_kg: "",
  situacao: "EM_HOMOLOGACAO", observacoes: "", coligada_origem: "",
};

/** Lê "1,25" ou "1.25" como 1,25 reais por quilo. */
function lerValorKg(txt: string): number | null {
  const limpo = txt.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10000) / 10000 : null;
}

export function FormSucateiro({
  aberto, onOpenChange, registro,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  registro?: SucateiroRow | null;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: obras = [] } = useQuery(obrasQueryOptions(user?.id));
  const { data: existentes = [] } = useQuery(sucateirosQueryOptions());
  const [f, setF] = useState<Form>(VAZIO);

  const coligadas = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of obras) if (o.coligada) m.set(o.coligada, o.nome);
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [obras]);

  useEffect(() => {
    if (!aberto) return;
    if (registro) {
      setF({
        tipo_pessoa: registro.tipo_pessoa as "PJ" | "PF",
        razao_social: registro.razao_social ?? "", nome_fantasia: registro.nome_fantasia ?? "",
        inscricao_estadual: registro.inscricao_estadual ?? "", inscricao_municipal: registro.inscricao_municipal ?? "",
        cnae: registro.cnae ?? "", cnpj: registro.cnpj ?? "",
        nome_completo: registro.nome_completo ?? "", cpf: registro.cpf ?? "", rg: registro.rg ?? "",
        orgao_emissor: registro.orgao_emissor ?? "", data_nascimento: registro.data_nascimento ?? "",
        cep: registro.cep, logradouro: registro.logradouro, numero: registro.numero,
        complemento: registro.complemento ?? "", bairro: registro.bairro,
        municipio: registro.municipio, uf: registro.uf,
        email_coleta: registro.email_coleta, email_financeiro: registro.email_financeiro ?? "",
        telefone: registro.telefone, contato_responsavel: registro.contato_responsavel ?? "",
        banco: registro.banco, agencia: registro.agencia, conta: registro.conta,
        tipo_conta: registro.tipo_conta, titularidade: registro.titularidade, chave_pix: registro.chave_pix ?? "",
        valor_por_kg:
          registro.valor_por_kg === null || registro.valor_por_kg === undefined
            ? ""
            : String(registro.valor_por_kg).replace(".", ","),
        situacao: registro.situacao, observacoes: registro.observacoes ?? "",
        coligada_origem: registro.coligada_origem,
      });
    } else {
      setF({ ...VAZIO, coligada_origem: coligadas[0]?.[0] ?? "" });
    }
  }, [aberto, registro, coligadas]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const pj = f.tipo_pessoa === "PJ";

  // Busca de endereço pelo CEP: só dispara quando o usuário mexe no campo.
  const [cepTocado, setCepTocado] = useState(false);
  const numeroRef = useRef<HTMLInputElement>(null);
  const cepAplicado = useRef<string>("");
  const { buscando, endereco, naoEncontrado, falhou } = useBuscaCep(f.cep, cepTocado);

  useEffect(() => {
    if (!aberto) return;
    setCepTocado(false);
    cepAplicado.current = "";
  }, [aberto, registro]);

  useEffect(() => {
    if (!cepTocado || !endereco?.encontrado) return;
    if (cepAplicado.current === endereco.cep) return;
    cepAplicado.current = endereco.cep;
    setF((p) => ({
      ...p,
      logradouro: endereco.logradouro || p.logradouro,
      bairro: endereco.bairro || p.bairro,
      municipio: endereco.municipio || p.municipio,
      uf: endereco.uf || p.uf,
    }));
    numeroRef.current?.focus();
  }, [cepTocado, endereco]);

  const docDuplicado = useMemo(() => {
    const doc = pj ? soDigitos(f.cnpj) : soDigitos(f.cpf);
    if (!doc) return null;
    return existentes.find(
      (s) => s.id !== registro?.id && soDigitos((pj ? s.cnpj : s.cpf) ?? "") === doc,
    ) ?? null;
  }, [existentes, f.cnpj, f.cpf, pj, registro?.id]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!f.coligada_origem) throw new Error("Selecione a coligada de origem.");
      if (pj) {
        if (!f.razao_social.trim()) throw new Error("Razão social é obrigatória para PJ.");
        if (!validarCnpj(f.cnpj)) throw new Error("CNPJ inválido.");
        if (!f.inscricao_estadual.trim()) throw new Error("Inscrição estadual é obrigatória para PJ.");
      } else {
        if (!f.nome_completo.trim()) throw new Error("Nome completo é obrigatório para PF.");
        if (!validarCpf(f.cpf)) throw new Error("CPF inválido.");
        if (!f.rg.trim()) throw new Error("RG é obrigatório para PF.");
      }
      if (docDuplicado) throw new Error("Documento já cadastrado para outro sucateiro.");
      for (const [campo, rotulo] of [
        ["cep", "CEP"], ["logradouro", "Logradouro"], ["numero", "Número"], ["bairro", "Bairro"],
        ["municipio", "Município"], ["uf", "UF"], ["email_coleta", "E-mail de coleta"],
        ["telefone", "Telefone"], ["banco", "Banco"], ["agencia", "Agência"], ["conta", "Conta"],
      ] as const) {
        if (!String(f[campo]).trim()) throw new Error(`${rotulo} é obrigatório.`);
      }
      const valorKg = lerValorKg(f.valor_por_kg);
      if (f.situacao === "ATIVO" && valorKg === null) {
        throw new Error("Informe o valor por quilo da sucata para deixar o sucateiro ATIVO.");
      }
      return salvarSucateiro(
        {
          tipo_pessoa: f.tipo_pessoa,
          razao_social: pj ? f.razao_social.trim() : null,
          nome_fantasia: pj ? f.nome_fantasia.trim() || null : null,
          inscricao_estadual: pj ? f.inscricao_estadual.trim() : null,
          inscricao_municipal: pj ? f.inscricao_municipal.trim() || null : null,
          cnae: pj ? f.cnae.trim() || null : null,
          cnpj: pj ? soDigitos(f.cnpj) : null,
          nome_completo: pj ? null : f.nome_completo.trim(),
          cpf: pj ? null : soDigitos(f.cpf),
          rg: pj ? null : f.rg.trim(),
          orgao_emissor: pj ? null : f.orgao_emissor.trim() || null,
          data_nascimento: pj ? null : f.data_nascimento || null,
          cep: soDigitos(f.cep), logradouro: f.logradouro.trim(), numero: f.numero.trim(),
          complemento: f.complemento.trim() || null, bairro: f.bairro.trim(),
          municipio: f.municipio.trim(), uf: f.uf,
          email_coleta: f.email_coleta.trim(), email_financeiro: f.email_financeiro.trim() || null,
          telefone: f.telefone.trim(), contato_responsavel: f.contato_responsavel.trim() || null,
          banco: f.banco.trim(), agencia: f.agencia.trim(), conta: f.conta.trim(),
          tipo_conta: f.tipo_conta, titularidade: f.titularidade,
          chave_pix: f.chave_pix.trim() || null,
          valor_por_kg: valorKg,
          situacao: f.situacao, observacoes: f.observacoes.trim() || null,
          coligada_origem: f.coligada_origem,
          created_by: registro ? undefined : user?.id ?? null,
        },
        registro?.id ?? null,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sucata"] });
      toast.success(registro ? "Sucateiro atualizado." : "Sucateiro cadastrado.");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const desabilitadoPJ = !pj ? "Não se aplica a pessoa física" : undefined;
  const desabilitadoPF = pj ? "Não se aplica a pessoa jurídica" : undefined;

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {registro ? "Editar sucateiro" : "Novo sucateiro"}
          </DialogTitle>
          <DialogDescription>
            Cadastro prévio obrigatório. O sucateiro só participa da pesagem quando estiver ATIVO.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label className="mb-1 block text-xs">Tipo de pessoa</Label>
              <Tabs value={f.tipo_pessoa} onValueChange={(v) => set("tipo_pessoa", v as "PJ" | "PF")}>
                <TabsList>
                  <TabsTrigger value="PJ">Pessoa jurídica</TabsTrigger>
                  <TabsTrigger value="PF">Pessoa física</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="min-w-52">
              <Label className="mb-1 block text-xs">Coligada de origem</Label>
              <Select value={f.coligada_origem} onValueChange={(v) => set("coligada_origem", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {coligadas.map(([cod, nome]) => (
                    <SelectItem key={cod} value={cod}>
                      <span className={CLASSE_NUM}>{cod}</span> — {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-44">
              <Label className="mb-1 block text-xs">Situação</Label>
              <Select value={f.situacao} onValueChange={(v) => set("situacao", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROTULO_SITUACAO_SUCATEIRO).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {docDuplicado && (
            <Alert className="border-primary-dark/30 bg-primary-dark/5">
              <AlertDescription className="text-sm">
                {pj ? "CNPJ" : "CPF"} já cadastrado em{" "}
                <strong>{docDuplicado.razao_social ?? docDuplicado.nome_completo}</strong>.{" "}
                <button
                  type="button"
                  className="underline font-medium"
                  onClick={() => {
                    onOpenChange(false);
                    window.dispatchEvent(new CustomEvent("sucata:abrir-sucateiro", { detail: docDuplicado.id }));
                  }}
                >
                  Abrir cadastro existente
                </button>
              </AlertDescription>
            </Alert>
          )}

          <section className="grid gap-3 md:grid-cols-3">
            <Campo label="Razão social" valor={f.razao_social} onChange={(v) => set("razao_social", v)}
              disabled={!pj} dica={desabilitadoPJ} className="md:col-span-2" />
            <Campo label="Nome fantasia" valor={f.nome_fantasia} onChange={(v) => set("nome_fantasia", v)}
              disabled={!pj} dica={desabilitadoPJ} />
            <Campo label="CNPJ" valor={formatarCnpjSucata(f.cnpj)} onChange={(v) => set("cnpj", v)}
              disabled={!pj} dica={desabilitadoPJ} mono />
            <Campo label="Inscrição estadual" valor={f.inscricao_estadual} onChange={(v) => set("inscricao_estadual", v)}
              disabled={!pj} dica={desabilitadoPJ} mono />
            <Campo label="Inscrição municipal" valor={f.inscricao_municipal} onChange={(v) => set("inscricao_municipal", v)}
              disabled={!pj} dica={desabilitadoPJ} mono />
            <Campo label="CNAE" valor={f.cnae} onChange={(v) => set("cnae", v)} disabled={!pj} dica={desabilitadoPJ} mono />

            <Campo label="Nome completo" valor={f.nome_completo} onChange={(v) => set("nome_completo", v)}
              disabled={pj} dica={desabilitadoPF} className="md:col-span-2" />
            <Campo label="CPF" valor={formatarCpf(f.cpf)} onChange={(v) => set("cpf", v)}
              disabled={pj} dica={desabilitadoPF} mono />
            <Campo label="RG" valor={f.rg} onChange={(v) => set("rg", v)} disabled={pj} dica={desabilitadoPF} mono />
            <Campo label="Órgão emissor" valor={f.orgao_emissor} onChange={(v) => set("orgao_emissor", v)}
              disabled={pj} dica={desabilitadoPF} />
            <div>
              <Label className="mb-1 block text-xs">Data de nascimento</Label>
              <Input type="date" value={f.data_nascimento} disabled={pj}
                onChange={(e) => set("data_nascimento", e.target.value)} className={CLASSE_NUM} />
              {pj && <p className="mt-1 text-[11px] text-muted-foreground">{desabilitadoPF}</p>}
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            <div>
              <Label className="mb-1 block text-xs">CEP</Label>
              <div className="flex gap-2">
                <Input
                  value={formatarCep(f.cep)}
                  inputMode="numeric"
                  placeholder="00000-000"
                  onChange={(e) => {
                    setCepTocado(true);
                    set("cep", soDigitos(e.target.value).slice(0, 8));
                  }}
                  className={CLASSE_NUM}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Buscar endereço pelo CEP"
                  onClick={() => {
                    cepAplicado.current = "";
                    setCepTocado(true);
                  }}
                  disabled={soDigitos(f.cep).length !== 8 || buscando}
                >
                  {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              {buscando && <p className="mt-1 text-[11px] text-muted-foreground">Buscando endereço...</p>}
              {!buscando && cepTocado && (naoEncontrado || falhou) && (
                <p className="mt-1 text-[11px] text-warning">
                  CEP não encontrado — preencha o endereço manualmente.
                </p>
              )}
            </div>
            <Campo label="Logradouro" valor={f.logradouro} onChange={(v) => set("logradouro", v)}
              disabled={buscando} className="md:col-span-2" />
            <div>
              <Label className="mb-1 block text-xs">Número</Label>
              <Input
                ref={numeroRef}
                value={f.numero}
                onChange={(e) => set("numero", e.target.value)}
                className={CLASSE_NUM}
              />
            </div>
            <Campo label="Complemento" valor={f.complemento} onChange={(v) => set("complemento", v)} />
            <Campo label="Bairro" valor={f.bairro} onChange={(v) => set("bairro", v)} disabled={buscando} />
            <Campo label="Município" valor={f.municipio} onChange={(v) => set("municipio", v)} disabled={buscando} />
            <div>
              <Label className="mb-1 block text-xs">UF</Label>
              <Select value={f.uf} onValueChange={(v) => set("uf", v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            <Campo label="E-mail de coleta" valor={f.email_coleta} onChange={(v) => set("email_coleta", v)} />
            <Campo label="E-mail financeiro" valor={f.email_financeiro} onChange={(v) => set("email_financeiro", v)} />
            <Campo label="Telefone" valor={f.telefone} onChange={(v) => set("telefone", v)} mono />
            <Campo label="Contato responsável" valor={f.contato_responsavel} onChange={(v) => set("contato_responsavel", v)} />
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            <Campo label="Banco" valor={f.banco} onChange={(v) => set("banco", v)} />
            <Campo label="Agência" valor={f.agencia} onChange={(v) => set("agencia", v)} mono />
            <Campo label="Conta" valor={f.conta} onChange={(v) => set("conta", v)} mono />
            <div>
              <Label className="mb-1 block text-xs">Tipo de conta</Label>
              <Select value={f.tipo_conta} onValueChange={(v) => set("tipo_conta", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_CONTA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Titularidade</Label>
              <Select value={f.titularidade} onValueChange={(v) => set("titularidade", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TITULARIDADES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Campo label="Chave PIX" valor={f.chave_pix} onChange={(v) => set("chave_pix", v)} className="md:col-span-3" mono />
          </section>

          <section className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-56">
                <Label className="mb-1 block text-sm font-semibold text-primary">
                  Valor por quilo da sucata (R$/kg)
                </Label>
                <Input
                  value={f.valor_por_kg}
                  inputMode="decimal"
                  placeholder="0,0000"
                  onChange={(e) => set("valor_por_kg", e.target.value.replace(/[^\d.,]/g, ""))}
                  className={`${CLASSE_NUM} h-11 text-lg font-semibold`}
                />
              </div>
              <p className="max-w-md text-xs text-muted-foreground">
                O sistema multiplica este valor pelo peso aferido para calcular o valor a pagar pela coleta.
                Obrigatório para deixar o sucateiro ATIVO. A mudança vale apenas para coletas futuras.
              </p>
            </div>
          </section>


          <div>
            <Label className="mb-1 block text-xs">Observações</Label>
            <Textarea value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  label, valor, onChange, disabled, dica, mono, className,
}: {
  label: string; valor: string; onChange: (v: string) => void;
  disabled?: boolean; dica?: string; mono?: boolean; className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs">{label}</Label>
      <Input
        value={valor}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={mono ? CLASSE_NUM : undefined}
      />
      {disabled && dica && <p className="mt-1 text-[11px] text-muted-foreground">{dica}</p>}
    </div>
  );
}
