import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { reabrirProcesso } from "@/lib/sucata/relatorio-queries";

/** Processo concluído fica somente leitura. Só a TI reabre, sempre com motivo. */
export function ReabrirProcesso({ processoId }: { processoId: string }) {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const [aberto, setAberto] = useState(false);

  const reabrir = useMutation({
    mutationFn: () => reabrirProcesso(processoId, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sucata"] });
      toast.success("Processo reaberto.");
      setMotivo("");
      setAberto(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="border-warning/30 bg-warning-soft/60">
      <CardContent className="space-y-3 pt-4 text-sm">
        <p className="font-medium text-warning">
          Processo concluído — somente leitura. Novas fotos e alterações estão bloqueadas.
        </p>
        {!isSuperAdmin && <p className="text-warning">A reabertura é feita pela TI.</p>}
        {isSuperAdmin && !aberto && (
          <Button variant="outline" onClick={() => setAberto(true)}>
            <Unlock className="mr-2 h-4 w-4" /> Reabrir processo (TI)
          </Button>
        )}
        {isSuperAdmin && aberto && (
          <div className="space-y-2">
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo da reabertura (obrigatório)"
              rows={3}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button
                className="bg-primary hover:bg-primary-dark"
                onClick={() => reabrir.mutate()}
                disabled={reabrir.isPending}
              >
                Confirmar reabertura
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
