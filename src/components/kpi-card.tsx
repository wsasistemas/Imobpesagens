import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  tone?: "ok" | "bad" | "info";
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Kpi({ label, value, sub, icon, tone, active, onClick, className }: KpiProps) {
  const isClickable = !!onClick;
  
  const toneStyles = {
    ok: "bg-success-soft text-success border-success/15",
    bad: "bg-destructive/10 text-destructive border-destructive/15",
    info: "bg-info-soft text-info border-info/15",
    default: "bg-card text-foreground border-border shadow-card"
  };

  const selectedTone = tone ? toneStyles[tone] : toneStyles.default;

  return (
    <Card 
      className={cn(
        "transition-all duration-300 border",
        isClickable && "cursor-pointer hover:shadow-md active:scale-[0.98]",
        active ? "ring-2 ring-primary border-transparent" : "",
        selectedTone,
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 flex flex-col justify-between h-full gap-2">
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 leading-tight">
            {label}
          </span>
          {icon && <div className="opacity-80">{icon}</div>}
        </div>
        <div>
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          {sub && <div className="text-[10px] font-medium opacity-60 mt-0.5">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
