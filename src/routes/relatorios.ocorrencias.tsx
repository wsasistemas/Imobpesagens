import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Download, Loader2, Search, ImageIcon } from "lucide-react";
import { AppShell, TODAS_OBRAS, useObraAtual } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OcorrenciaDetalheDialog, estagiosOcorrencia } from "@/components/ocorrencia-detalhe-dialog";
import { ColunaFiltro, type Direcao, type FaixaNum, type FaixaData } from "@/components/grid-filtro-coluna";
import { obrasQueryOptions, pesagensQueryOptions, signedUrlsQueryOptions } from "@/lib/pesagem-queries";
import type { PesagemComEvidencias } from "@/lib/pesagem-store";
import { listarEmailsUsuarios } from "@/lib/admin.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/relatorios/ocorrencias")({
  head: () => ({
    meta: [
      { title: "Relatório de ocorrências — Portal de Pesagem" },
      {
        name: "description",
        content: "Ocorrências estratificadas por etapa, tipo e contratante registradas nas pesagens da obra.",
      },
      { property: "og:title", content: "Relatório de ocorrências — Portal de Pesagem" },
      {
        property: "og:description",
        content: "Ocorrências estratificadas por etapa, tipo e contratante registradas nas pesagens da obra.",
      },
    ],
  }),
  component: RelatorioOcorrenciasPage,
});

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--dimmer)"];

type Linha = {
  id: string;
  pesagem: PesagemComEvidencias;
  etapa: "entrada" | "saida";
  etapaLabel: string;
  tipo: string;
  relato: string;
  em: string | null;
  autorId: string | null;
  fotos: number;
};

function fmtData(v: string | null) {
  return v ? new Date(v).toLocaleString("pt-BR") : "—";
}

function RelatorioOcorrenciasPage() {
  const [obraId, setObraId] = useObraAtual();
  const visaoConsolidada = obraId === TODAS_OBRAS;
  const obraConsultaId = visaoConsolidada ? null : obraId || null;
  const { user } = useAuth();
  const { data: obras = [] } = useQuery(obrasQueryOptions(user?.id));
  const { data: pesagens = [], isLoading } = useQuery(pesagensQueryOptions(obraConsultaId));
  const nomePorObra = useMemo(() => new Map(obras.map((o) => [o.id, `${o.coligada} – ${o.nome}`])), [obras]);

  const [etapaFiltro, setEtapaFiltro] = useState<string>("__all__");
  const [tipoFiltro, setTipoFiltro] = useState<string>("__all__");
  const [contratanteFiltro, setContratanteFiltro] = useState<string>("__all__");
  const [dtIni, setDtIni] = useState<string>("");
  const [dtFim, setDtFim] = useState<string>("");
  const [busca, setBusca] = useState<string>("");
  const [det, setDet] = useState<{ open: boolean; pesagem: PesagemComEvidencias | null; etapa?: "entrada" | "saida" }>({
    open: false,
    pesagem: null,
  });

  // Ordenação e filtros por coluna (cabeçalho do grid)
  type ColunaChave =
    | "data" | "obra" | "etapa" | "tipo" | "placa" | "nota"
    | "contratante" | "transportadora" | "registradoPor" | "fotos" | "relato";
  const [ordenacao, setOrdenacao] = useState<{ coluna: ColunaChave; dir: Exclude<Direcao, null> } | null>(null);
  const [fData, setFData] = useState<FaixaData>({});
  const [fObra, setFObra] = useState<string[]>([]);
  const [fEtapa, setFEtapa] = useState<string[]>([]);
  const [fTipo, setFTipo] = useState<string[]>([]);
  const [fPlaca, setFPlaca] = useState<string[]>([]);
  const [fNota, setFNota] = useState("");
  const [fContratante, setFContratante] = useState<string[]>([]);
  const [fTransportadora, setFTransportadora] = useState<string[]>([]);
  const [fRegistradoPor, setFRegistradoPor] = useState<string[]>([]);
  const [fFotos, setFFotos] = useState<FaixaNum>({});
  const [fRelato, setFRelato] = useState("");

  const alternarOrdenacao = (coluna: ColunaChave) =>
    setOrdenacao((atual) =>
      atual?.coluna !== coluna
        ? { coluna, dir: "asc" }
        : atual.dir === "asc"
          ? { coluna, dir: "desc" }
          : null,
    );
  const dirDe = (coluna: ColunaChave): Direcao => (ordenacao?.coluna === coluna ? ordenacao.dir : null);

  // Estratificação: uma linha por etapa (entrada / saída) com ocorrência.
  const todas = useMemo<Linha[]>(() => {
    const out: Linha[] = [];
    for (const p of pesagens) {
      const fotos = (p.evidencias ?? []).filter((e) => e.tipo !== "nota").length;
      for (const est of estagiosOcorrencia(p)) {
        out.push({
          id: `${p.id}-${est.key}`,
          pesagem: p,
          etapa: est.key,
          etapaLabel: est.label,
          tipo: est.tipoResolvido || "—",
          relato: est.relato ?? "",
          em: est.em ?? p.created_at ?? null,
          autorId: est.autorId ?? null,
          fotos,
        });
      }
    }
    return out.sort((a, b) => new Date(b.em ?? 0).getTime() - new Date(a.em ?? 0).getTime());
  }, [pesagens]);

  const userIds = useMemo(() => {
    const s = new Set<string>();
    todas.forEach((l) => l.autorId && s.add(l.autorId));
    return Array.from(s).sort();
  }, [todas]);

  const listarEmailsFn = useServerFn(listarEmailsUsuarios);
  const { data: emailMap = {} } = useQuery({
    queryKey: ["user-emails", userIds],
    enabled: userIds.length > 0,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: () => listarEmailsFn({ data: { ids: userIds } }),
  });

  const paths = useMemo(
    () =>
      Array.from(
        new Set(
          todas.flatMap((l) => (l.pesagem.evidencias ?? []).filter((e) => e.tipo !== "nota").map((e) => e.storage_path)),
        ),
      ),
    [todas],
  );
  const { data: urlMap = {} } = useQuery(signedUrlsQueryOptions(paths)) as { data: Record<string, string> };

  const tiposDisponiveis = useMemo(
    () => Array.from(new Set(todas.map((l) => l.tipo).filter(Boolean))).sort(),
    [todas],
  );
  const contratantesDisponiveis = useMemo(
    () =>
      Array.from(
        new Set(todas.map((l) => (l.pesagem.contratante ?? "").trim()).filter((c) => c.length > 0)),
      ).sort(),
    [todas],
  );

  // Opções (com contagem) para os filtros de lista do cabeçalho
  const contar = (valores: string[]) => {
    const m = new Map<string, number>();
    valores.forEach((v) => m.set(v, (m.get(v) ?? 0) + 1));
    return Array.from(m, ([valor, contagem]) => ({ valor, contagem })).sort((a, b) => a.valor.localeCompare(b.valor));
  };
  const registradoPorDe = (l: Linha) =>
    l.autorId ? ((emailMap as Record<string, string>)[l.autorId] ?? "—") : "—";
  const opcoesObra = useMemo(
    () => contar(todas.map((l) => nomePorObra.get(l.pesagem.obra_id) ?? "—")),
    [todas, nomePorObra],
  );
  const opcoesEtapa = useMemo(() => contar(todas.map((l) => l.etapaLabel)), [todas]);
  const opcoesTipo = useMemo(() => contar(todas.map((l) => l.tipo || "—")), [todas]);
  const opcoesPlaca = useMemo(() => contar(todas.map((l) => l.pesagem.placa ?? "—")), [todas]);
  const opcoesContratante = useMemo(() => contar(todas.map((l) => l.pesagem.contratante ?? "—")), [todas]);
  const opcoesTransportadora = useMemo(() => contar(todas.map((l) => l.pesagem.transportadora ?? "—")), [todas]);
  const opcoesRegistradoPor = useMemo(() => contar(todas.map(registradoPorDe)), [todas, emailMap]);

  const filtradas = useMemo(() => {
    const ini = dtIni ? new Date(`${dtIni}T00:00:00`).getTime() : null;
    const fim = dtFim ? new Date(`${dtFim}T23:59:59`).getTime() : null;
    const q = busca.trim().toLowerCase();
    const iniCol = fData.de ? new Date(`${fData.de}T00:00:00`).getTime() : null;
    const fimCol = fData.ate ? new Date(`${fData.ate}T23:59:59`).getTime() : null;
    const notaQ = fNota.trim().toLowerCase();
    const relatoQ = fRelato.trim().toLowerCase();
    const fotosMin = fFotos.min?.trim() ? Number(fFotos.min) : null;
    const fotosMax = fFotos.max?.trim() ? Number(fFotos.max) : null;

    const out = todas.filter((l) => {
      if (etapaFiltro !== "__all__" && l.etapa !== etapaFiltro) return false;
      if (tipoFiltro !== "__all__" && l.tipo !== tipoFiltro) return false;
      if (contratanteFiltro !== "__all__" && (l.pesagem.contratante ?? "").trim() !== contratanteFiltro) return false;
      const t = l.em ? new Date(l.em).getTime() : null;
      if (ini != null && (t == null || t < ini)) return false;
      if (fim != null && (t == null || t > fim)) return false;
      if (q) {
        const alvo = [
          l.pesagem.placa,
          l.pesagem.numero_nota,
          l.pesagem.transportadora,
          l.pesagem.emissor,
          l.pesagem.contratante,
          l.tipo,
          l.relato,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!alvo.includes(q)) return false;
      }

      // Filtros por coluna (cabeçalho)
      if (iniCol != null && (t == null || t < iniCol)) return false;
      if (fimCol != null && (t == null || t > fimCol)) return false;
      if (fObra.length > 0 && !fObra.includes(nomePorObra.get(l.pesagem.obra_id) ?? "—")) return false;
      if (fEtapa.length > 0 && !fEtapa.includes(l.etapaLabel)) return false;
      if (fTipo.length > 0 && !fTipo.includes(l.tipo || "—")) return false;
      if (fPlaca.length > 0 && !fPlaca.includes(l.pesagem.placa ?? "—")) return false;
      if (notaQ && !(l.pesagem.numero_nota ?? "").toLowerCase().includes(notaQ)) return false;
      if (fContratante.length > 0 && !fContratante.includes(l.pesagem.contratante ?? "—")) return false;
      if (fTransportadora.length > 0 && !fTransportadora.includes(l.pesagem.transportadora ?? "—")) return false;
      if (fRegistradoPor.length > 0 && !fRegistradoPor.includes(registradoPorDe(l))) return false;
      if (fotosMin != null && l.fotos < fotosMin) return false;
      if (fotosMax != null && l.fotos > fotosMax) return false;
      if (relatoQ && !(l.relato ?? "").toLowerCase().includes(relatoQ)) return false;
      return true;
    });

    if (ordenacao) {
      const valorDe = (l: Linha): string | number => {
        switch (ordenacao.coluna) {
          case "data": return l.em ? new Date(l.em).getTime() : Number.NaN;
          case "obra": return nomePorObra.get(l.pesagem.obra_id) ?? "";
          case "etapa": return l.etapaLabel;
          case "tipo": return l.tipo;
          case "placa": return l.pesagem.placa ?? "";
          case "nota": return l.pesagem.numero_nota ?? "";
          case "contratante": return l.pesagem.contratante ?? "";
          case "transportadora": return l.pesagem.transportadora ?? "";
          case "registradoPor": return registradoPorDe(l);
          case "fotos": return l.fotos;
          case "relato": return l.relato ?? "";
        }
      };
      out.sort((a, b) => {
        const va = valorDe(a);
        const vb = valorDe(b);
        const vazioA = va === "" || (typeof va === "number" && Number.isNaN(va));
        const vazioB = vb === "" || (typeof vb === "number" && Number.isNaN(vb));
        if (vazioA && vazioB) return 0;
        if (vazioA) return 1; // vazios sempre no fim
        if (vazioB) return -1;
        const r =
          typeof va === "number" && typeof vb === "number"
            ? va - vb
            : String(va).localeCompare(String(vb), "pt-BR", { numeric: true });
        return ordenacao.dir === "asc" ? r : -r;
      });
    }
    return out;
  }, [
    todas, etapaFiltro, tipoFiltro, contratanteFiltro, dtIni, dtFim, busca,
    ordenacao, fData, fObra, fEtapa, fTipo, fPlaca, fNota, fContratante,
    fTransportadora, fRegistradoPor, fFotos, fRelato, nomePorObra, emailMap,
  ]);

  const kpis = useMemo(() => {
    const entradas = filtradas.filter((l) => l.etapa === "entrada").length;
    const saidas = filtradas.filter((l) => l.etapa === "saida").length;
    const pesagensAfetadas = new Set(filtradas.map((l) => l.pesagem.id)).size;
    return { total: filtradas.length, entradas, saidas, pesagensAfetadas };
  }, [filtradas]);

  const porTipo = useMemo(() => {
    const m = new Map<string, number>();
    filtradas.forEach((l) => m.set(l.tipo, (m.get(l.tipo) ?? 0) + 1));
    return Array.from(m, ([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd);
  }, [filtradas]);

  const porEtapa = useMemo(
    () => [
      { nome: "Entrada", qtd: kpis.entradas },
      { nome: "Saída", qtd: kpis.saidas },
    ],
    [kpis],
  );

  const porContratante = useMemo(() => {
    const m = new Map<string, number>();
    filtradas.forEach((l) => {
      const c = (l.pesagem.contratante ?? "").trim() || "Sem contratante";
      m.set(c, (m.get(c) ?? 0) + 1);
    });
    return Array.from(m, ([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 8);
  }, [filtradas]);

  const exportarCsv = () => {
    const head = [
      "Data",
      "Obra",
      "Etapa",
      "Tipo",
      "Placa",
      "Nota",
      "Contratante",
      "Emissor",
      "Transportadora",
      "Registrado por",
      "Fotos",
      "Relato",
    ];
    const linhas = filtradas.map((l) => [
      fmtData(l.em),
      nomePorObra.get(l.pesagem.obra_id) ?? "",
      l.etapaLabel,
      l.tipo,
      l.pesagem.placa ?? "",
      l.pesagem.numero_nota ?? "",
      l.pesagem.contratante ?? "",
      l.pesagem.emissor ?? "",
      l.pesagem.transportadora ?? "",
      l.autorId ? (emailMap as Record<string, string>)[l.autorId] ?? "" : "",
      String(l.fotos),
      (l.relato ?? "").replace(/\s+/g, " ").trim(),
    ]);
    const csv = [head, ...linhas]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ocorrencias-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const obraNome = visaoConsolidada ? "Todas as obras" : obras.find((o) => o.id === obraId)?.nome ?? null;

  return (
    <AppShell obraId={obraId} onObraChange={setObraId} menu="relatorios_ocorrencias">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-3 sm:gap-6 sm:p-4 lg:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <AlertTriangle className="h-6 w-6 text-warning" />
              Relatório de ocorrências
            </h1>
            <p className="text-sm text-muted-foreground">
              Ocorrências estratificadas por etapa, tipo e contratante — {obraNome ?? "selecione uma obra"}.
            </p>
          </div>
          <Button variant="outline" onClick={exportarCsv} disabled={filtradas.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 pt-6">
            <div className="space-y-1.5">
              <Label>De</Label>
              <Input type="date" value={dtIni} onChange={(e) => setDtIni(e.target.value)} className="w-full sm:w-[160px]" />
            </div>
            <div className="space-y-1.5">
              <Label>Até</Label>
              <Input type="date" value={dtFim} onChange={(e) => setDtFim(e.target.value)} className="w-full sm:w-[160px]" />
            </div>
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select value={etapaFiltro} onValueChange={setEtapaFiltro}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os tipos</SelectItem>
                  {tiposDisponiveis.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contratante</Label>
              <Select value={contratanteFiltro} onValueChange={setContratanteFiltro}>
                <SelectTrigger className="w-full sm:w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os contratantes</SelectItem>
                  {contratantesDisponiveis.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Placa, nota, transportadora, relato…"
                  className="pl-8"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de ocorrências</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{kpis.total}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ArrowDownLeft className="h-4 w-4 text-success" /> Na entrada
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{kpis.entradas}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ArrowUpRight className="h-4 w-4 text-info" /> Na saída
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{kpis.saidas}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pesagens afetadas</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{kpis.pesagensAfetadas}</CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Ocorrências por tipo</CardTitle>
            </CardHeader>
            <CardContent className="h-[220px] sm:h-[280px]">
              {porTipo.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porTipo} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="nome"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 18)}…` : v)}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="qtd" name="Ocorrências" fill="var(--warning)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Entrada × Saída</CardTitle>
            </CardHeader>
            <CardContent className="h-[220px] sm:h-[280px]">
              {kpis.total === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={porEtapa} dataKey="qtd" nameKey="nome" innerRadius={50} outerRadius={85} label>
                      {porEtapa.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ranking por contratante</CardTitle>
          </CardHeader>
          <CardContent className="h-[220px] sm:h-[260px]">
            {porContratante.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porContratante} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={160}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 22)}…` : v)}
                  />
                  <Tooltip />
                  <Bar dataKey="qtd" name="Ocorrências" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tabela detalhada */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhamento ({filtradas.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : filtradas.length === 0 ? (
              <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
                Nenhuma ocorrência encontrada com os filtros atuais.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="whitespace-nowrap px-2 py-2">
                        <ColunaFiltro titulo="Data" tipo="data" faixaData={fData} onChange={setFData}
                          ordenacao={dirDe("data")} onOrdenar={() => alternarOrdenacao("data")} />
                      </th>
                      {visaoConsolidada && (
                        <th className="whitespace-nowrap px-2 py-2">
                          <ColunaFiltro titulo="Obra" tipo="lista" opcoes={opcoesObra} selecionados={fObra} onChange={setFObra}
                            ordenacao={dirDe("obra")} onOrdenar={() => alternarOrdenacao("obra")} />
                        </th>
                      )}
                      <th className="whitespace-nowrap px-2 py-2">
                        <ColunaFiltro titulo="Etapa" tipo="lista" opcoes={opcoesEtapa} selecionados={fEtapa} onChange={setFEtapa}
                          ordenacao={dirDe("etapa")} onOrdenar={() => alternarOrdenacao("etapa")} />
                      </th>
                      <th className="whitespace-nowrap px-2 py-2">
                        <ColunaFiltro titulo="Tipo" tipo="lista" opcoes={opcoesTipo} selecionados={fTipo} onChange={setFTipo}
                          ordenacao={dirDe("tipo")} onOrdenar={() => alternarOrdenacao("tipo")} />
                      </th>
                      <th className="whitespace-nowrap px-2 py-2">
                        <ColunaFiltro titulo="Placa" tipo="lista" opcoes={opcoesPlaca} selecionados={fPlaca} onChange={setFPlaca}
                          ordenacao={dirDe("placa")} onOrdenar={() => alternarOrdenacao("placa")} />
                      </th>
                      <th className="whitespace-nowrap px-2 py-2">
                        <ColunaFiltro titulo="Nota" tipo="texto" valor={fNota} onChange={setFNota}
                          ordenacao={dirDe("nota")} onOrdenar={() => alternarOrdenacao("nota")} />
                      </th>
                      <th className="whitespace-nowrap px-2 py-2">
                        <ColunaFiltro titulo="Contratante" tipo="lista" opcoes={opcoesContratante} selecionados={fContratante} onChange={setFContratante}
                          ordenacao={dirDe("contratante")} onOrdenar={() => alternarOrdenacao("contratante")} />
                      </th>
                      <th className="whitespace-nowrap px-2 py-2">
                        <ColunaFiltro titulo="Transportadora" tipo="lista" opcoes={opcoesTransportadora} selecionados={fTransportadora} onChange={setFTransportadora}
                          ordenacao={dirDe("transportadora")} onOrdenar={() => alternarOrdenacao("transportadora")} />
                      </th>
                      <th className="whitespace-nowrap px-2 py-2">
                        <ColunaFiltro titulo="Registrado por" tipo="lista" opcoes={opcoesRegistradoPor} selecionados={fRegistradoPor} onChange={setFRegistradoPor}
                          ordenacao={dirDe("registradoPor")} onOrdenar={() => alternarOrdenacao("registradoPor")} />
                      </th>
                      <th className="whitespace-nowrap px-2 py-2">
                        <ColunaFiltro titulo="Fotos" tipo="numero" faixa={fFotos} onChange={setFFotos}
                          ordenacao={dirDe("fotos")} onOrdenar={() => alternarOrdenacao("fotos")} />
                      </th>
                      <th className="px-2 py-2">
                        <ColunaFiltro titulo="Relato" tipo="texto" valor={fRelato} onChange={setFRelato}
                          ordenacao={dirDe("relato")} onOrdenar={() => alternarOrdenacao("relato")} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((l) => (
                      <tr
                        key={l.id}
                        className="cursor-pointer border-b transition-colors hover:bg-muted/50"
                        onClick={() => setDet({ open: true, pesagem: l.pesagem, etapa: l.etapa })}
                      >
                        <td className="whitespace-nowrap px-2 py-2">{fmtData(l.em)}</td>
                        {visaoConsolidada && (
                          <td className="whitespace-nowrap px-2 py-2 font-medium">
                            {nomePorObra.get(l.pesagem.obra_id) ?? "—"}
                          </td>
                        )}
                        <td className="whitespace-nowrap px-2 py-2">
                          <Badge variant="outline" className={l.etapa === "entrada" ? "border-success/30 text-success" : "border-info/30 text-info"}>
                            {l.etapaLabel}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 font-medium">{l.tipo}</td>
                        <td className="whitespace-nowrap px-2 py-2">{l.pesagem.placa ?? "—"}</td>
                        <td className="whitespace-nowrap px-2 py-2">{l.pesagem.numero_nota ?? "—"}</td>
                        <td className="whitespace-nowrap px-2 py-2">{l.pesagem.contratante ?? "—"}</td>
                        <td className="whitespace-nowrap px-2 py-2">{l.pesagem.transportadora ?? "—"}</td>
                        <td className="whitespace-nowrap px-2 py-2">
                          {l.autorId ? (emailMap as Record<string, string>)[l.autorId] ?? "—" : "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">
                          <span className="inline-flex items-center gap-1">
                            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            {l.fotos}
                          </span>
                        </td>
                        <td className="max-w-[340px] truncate px-2 py-2 text-muted-foreground">{l.relato || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <OcorrenciaDetalheDialog
        open={det.open}
        onOpenChange={(o) => setDet((s) => ({ ...s, open: o }))}
        pesagem={det.pesagem}
        obraNome={obraNome}
        emailMap={emailMap as Record<string, string>}
        urlMap={urlMap}
        estagioInicial={det.etapa}
      />
    </AppShell>
  );
}
