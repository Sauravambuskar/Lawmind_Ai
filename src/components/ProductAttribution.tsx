import { cn } from "@/lib/utils";

interface ProductAttributionProps {
  className?: string;
}

export function ProductAttribution({ className }: ProductAttributionProps) {
  return (
    <footer
      className={cn("text-[11px] font-medium leading-4 text-muted-foreground sm:text-xs", className)}
      aria-label="Product attribution"
    >
      A product of CoreLearn Training and IT Solutions
    </footer>
  );
}
