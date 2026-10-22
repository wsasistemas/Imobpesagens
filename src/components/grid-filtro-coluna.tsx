import { useMemo, useState } from "react";
import { ArrowDown, ArrowDownUp, ArrowUp, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

export type FaixaNum = { min?: string; max?: string };
export type FaixaData = { de?: string; ate?: string };
export type Direcao = "asc" | "desc" | null;

type BaseProps = {
  titulo: string;
  className?: string;
  /** Direção atual da ordenação desta coluna (null = sem ordenação). */
  ordenacao?: Direcao;
  /** Alterna a ordenação: asc → desc → nenhuma. */
  onOrdenar?: () => void;
};

type ListaProps = BaseProps & {
  tipo: "lista";
  opcoes: Array<{ valor: string; contagem: number }>;
  selecionados: string[];
  onChange: (v: string[]) => void;
};

type TextoProps = BaseProps & {
  tipo: "texto";
  valor: string;
  onChange: (v: string) => void;
};

type NumProps = BaseProps & {
  tipo: "numero";
  faixa: FaixaNum;
  onChange: (v: FaixaNum) => void;
  sufixo?: string;
};

type DataProps = BaseProps & {
  tipo: "data";
  faixaData: FaixaData;
  onChange: (v: FaixaData) => void;
};

type NenhumProps = BaseProps & {
  tipo: "nenhum";
};

type Props = ListaProps | TextoProps | NumProps | DataProps | NenhumProps;

export function ColunaFiltro(props: Props) {
  const [aberto, setAberto] = useState(false);
  const [buscaOpcao, setBuscaOpcao] = useState("");

  const ativo =
    props.tipo === "lista"
      ? props.selecionados.length > 0
      : props.tipo === "texto"
        ? props.valor.trim().length > 0
        : props.tipo === "numero"
          ? !!(props.faixa.min || props.faixa.max)
          : props.tipo === "data"
            ? !!(props.faixaData.de || props.faixaData.ate)
            : false;

  const badge = props.tipo === "lista" && props.selecionados.length > 0 ? props.selecionados.length : null;
  const tituloPlano = props.titulo.replace(/\n/g, " ");
  const ordenado = props.ordenacao === "asc" || props.ordenacao === "desc";
  const destaque = ativo || ordenado;

  const opcoesFiltradas = useMemo(() => {
    if (props.tipo !== "lista") return [];
    const q = buscaOpcao.trim().toLowerCase();
    if (!q) return props.opcoes;
    return props.opcoes.filter((o) => o.valor.toLowerCase().includes(q));
  }, [props, buscaOpcao]);

  function limpar() {
    if (props.tipo === "lista") props.onChange([]);
    else if (props.tipo === "texto") props.onChange("");
    else if (props.tipo === "numero") props.onChange({});
    else if (props.tipo === "data") props.onChange({});
  }

  const IconeOrdem = props.ordenacao === "asc" ? ArrowUp : props.ordenacao === "desc" ? ArrowDown : ArrowDownUp;

  return (
    <div
      className={`group/th -mx-1 flex min-w-0 items-center gap-1 rounded px-1 py-0.5 transition-colors duration-200 ${
        destaque ? "bg-primary/10" : ""
      } ${props.className ?? ""}`}
    >
      {props.onOrdenar ? (
        <button
          type="button"
          onClick={props.onOrdenar}
          title={`Ordenar por ${tituloPlano}`}
          className={`min-w-0 flex-1 truncate text-left leading-tight transition-colors duration-200 hover:text-primary ${
            destaque ? "text-primary" : ""
          }`}
        >
          {tituloPlano}
        </button>
      ) : (
        <span
          title={tituloPlano}
          className={`min-w-0 flex-1 truncate whitespace-nowrap leading-tight ${destaque ? "text-primary" : ""}`}
        >
          {tituloPlano}
        </span>
      )}

      {props.onOrdenar && (
        <button
          type="button"
          onClick={props.onOrdenar}
          title={`Ordenar por ${tituloPlano}`}
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded transition-all duration-200 hover:bg-primary/15 ${
            ordenado
              ? "text-primary opacity-100"
              : "text-muted-foreground opacity-0 group-hover/th:opacity-100 focus-visible:opacity-100"
          }`}
        >
          <IconeOrdem className="h-3 w-3" />
        </button>
      )}

      {props.tipo !== "nenhum" && (
        <Popover open={aberto} onOpenChange={(o) => { setAberto(o); if (!o) setBuscaOpcao(""); }}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title={`Filtrar ${tituloPlano}`}
              className={`inline-flex h-5 shrink-0 items-center gap-0.5 rounded px-1 transition-all duration-200 hover:bg-primary/15 ${
                ativo
                  ? "text-primary opacity-100"
                  : "text-muted-foreground opacity-0 group-hover/th:opacity-100 focus-visible:opacity-100"
              } ${aberto ? "opacity-100" : ""}`}
            >
              <Filter className={`h-3 w-3 ${ativo ? "fill-current" : ""}`} />
              {badge != null && (
                <span className="rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                  {badge}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-0 animate-scale-in">
            {props.tipo === "lista" && (
              <>
                <div className="border-b p-2">
                  <Input
                    autoFocus
                    value={buscaOpcao}
                    onChange={(e) => setBuscaOpcao(e.target.value)}
                    placeholder="Buscar..."
                    className="h-8"
                  />
                </div>
                <ScrollArea className="max-h-60 overflow-y-auto">
                  <div className="p-1">
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted">
                      <Checkbox
                        checked={props.selecionados.length === 0}
                        onCheckedChange={() => props.onChange([])}
                      />
                      <span className="font-medium">(Todos)</span>
                    </label>
                    {opcoesFiltradas.map((o) => {
                      const marcado = props.selecionados.includes(o.valor);
                      return (
                        <label
                          key={o.valor}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
                        >
                          <Checkbox
                            checked={marcado}
                            onCheckedChange={() =>
                              props.onChange(
                                marcado
                                  ? props.selecionados.filter((v) => v !== o.valor)
                                  : [...props.selecionados, o.valor],
                              )
                            }
                          />
                          <span className="flex-1 truncate" title={o.valor}>{o.valor}</span>
                          <span className="text-[10px] text-muted-foreground">{o.contagem}</span>
                        </label>
                      );
                    })}
                    {opcoesFiltradas.length === 0 && (
                      <div className="px-2 py-3 text-center text-xs text-muted-foreground">Sem opções</div>
                    )}
                  </div>
                </ScrollArea>
              </>
            )}

            {props.tipo === "texto" && (
              <div className="p-2">
                <Input
                  autoFocus
                  value={props.valor}
                  onChange={(e) => props.onChange(e.target.value)}
                  placeholder={`Contém...`}
                  className="h-8"
                />
              </div>
            )}

            {props.tipo === "numero" && (
              <div className="flex items-center gap-2 p-2">
                <Input
                  autoFocus
                  type="number"
                  value={props.faixa.min ?? ""}
                  onChange={(e) => props.onChange({ ...props.faixa, min: e.target.value })}
                  placeholder="de"
                  className="h-8"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  type="number"
                  value={props.faixa.max ?? ""}
                  onChange={(e) => props.onChange({ ...props.faixa, max: e.target.value })}
                  placeholder="até"
                  className="h-8"
                />
              </div>
            )}

            {props.tipo === "data" && (
              <div className="flex items-center gap-2 p-2">
                <Input
                  autoFocus
                  type="date"
                  value={props.faixaData.de ?? ""}
                  onChange={(e) => props.onChange({ ...props.faixaData, de: e.target.value })}
                  className="h-8"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={props.faixaData.ate ?? ""}
                  onChange={(e) => props.onChange({ ...props.faixaData, ate: e.target.value })}
                  className="h-8"
                />
              </div>
            )}

            <div className="flex items-center justify-between border-t p-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={limpar} disabled={!ativo}>
                <X className="mr-1 h-3 w-3" /> Limpar
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={() => setAberto(false)}>
                Aplicar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
