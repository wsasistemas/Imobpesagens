import { Badge } from "@/components/ui/badge";
import {
  CORES_STATUS,
  ROTULO_SITUACAO_PROCESSO,
  ROTULO_SITUACAO_SUCATEIRO,
  type SituacaoProcesso,
  type SituacaoSucateiro,
} from "@/lib/sucata/tipos";

function cor(situacao: string) {
  if (situacao === "ATIVO" || situacao === "CONCLUIDO") return CORES_STATUS.concluido;
  if (situacao === "BLOQUEADO") return CORES_STATUS.bloqueado;
  return CORES_STATUS.pendente;
}

/** Status sempre com cor + texto — nunca só a cor. */
export function StatusSucateiro({ situacao }: { situacao: string }) {
  return (
    <Badge variant="outline" className={`${cor(situacao)} font-medium`}>
      {ROTULO_SITUACAO_SUCATEIRO[situacao as SituacaoSucateiro] ?? situacao}
    </Badge>
  );
}

export function StatusProcesso({ situacao }: { situacao: string }) {
  return (
    <Badge variant="outline" className={`${cor(situacao)} font-medium`}>
      {ROTULO_SITUACAO_PROCESSO[situacao as SituacaoProcesso] ?? situacao}
    </Badge>
  );
}
