import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, FileImage, Printer, Send } from "lucide-react";
import { AppShell, useObraAtual } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { obrasQueryOptions } from "@/lib/pesagem-queries";
import { tiposSucataQueryOptions } from "@/lib/sucata/sucata-queries";
import { evidenciasQueryOptions, processoQueryOptions, vigentes } from "@/lib/sucata/evidencias-queries";
import {
  blobRelatorio,
  destinatariosRelatorioQueryOptions,
  relatoriosQueryOptions,
} from "@/lib/sucata/relatorio-queries";
import { PdfPreviewDialog } from "@/components/sucata/pdf-preview-dialog";
import {
  corrigirRelatorioEmitido,
  enviarRelatorioConcluir,
  reenviarRelatorio,
} from "@/lib/sucata/relatorio.functions";
import { dadosNfa } from "@/lib/sucata/nfa.functions";
import { carregarFotosRelatorio, gerarPdfRelatorio, imagemDaFolhaNfa, nomeRelator } from "@/lib/sucata/relatorio-pdf";
import { NfaFolha } from "@/components/sucata/nfa-folha";

import { POSICOES_EVIDENCIA, codigoDe, posicoesObrigatorias } from "@/lib/sucata/posicoes-evidencia";
import { CLASSE_NUM, CORES_STATUS } from "@/lib/sucata/tipos";
import {
  RelatorioFotografico, TOTAL_PAGINAS_RELATORIO, type FotoRelatorio,
} from "@/components/sucata/relatorio-fotografico";

export const Route = createFileRoute("/sucata/$id/relatorio")({
  head: () => ({
    meta: [
      { title: "Relatório fotográfico — Portal de Pesagem" },
      {
        name: "description",
        content: "Relatório fotográfico do processo de sucata no padrão do Portal de Pesagem, com as 5 fotos obrigatórias, impressão em A4 e envio aos responsáveis.",
      },
      { property: "og:title", content: "Relatório fotográfico — Portal de Pesagem" },
      { property: "og:description", content: "Gere, imprima e envie o relatório fotográfico do processo de sucata." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RelatorioPage,
  errorComponent: () => <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar o relatório.</div>,
  notFoundComponent: () => <div className="p-6 text-sm text-muted-foreground">Processo não encontrado.</div>,
});

const SEM_ITENS: never[] = [];

function RelatorioPage() {
  const { id } = Route.useParams();
  const [obraId, setObraId] = useObraAtual();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isAdmin, isSuperAdmin, isCoordenador, isOperador } = useAuth();
  const buscarDadosNfa = useServerFn(dadosNfa);

  const { data: processo } = useQuery(processoQueryOptions(id));
  // Listas com fallback estável: um [] novo a cada render reexecuta os efeitos
  // que dependem delas e derruba a tela com "Maximum update depth exceeded".
  const { data: evidencias = SEM_ITENS } = useQuery(evidenciasQueryOptions(id));
  const { data: tipos = SEM_ITENS } = useQuery(tiposSucataQueryOptions());
  const { data: obras = SEM_ITENS } = useQuery(obrasQueryOptions(user?.id));
  const { data: relatorios = SEM_ITENS } = useQuery(relatoriosQueryOptions(id));
  const { data: destinatarios = SEM_ITENS } = useQuery(
    destinatariosRelatorioQueryOptions(processo?.coligada_origem ?? null),
  );
  const { data: nota } = useQuery({
    queryKey: ["sucata", "nfa", id],
    queryFn: () => buscarDadosNfa({ data: { processoId: id } }),
    staleTime: 15_000,
  });

  const podeEnviar = isAdmin || isSuperAdmin || isCoordenador || isOperador;
  const vig = useMemo(() => vigentes(evidencias), [evidencias]);
  const posicoesOk = useMemo(() => new Set(vig.map((e) => e.posicao)), [vig]);
  const obrigatorias = useMemo(() => posicoesObrigatorias(processo?.entrada_em), [processo?.entrada_em]);
  const totalObrigatorias = obrigatorias.length;
  const faltantes = POSICOES_EVIDENCIA.filter(
    (p) => obrigatorias.includes(p.posicao) && !posicoesOk.has(p.posicao),
  );
  const completo = faltantes.length === 0;

  const [fotos, setFotos] = useState<FotoRelatorio[]>([]);
  const [notaRenderizada, setNotaRenderizada] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [extraNome, setExtraNome] = useState("");
  const [extraEmail, setExtraEmail] = useState("");
  const [gerando, setGerando] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [previaAberta, setPreviaAberta] = useState(false);
  const [previaUrl, setPreviaUrl] = useState<string | null>(null);
  const [previaTitulo, setPreviaTitulo] = useState("");
  const [previaArquivo, setPreviaArquivo] = useState("relatorio.pdf");
  const [previaCarregando, setPreviaCarregando] = useState(false);
  const [previaErro, setPreviaErro] = useState<string | null>(null);
  const [previaPath, setPreviaPath] = useState<string | null>(null);
  const [previaVersao, setPreviaVersao] = useState<number>(0);
  const [acaoPrevia, setAcaoPrevia] = useState<"reenviar" | "corrigir" | null>(null);
  const [pdfCorrecao, setPdfCorrecao] = useState<string | null>(null);

  const notaDados = useMemo(
    () =>
      nota
        ? {
            campos: nota.formulario,
            cfop: nota.cfopSugerido ?? "",
            natureza: nota.naturezaSugerida,
            numero: nota.nfaNumero ?? "00001",
            emissao: nota.nfaEmissao ?? "",
            processo: nota.numero,
          }
        : null,
    [nota],
  );

  useEffect(() => {
    const ativos = destinatarios.filter((d) => d.ativo);
    setMarcados(Object.fromEntries(ativos.map((d) => [d.id, true])));
  }, [destinatarios]);

  // Imagens em base64 (nota em PDF vira preview da 1ª página): o PDF é montado a partir do mesmo HTML da tela.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const lista = await carregarFotosRelatorio(vig);
      if (!cancelado) setFotos(lista);
    })();
    return () => {
      cancelado = true;
    };
  }, [vig]);

  useEffect(() => {
    if (!notaDados) {
      setNotaRenderizada(null);
      return;
    }
    let cancelado = false;
    const timer = window.setTimeout(() => {
      void imagemDaFolhaNfa("nfa-fonte-relatorio").then((imagem) => {
        if (!cancelado) setNotaRenderizada(imagem);
      });
    }, 300);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [notaDados]);

  // Só a nota recém-desenhada entra no relatório. O arquivo antigo da evidência
  // 012 não serve de reserva: era ele que chegava quebrado no e-mail.
  const notaImagem = notaRenderizada;

  const obra = obras.find((o) => o.id === processo?.obra_id) ?? null;
  const tipo = tipos.find((t) => t.id === processo?.tipo_sucata_id) ?? null;
  const dataColeta = processo?.saida_em ?? processo?.entrada_em ?? null;

  const dados = {
    numero: processo?.numero ?? "—",
    obra: obra?.nome ?? "—",
    dataColeta: dataColeta
      ? new Date(dataColeta).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : "—",
    descricao: `Retirada de ${tipo?.nome ?? "sucata"}`,
    relator: nomeRelator(user),
  };

  const selecionados = [
    ...destinatarios.filter((d) => marcados[d.id]).map((d) => ({ nome: d.nome, email: d.email })),
    ...(extraEmail.trim() ? [{ nome: extraNome.trim() || extraEmail.trim(), email: extraEmail.trim() }] : []),
  ];

  const enviar = useMutation({
    mutationFn: async () => {
      if (!completo) throw new Error(`Complete as ${totalObrigatorias} fotos antes de enviar.`);
      if (notaDados && !notaImagem) throw new Error("Aguarde a Nota Fiscal Avulsa terminar de carregar.");
      if (selecionados.length === 0) throw new Error("Marque ao menos um destinatário.");
      setGerando(true);
      try {
        const pdf = await gerarPdfRelatorio("relatorio-pdf", dados.numero, TOTAL_PAGINAS_RELATORIO);
        return await enviarRelatorioConcluir({ data: { processoId: id, pdfBase64: pdf, destinatarios: selecionados } });
      } finally {
        setGerando(false);
      }
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["sucata"] });
      if (!r.ok) {
        toast.error(r.erro ?? (r.concluido ? "O envio falhou." : "O envio falhou. O processo continua aberto."));
        return;
      }
      toast.success(
        `Relatório versão ${r.versao} enviado para ${r.enviados.join(", ")}.${concluido ? "" : " Processo concluído."}`,
      );
      if (r.falhas.length > 0) toast.warning(`Sem sucesso para: ${r.falhas.join(", ")}`);
      navigate({ to: "/sucata/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const concluido = processo?.situacao === "CONCLUIDO";
  // Emitido na Fase 4: o documento fica somente leitura; só reimpressão e reenvio do mesmo arquivo.
  const ultimaVersao = relatorios.length > 0 ? relatorios[0] : null;
  const emitido = concluido && !!ultimaVersao;

  // Pré-visualização interna: nunca abrir aba nova nem endereço externo.
  const previa = async (path: string, versao: number, acao: "reenviar" | null = null) => {
    setPreviaAberta(true);
    setPreviaTitulo(`${dados.numero} — relatório emitido (versão ${versao})`);
    setPreviaArquivo(`relatorio-${dados.numero.replace(/\//g, "-")}-v${versao}.pdf`);
    setPreviaErro(null);
    setPreviaCarregando(true);
    setPreviaUrl((atual) => {
      if (atual) URL.revokeObjectURL(atual);
      return null;
    });
    setPreviaPath(path);
    setPreviaVersao(versao);
    setAcaoPrevia(acao);
    setPdfCorrecao(null);
    try {
      const url = await blobRelatorio(path);
      setPreviaUrl(url);
    } catch (e) {
      setPreviaErro(e instanceof Error ? e.message : "Não foi possível carregar o relatório emitido.");
    } finally {
      setPreviaCarregando(false);
    }
  };

  const fecharPrevia = () => {
    setPreviaAberta(false);
    setPreviaUrl((atual) => {
      if (atual) URL.revokeObjectURL(atual);
      return null;
    });
    setAcaoPrevia(null);
    setPdfCorrecao(null);
  };

  const abrirEmitido = () => {
    if (!ultimaVersao) return;
    void previa(ultimaVersao.storage_path, ultimaVersao.versao);
  };

  const conferirAntesDeReenviar = () => {
    if (!ultimaVersao) return;
    void previa(ultimaVersao.storage_path, ultimaVersao.versao, "reenviar");
  };

  const reenviar = useMutation({
    mutationFn: async () => {
      if (!ultimaVersao || previaVersao !== ultimaVersao.versao) throw new Error("Confira novamente a versão mais recente.");
      if (selecionados.length === 0) throw new Error("Marque ao menos um destinatário.");
      return await reenviarRelatorio({
        data: { processoId: id, versao: ultimaVersao.versao, destinatarios: selecionados },
      });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["sucata"] });
      if (!r.ok) {
        toast.error(r.erro ?? "O reenvio falhou.");
        return;
      }
      toast.success(`Relatório versão ${r.versao} reenviado para ${r.enviados.join(", ")}.`);
      if (r.falhas.length > 0) toast.warning(`Sem sucesso para: ${r.falhas.join(", ")}`);
      fecharPrevia();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const corrigir = useMutation({
    mutationFn: async () => {
      if (!pdfCorrecao) throw new Error("Gere e confira a versão corrigida antes de salvar.");
      return await corrigirRelatorioEmitido({ data: { processoId: id, pdfBase64: pdfCorrecao } });
    },
    onSuccess: (r) => {
      toast.success(`Versão ${r.versao} corrigida e guardada. A versão anterior foi preservada.`);
      fecharPrevia();
      void qc.invalidateQueries({ queryKey: ["sucata", "relatorios", id] });
      void qc.invalidateQueries({ queryKey: ["sucata"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const conferirCorrecao = async () => {
    if (!notaDados || !notaImagem) {
      toast.error("Aguarde a Nota Fiscal Avulsa terminar de carregar em A4.");
      return;
    }
    setConferindo(true);
    try {
      const pdf = await gerarPdfRelatorio("relatorio-pdf", dados.numero, TOTAL_PAGINAS_RELATORIO);
      const bytes = Uint8Array.from(atob(pdf), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      setPreviaUrl((atual) => {
        if (atual) URL.revokeObjectURL(atual);
        return url;
      });
      const proxima = (ultimaVersao?.versao ?? 0) + 1;
      setPreviaTitulo(`${dados.numero} — conferência da correção (versão ${proxima})`);
      setPreviaArquivo(`relatorio-${dados.numero.replace(/\//g, "-")}-v${proxima}.pdf`);
      setPreviaErro(null);
      setPreviaCarregando(false);
      setPreviaPath(null);
      setPreviaVersao(proxima);
      setPdfCorrecao(pdf);
      setAcaoPrevia("corrigir");
      setPreviaAberta(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível montar a correção.");
    } finally {
      setConferindo(false);
    }
  };

  const abrirPdfGerado = async () => {
    if (notaDados && !notaImagem) {
      toast.error("Aguarde a Nota Fiscal Avulsa terminar de carregar.");
      return;
    }
    setConferindo(true);
    try {
      const pdf = await gerarPdfRelatorio("relatorio-pdf", dados.numero, TOTAL_PAGINAS_RELATORIO);
      const bytes = Uint8Array.from(atob(pdf), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      setPreviaUrl((atual) => {
        if (atual) URL.revokeObjectURL(atual);
        return url;
      });
      setPreviaTitulo(`${dados.numero} — conferência do PDF`);
      setPreviaArquivo(`relatorio-${dados.numero.replace(/\//g, "-")}.pdf`);
      setPreviaErro(null);
      setPreviaCarregando(false);
      setPreviaPath(null);
      setPreviaAberta(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível montar o PDF.");
    } finally {
      setConferindo(false);
    }
  };


  return (
    <AppShell obraId={obraId} onObraChange={setObraId} menu="sucata">
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <FileImage className="h-6 w-6 text-primary" />
          <div className="mr-auto">
            <h1 className={`font-heading text-xl font-semibold ${CLASSE_NUM}`}>{dados.numero}</h1>
            <p className="text-sm text-muted-foreground">Relatório fotográfico — padrão do Portal de Pesagem</p>
          </div>
          <Badge variant="outline" className={completo ? CORES_STATUS.concluido : CORES_STATUS.pendente}>
            {vig.length} de {totalObrigatorias} evidências
          </Badge>
        </div>

        {!completo && (
          <Card className="print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-base">Faltam evidências para gerar o relatório</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {faltantes.map((p) => (
                  <li key={p.posicao}>
                    <span className={CLASSE_NUM}>Foto {codigoDe(p.posicao)}</span> — {p.rotulo}{" "}
                    <span className="text-muted-foreground">({p.responsavel})</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="overflow-x-auto print:border-0 print:shadow-none">
            <CardHeader className="pb-2 print:hidden">
              <CardTitle className="font-heading text-base">Pré-visualização</CardTitle>
            </CardHeader>
            <CardContent className="print:p-0">
              {notaDados && (
                <div aria-hidden className="pointer-events-none fixed -left-[10000px] top-0 h-[1123px] w-[794px] bg-white">
                  <NfaFolha
                    idFolha="nfa-fonte-relatorio"
                    campos={notaDados.campos}
                    cfop={notaDados.cfop}
                    natureza={notaDados.natureza}
                    numero={notaDados.numero}
                    emissao={notaDados.emissao}
                    processo={notaDados.processo}
                  />
                </div>
              )}
              <div className="origin-top scale-[0.55] sm:scale-[0.7] lg:scale-[0.62] print:scale-100">
                <RelatorioFotografico dados={dados} fotos={fotos} nota={notaDados} notaImagem={notaImagem} />
              </div>
              {/* Fonte definitiva do PDF: folhas reais, sem escala e sem clonagem do DOM. */}
              <div aria-hidden className="pointer-events-none fixed -left-[10000px] top-0 w-[210mm] bg-white">
                <RelatorioFotografico
                  idBase="relatorio-pdf"
                  dados={dados}
                  fotos={fotos}
                  nota={notaDados}
                  notaImagem={notaImagem}
                />
              </div>
            </CardContent>

          </Card>

          <div className="space-y-4 print:hidden">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-base">Destinatários</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {destinatarios.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum destinatário cadastrado para esta coligada. Cadastre em Sucata › Cadastros.
                  </p>
                )}
                {destinatarios
                  .filter((d) => d.ativo)
                  .map((d) => (
                    <label key={d.id} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        checked={!!marcados[d.id]}
                        onCheckedChange={(v) => setMarcados({ ...marcados, [d.id]: !!v })}
                      />
                      <span>
                        <span className="font-medium">{d.nome}</span>
                        <span className="block text-muted-foreground">
                          {d.email}
                          {d.papel ? ` · ${d.papel}` : ""}
                        </span>
                      </span>
                    </label>
                  ))}
                <div className="space-y-2 border-t pt-3">
                  <Label className="text-xs uppercase text-muted-foreground">Destinatário pontual</Label>
                  <Input placeholder="Nome" value={extraNome} onChange={(e) => setExtraNome(e.target.value)} />
                  <Input
                    placeholder="email@empresa.com.br"
                    type="email"
                    value={extraEmail}
                    onChange={(e) => setExtraEmail(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-2 pt-4">
                {emitido ? (
                  <>
                    <Button variant="outline" className="w-full" onClick={abrirEmitido}>
                      <Printer className="mr-2 h-4 w-4" /> Reimprimir relatório emitido
                    </Button>
                    <Button
                      className="w-full bg-primary hover:bg-primary-dark"
                      onClick={conferirAntesDeReenviar}
                      disabled={!podeEnviar || reenviar.isPending}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Conferir antes de reenviar
                    </Button>
                    {(isAdmin || isSuperAdmin) && ultimaVersao?.versao === 1 && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => void conferirCorrecao()}
                        disabled={conferindo || !notaImagem}
                      >
                        <FileImage className="mr-2 h-4 w-4" />
                        {conferindo ? "Montando correção..." : "Conferir versão corrigida"}
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Relatório emitido na Fase 4: o documento não pode ser alterado. Reimpressão e reenvio usam
                      sempre o mesmo arquivo (versão {ultimaVersao?.versao}).
                    </p>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={abrirPdfGerado}
                      disabled={!completo || conferindo || (!!notaDados && !notaImagem)}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      {conferindo ? "Montando PDF..." : "Conferir PDF definitivo"}
                    </Button>
                    <Button
                      className="w-full bg-primary hover:bg-primary-dark"
                      onClick={() => enviar.mutate()}
                      disabled={!completo || !podeEnviar || enviar.isPending || gerando || (!!notaDados && !notaImagem)}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {gerando ? "Gerando PDF..." : enviar.isPending ? "Enviando..." : "Enviar e concluir processo"}
                    </Button>
                  </>
                )}
                {!podeEnviar && <p className="text-xs text-muted-foreground">Seu perfil não pode enviar o relatório.</p>}
              </CardContent>
            </Card>

            {relatorios.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-heading text-base">Versões geradas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {relatorios.map((r) => (
                    <div key={r.id} className="flex items-center gap-2">
                      <span className={`mr-auto ${CLASSE_NUM}`}>
                        v{r.versao} · {new Date(r.gerado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void previa(r.storage_path, r.versao)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <PdfPreviewDialog
        aberto={previaAberta}
        onFechar={fecharPrevia}
        titulo={previaTitulo}
        url={previaUrl}
        nomeArquivo={previaArquivo}
        carregando={previaCarregando}
        erro={previaErro}
        onTentarNovamente={previaPath ? () => void previa(previaPath, previaVersao) : undefined}
        acaoRotulo={
          acaoPrevia === "reenviar"
            ? `Confirmar reenvio da versão ${previaVersao}`
            : acaoPrevia === "corrigir"
              ? `Salvar versão ${previaVersao} corrigida`
              : undefined
        }
        onAcao={
          acaoPrevia === "reenviar"
            ? () => reenviar.mutate()
            : acaoPrevia === "corrigir"
              ? () => corrigir.mutate()
              : undefined
        }
        acaoCarregando={reenviar.isPending || corrigir.isPending}
      />

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { background: #fff; }
          .relatorio-doc { margin: 0 !important; padding: 0 !important; }
          .relatorio-doc > * + * { margin-top: 0 !important; }
          .relatorio-pagina {
            margin: 0 !important;
            box-shadow: none;
            break-inside: avoid;
            page-break-inside: avoid;
            break-after: page;
            page-break-after: always;
          }
          .relatorio-pagina:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
    </AppShell>
  );
}

