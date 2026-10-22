import { useEffect, useState } from "react";
import { Camera, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { urlAssinada } from "@/lib/sucata/evidencias-queries";

/**
 * Miniatura clicável da foto (arquivo ainda não enviado OU evidência já guardada).
 * Ao clicar, abre a foto ampliada para conferência da qualidade.
 */
export function MiniaturaFoto({
  arquivo = null,
  storagePath = null,
  rotulo,
  onTirarOutra,
  className,
}: {
  arquivo?: File | Blob | null;
  storagePath?: string | null;
  rotulo: string;
  onTirarOutra?: () => void;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (arquivo) {
      const u = URL.createObjectURL(arquivo);
      setUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    if (storagePath) {
      let ativo = true;
      setUrl(null);
      void urlAssinada(storagePath).then((u) => {
        if (ativo) setUrl(u);
      });
      return () => {
        ativo = false;
      };
    }
    setUrl(null);
    return undefined;
  }, [arquivo, storagePath]);

  const caixa = `${className ?? "h-24 w-32"} shrink-0 overflow-hidden rounded-md border`;

  if (!arquivo && !storagePath) {
    return (
      <div
        className={`${caixa} flex flex-col items-center justify-center gap-1 border-dashed bg-muted/40 text-xs text-muted-foreground`}
      >
        <ImageOff className="h-4 w-4" />
        Sem foto
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`${caixa} bg-muted transition hover:opacity-90`}
        aria-label={`Ver foto ampliada: ${rotulo}`}
      >
        {url ? (
          <img src={url} alt={rotulo} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full animate-pulse bg-muted" />
        )}
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base">{rotulo}</DialogTitle>
          </DialogHeader>
          {url ? (
            <img src={url} alt={rotulo} className="max-h-[70vh] w-full rounded-md object-contain" />
          ) : (
            <div className="h-64 w-full animate-pulse rounded-md bg-muted" />
          )}
          <DialogFooter className="gap-2">
            {onTirarOutra && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAberto(false);
                  onTirarOutra();
                }}
              >
                <Camera className="mr-2 h-4 w-4" /> Tirar outra foto
              </Button>
            )}
            <Button type="button" onClick={() => setAberto(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
