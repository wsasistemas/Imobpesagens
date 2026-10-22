// Busca com autocomplete da tabela oficial de CFOP (saídas 5.xxx e 6.xxx).
// Pesquisa por código ("5.102") ou por descrição ("venda", "sucata", "outra saída").
// Os códigos do escopo sugerido (mesma UF ou outro estado) aparecem primeiro.
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { CLASSE_NUM } from "@/lib/sucata/tipos";
import type { CfopOpcao } from "@/lib/sucata/nfa.functions";

type Props = {
  opcoes: CfopOpcao[];
  valor: string;
  onSelecionar: (opcao: CfopOpcao) => void;
  escopoSugerido: "INTERNO" | "INTERESTADUAL";
  disabled?: boolean;
};

const rotuloEscopo = (escopo: string) =>
  escopo === "INTERNO" ? "Dentro do estado (5.xxx)" : "Outro estado (6.xxx)";

export function CfopCombobox({ opcoes, valor, onSelecionar, escopoSugerido, disabled }: Props) {
  const [aberto, setAberto] = useState(false);

  const grupos = useMemo(() => {
    const sugeridos = opcoes.filter((c) => c.escopo === escopoSugerido);
    const outros = opcoes.filter((c) => c.escopo !== escopoSugerido);
    return [
      { titulo: `Sugeridos — ${rotuloEscopo(escopoSugerido)}`, itens: sugeridos },
      { titulo: `Outros — ${rotuloEscopo(escopoSugerido === "INTERNO" ? "INTERESTADUAL" : "INTERNO")}`, itens: outros },
    ].filter((g) => g.itens.length > 0);
  }, [opcoes, escopoSugerido]);

  const selecionado = opcoes.find((c) => c.codigo === valor);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          disabled={disabled}
          className="h-8 w-full justify-between px-2 font-normal"
        >
          <span className="truncate text-left">
            {selecionado ? (
              <>
                <span className={CLASSE_NUM}>{selecionado.codigo}</span>
                {" — "}
                {selecionado.descricao}
              </>
            ) : (
              "Buscar CFOP por código ou descrição"
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(38rem,90vw)] p-0">
        <Command
          filter={(value, search) => {
            const alvo = value.toLowerCase();
            const termo = search.toLowerCase().trim();
            if (!termo) return 1;
            return termo.split(/\s+/).every((t) => alvo.includes(t)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Digite o código (5.102) ou a descrição (venda, sucata)…" />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhum CFOP encontrado.</CommandEmpty>
            {grupos.map((g) => (
              <CommandGroup key={g.titulo} heading={g.titulo}>
                {g.itens.map((c) => (
                  <CommandItem
                    key={c.codigo}
                    value={`${c.codigo} ${c.codigo.replace(".", "")} ${c.descricao} ${rotuloEscopo(c.escopo)}`}
                    onSelect={() => {
                      onSelecionar(c);
                      setAberto(false);
                    }}
                    className="items-start gap-2"
                  >
                    <Check
                      className={cn("mt-0.5 h-4 w-4 shrink-0", valor === c.codigo ? "opacity-100" : "opacity-0")}
                    />
                    <span className="flex-1">
                      <span className={`font-medium ${CLASSE_NUM}`}>{c.codigo}</span>
                      <span className="ml-2 text-muted-foreground">{c.descricao}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
