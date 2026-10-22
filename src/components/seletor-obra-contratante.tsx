import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ObraOpcao = { id: string; nome: string; cnpj?: string | null };

type Props = {
  obras: ObraOpcao[];
  value: string;
  onChange: (nome: string) => void;
  /** Marca visualmente como pendente (vermelho) quando vazio. */
  invalido?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

function mascaraCnpj(v?: string | null): string {
  const d = (v ?? "").replace(/\D+/g, "");
  if (d.length !== 14) return v ?? "";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function SeletorObraContratante({
  obras,
  value,
  onChange,
  invalido,
  disabled,
  className,
  placeholder = "Selecione a obra contratante",
}: Props) {
  const [aberto, setAberto] = useState(false);

  const selecionada = useMemo(
    () => obras.find((o) => o.nome.trim().toUpperCase() === value.trim().toUpperCase()),
    [obras, value],
  );

  const vazio = value.trim() === "";

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            vazio && "text-muted-foreground",
            vazio && invalido && "border-destructive bg-destructive/5",
            className,
          )}
        >
          <span className="truncate uppercase">
            {vazio ? placeholder : selecionada?.nome ?? value}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(val, search) => (val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder="Buscar obra por nome ou CNPJ..." />
          <CommandList>
            <CommandEmpty>Nenhuma obra encontrada no cadastro.</CommandEmpty>
            <CommandGroup>
              {obras.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.nome} ${o.cnpj ?? ""}`}
                  onSelect={() => {
                    onChange(o.nome.toUpperCase());
                    setAberto(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selecionada?.id === o.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex flex-col">
                    <span className="text-xs font-medium uppercase">{o.nome}</span>
                    {o.cnpj ? (
                      <span className="text-[10px] text-muted-foreground">{mascaraCnpj(o.cnpj)}</span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
