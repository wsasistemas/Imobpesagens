import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  error?: boolean;
  success?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, success, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-input bg-card px-[14px] py-[12px] text-base shadow-sm transition-all placeholder:text-dimmer focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted disabled:border-border-strong disabled:text-dimmer md:text-sm",
          error && "border-[1.5px] border-destructive bg-destructive/10 focus-visible:ring-destructive",
          success && "border-[1.5px] border-success bg-success-soft focus-visible:ring-success",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
