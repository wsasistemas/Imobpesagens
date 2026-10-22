import { useQuery } from "@tanstack/react-query";
import { consultarCep, type EnderecoCep } from "@/lib/sucata/cep.functions";

/** Busca o endereço do CEP quando há 8 dígitos. Reaproveitável em outros cadastros. */
export function useBuscaCep(cep: string, ativo = true) {
  const digitos = (cep ?? "").replace(/\D/g, "");
  const completo = digitos.length === 8;

  const q = useQuery({
    queryKey: ["cep", digitos],
    enabled: ativo && completo,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
    queryFn: (): Promise<EnderecoCep> => consultarCep({ data: { cep: digitos } }),
  });

  return {
    buscando: q.isFetching,
    endereco: q.data ?? null,
    naoEncontrado: !!q.data && !q.data.encontrado,
    falhou: q.isError,
    completo,
  };
}
