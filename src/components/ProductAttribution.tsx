import { cn } from "@/lib/utils";

interface ProductAttributionProps {
  className?: string;
}

export function ProductAttribution({ className }: ProductAttributionProps) {
  return (
    <footer
      className={cn("text-[10px] leading-4 text-muted-foreground sm:text-[11px]", className)}
      aria-label="Product attribution"
    >
      A product of Coreland Training and IT Solutions
    </footer>
  );
}
