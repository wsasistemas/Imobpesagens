import { createFileRoute } from '@tanstack/react-router';
import { Recycle, AlertTriangle, Lightbulb, Printer, HelpCircle } from "lucide-react";

export const Route = createFileRoute('/documentacao/sucata')({
  head: () => ({
    meta: [
      { title: "Manual do Processo de Sucata — Portal de Pesagem" },
      { name: "description", content: "Passo a passo das 4 fases do processo de sucata: entrada, saída, Nota Fiscal Avulsa e encerramento com relatório fotográfico." },
      { property: "og:title", content: "Manual do Processo de Sucata — Portal de Pesagem" },
      { property: "og:description", content: "Guia operacional completo do módulo de sucata para o usuário final." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManualSucata,
});

type Fase = {
  numero: number;
  titulo: string;
  responsavel: string;
  passos: string[];
  aviso?: string;
};

const FASES: Fase[] = [
  {
    numero: 1,
    titulo: "Entrada do caminhão vazio",
    responsavel: "Operador de balança",
    passos: [
      "Acesse o menu Sucata e clique em Novo Processo.",
      "Selecione a Obra e o Sucateiro credenciado (precisa estar ativo e com valor por quilo cadastrado).",
      "Informe a placa do caminhão ou use a leitura automática.",
      "Foto 001 — fotografe o caminhão vazio sobre a balança rodoviária.",
      "Foto 002 — fotografe a frente do caminhão com a placa legível; o sistema reconhece os caracteres e sugere a placa.",
      "Com o caminhão na balança, clique em Capturar Peso para registrar a tara.",
      "Clique em Salvar Entrada. O sistema gera o número oficial do processo (ex.: SUC-0008/2026).",
    ],
    aviso:
      "A placa reconhecida na foto da frente deve coincidir com a placa informada. Em caso de divergência, confira a nitidez da foto antes de prosseguir.",
  },
  {
    numero: 2,
    titulo: "Saída do caminhão carregado e solicitação da nota",
    responsavel: "Operador de balança e Administrativo de Obra",
    passos: [
      "Quando o carregamento terminar, abra o processo na listagem de Sucata.",
      "Foto 004 — fotografe a caçamba carregada sobre a balança.",
      "Posicione o caminhão na balança e capture o peso bruto.",
      "O sistema calcula sozinho o peso líquido (bruto menos tara) e o valor total a pagar (peso líquido × valor por quilo do sucateiro).",
      "O painel de revisão mostra o resumo financeiro, o sucateiro e a conta bancária da obra para depósito, apenas para leitura.",
      "Depois de conferir tudo, clique em SOLICITAR NOTA FISCAL. A Contabilidade recebe o pedido por e-mail na hora.",
    ],
    aviso:
      "O envio para a Contabilidade não é automático. O peso líquido e os dados bancários são calculados e protegidos: qualquer ajuste de valor exige justificativa registrada.",
  },
  {
    numero: 3,
    titulo: "Emissão da Nota Fiscal Avulsa",
    responsavel: "Contabilidade",
    passos: [
      "A Contabilidade recebe o aviso por e-mail e abre a Fase 3 do processo.",
      "A folha oficial já vem preenchida: remetente (obra da construtora), destinatário (sucateiro), CFOP conforme o estado e a discriminação da carga com peso e valor.",
      "Revise os campos e clique em Confirmar Emissão da NFA.",
      "O sistema gera o PDF oficial em A4 e envia ao administrador da obra que solicitou a nota. A Fase 4 é liberada na sequência.",
    ],
  },
  {
    numero: 4,
    titulo: "Recibo, depósito e encerramento",
    responsavel: "Administrativo de Obra",
    passos: [
      "Foto 010 — anexe o recibo assinado pelo motorista ou sucateiro.",
      "Foto 011 — anexe o comprovante de depósito na conta oficial da obra.",
      "Foto 012 — a nota fiscal já foi anexada automaticamente na emissão.",
      "Com as evidências obrigatórias válidas (001, 002, 004, 010 e 011), clique em GERAR RELATÓRIO E ENCERRAR PROCESSO.",
      "O sistema monta o relatório fotográfico oficial em duas páginas A4, arquiva o arquivo e envia por e-mail aos destinatários da obra.",
      "O processo passa para CONCLUÍDO e fica bloqueado para alterações.",
    ],
  },
];

const PERFIS: { perfil: string; atuacao: string }[] = [
  { perfil: "Operador de balança", atuacao: "Pesagem de entrada (tara) na Fase 1 e pesagem de saída (peso bruto) na Fase 2, com as fotos obrigatórias." },
  { perfil: "Administrativo de Obra", atuacao: "Revisa os dados da coleta, solicita a nota na Fase 2 e anexa recibo e comprovante de depósito na Fase 4." },
  { perfil: "Contabilidade", atuacao: "Confere os dados fiscais, emite a Nota Fiscal Avulsa na Fase 3 e envia ao solicitante da obra." },
  { perfil: "Coordenador / Engenheiro", atuacao: "Acompanha o histórico do processo e recebe o relatório fotográfico final por e-mail. Responsável pelos cadastros (sucateiros, valor por quilo, veículos, contas da obra) e pelas reaberturas com auditoria." },
];

const DUVIDAS: { pergunta: string; resposta: string }[] = [
  {
    pergunta: "O que fazer se o caminhão for recusado na entrada?",
    resposta: "Cancele a entrada antes de registrar a Fase 2. Depois do peso de saída, o processo precisa seguir o fluxo normal ou ser cancelado com justificativa.",
  },
  {
    pergunta: "Posso alterar o valor por quilo na saída?",
    resposta: "Não. O valor é contratual e fica no cadastro do sucateiro. Alterações exigem permissão de administrador e justificativa gravada.",
  },
  {
    pergunta: "Como corrigir um relatório já concluído?",
    resposta: "Somente a equipe de TI autoriza uma correção técnica pontual, que gera uma nova versão sem apagar o histórico da versão anterior.",
  },
];

function ManualSucata() {
  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Recycle className="h-5 w-5" />
          </div>
          <h2 className="text-3xl font-extrabold text-foreground">Manual do Processo de Sucata</h2>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          Controla a pesagem, o valor, a emissão da nota e o encerramento da venda de sucata retirada das obras da construtora. O fluxo tem{" "}
          <strong className="text-foreground">4 fases em sequência</strong>, com registro fotográfico obrigatório, peso apurado
          pela balança e relatório fotográfico oficial ao final.
        </p>
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-bold text-foreground border-b pb-2 border-primary/20">Quem faz o quê</h3>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <tbody>
              {PERFIS.map((p, i) => (
                <tr key={p.perfil} className={i % 2 === 0 ? "bg-card" : "bg-muted/40"}>
                  <th scope="row" className="w-56 px-4 py-3 text-left align-top font-semibold text-foreground">
                    {p.perfil}
                  </th>
                  <td className="px-4 py-3 align-top text-muted-foreground">{p.atuacao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-6">
        <h3 className="text-xl font-bold text-foreground border-b pb-2 border-primary/20">Passo a passo das 4 fases</h3>
        {FASES.map((fase) => (
          <article key={fase.numero} className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <header className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                {fase.numero}
              </span>
              <div>
                <h4 className="text-lg font-bold text-foreground">{fase.titulo}</h4>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{fase.responsavel}</p>
              </div>
            </header>
            <ol className="space-y-2 pl-5 list-decimal text-sm text-muted-foreground leading-relaxed">
              {fase.passos.map((passo) => (
                <li key={passo}>{passo}</li>
              ))}
            </ol>
            {fase.aviso && (
              <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-xs font-medium text-primary/90">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider">Atenção</span>
                  {fase.aviso}
                </p>
              </div>
            )}
          </article>
        ))}
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-bold text-foreground border-b pb-2 border-primary/20">
          Consultar, reimprimir e reenviar o relatório
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 space-y-2">
            <h4 className="flex items-center gap-2 font-bold text-foreground">
              <Printer className="h-4 w-4 text-primary" /> Reimprimir
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              No processo concluído, clique em <strong className="text-foreground">Reimprimir relatório emitido</strong>. O
              documento aparece na própria tela, exatamente como foi enviado, e você pode imprimir ou baixar o arquivo original.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-2">
            <h4 className="flex items-center gap-2 font-bold text-foreground">
              <Lightbulb className="h-4 w-4 text-primary" /> Reenviar por e-mail
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Abra a tela do relatório, confira a prévia, marque os destinatários e confirme o envio. O reenvio fica registrado no
              histórico e a versão original é preservada.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-bold text-foreground border-b pb-2 border-primary/20">Dúvidas frequentes</h3>
        <div className="space-y-3">
          {DUVIDAS.map((d) => (
            <div key={d.pergunta} className="rounded-xl bg-muted/50 border border-primary/10 p-5">
              <h4 className="flex items-start gap-2 font-semibold text-foreground">
                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {d.pergunta}
              </h4>
              <p className="mt-2 pl-6 text-sm text-muted-foreground leading-relaxed">{d.resposta}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
