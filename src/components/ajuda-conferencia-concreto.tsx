import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HelpCircle, Scale, FileText, AlertTriangle, CheckCircle2, FlaskConical } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AjudaConferenciaConcreto() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-success">
          <HelpCircle className="h-4 w-4 text-success hover:text-success cursor-help" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-success">
            <FlaskConical className="h-5 w-5" />
            Manual de Conferência Técnica de Concreto
          </DialogTitle>
          <DialogDescription>
            Entenda como o Portal de Pesagem valida a conformidade volumétrica das cargas de concreto.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="pr-4 mt-4">
          <div className="space-y-6 pb-4">
            <section className="space-y-3">
              <h3 className="font-bold flex items-center gap-2 text-success">
                <FileText className="h-4 w-4" />
                1. Identificação Automática (OCR)
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Ao escanear a Nota Fiscal (XML ou PDF), o motor de IA identifica o <strong>Fornecedor</strong> (usando CNPJ ou palavras-chave como "SUPERMIX", "CONCREVIT") e o <strong>Traço</strong> específico (buscando o código do traço ou descrição no item da nota). 
                É essencial que as palavras-chave estejam configuradas corretamente no cadastro para automação total.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold flex items-center gap-2 text-success">
                <Scale className="h-4 w-4" />
                2. Métodos de Aferição de Peso
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-success-soft border border-success/30">
                  <p className="font-semibold text-success mb-1">Dupla Pesagem (Padrão)</p>
                  <p className="text-xs text-success/80">
                    O caminhão pesa na Entrada (Cheio) e na Saída (Vazio). 
                    <strong> Peso Líquido = Entrada - Saída</strong>.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-warning-soft border border-warning/30">
                  <p className="font-semibold text-warning mb-1">Pesagem Única (Exceção)</p>
                  <p className="text-xs text-warning/80">
                    Usado quando a saída não é possível na balança. A tara é informada manualmente baseada na ficha técnica do veículo. 
                    <strong> Peso Líquido = Entrada - Tara Manual</strong>.
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold flex items-center gap-2 text-success">
                <FlaskConical className="h-4 w-4" />
                3. A Memória de Cálculo (Carta de Traço)
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Para concreto usinado, a conferência não utiliza densidades genéricas. O cálculo baseia-se na <strong>Densidade Teórica da Mistura</strong> (kg/m³) especificada na Carta de Traço da concreteira (ex: Concrevit).
              </p>
              
              <div className="rounded-lg border bg-muted p-4">
                <p className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Passo a Passo do Cálculo:</p>
                <div className="space-y-4 text-xs font-mono">
                  <div className="p-2 bg-card rounded border border-border">
                    <p className="text-muted-foreground mb-1">// 1. Identificar o Peso Alvo</p>
                    <p className="text-success">Peso Esperado = Volume NF (m³) × Densidade Teórica (kg/m³)</p>
                    <p className="text-muted-foreground mt-1">Ex: 8.0 m³ × 2.380 kg/m³ = 19.040 kg</p>
                  </div>

                  <div className="p-2 bg-card rounded border border-border">
                    <p className="text-muted-foreground mb-1">// 2. Obter o Peso Real (Líquido)</p>
                    <p className="text-success">Peso Aferido = (Peso Entrada - Peso Saída) - Resíduo</p>
                    <p className="text-muted-foreground mt-1">Nota: Aditivos e Água vêm inclusos no traço (não somam duplicado).</p>
                  </div>

                  <div className="p-2 bg-card rounded border border-border">
                    <p className="text-muted-foreground mb-1">// 3. Validar Conformidade</p>
                    <p className="text-success">Divergência % = ((Aferido - Esperado) / Esperado) * 100</p>
                    <p className="text-muted-foreground mt-1">Status: Conforme se dentro da tolerância da concreteira (±4%).</p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground italic bg-success-soft p-2 rounded border border-success/30">
                <strong>Importante:</strong> Itens de aditivos e água que constam na NF com valor zerado ou simbólico são tratados como parte integrante da mistura (já contidos na densidade teórica), evitando erros de pesagem acumulada.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" />
                4. Status de Conformidade
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <Badge className="bg-success h-5">Conforme</Badge>
                  <span>Divergência dentro da tolerância (Padrão ±4%).</span>
                </li>
                <li className="flex gap-2">
                  <Badge className="bg-warning h-5">Acima</Badge>
                  <span>Carga possui volume maior que o faturado (Excesso).</span>
                </li>
                <li className="flex gap-2">
                  <Badge className="bg-destructive h-5">Abaixo</Badge>
                  <span>Carga possui volume menor que o faturado (Falta).</span>
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold flex items-center gap-2 text-success">
                <AlertTriangle className="h-4 w-4" />
                5. Regras de Segurança e Engenharia
              </h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>O sistema sinaliza em <strong>VERMELHO PULSANTE</strong> e exige conferência da engenharia quando:</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>A carga é classificada como "Abaixo" (Divergência negativa {">"} tolerância).</li>
                  <li>O método utilizado foi "Pesagem Única".</li>
                  <li>Houve registro de volume de resíduo expressivo.</li>
                </ul>
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${className}`}>
      {children}
    </span>
  );
}
