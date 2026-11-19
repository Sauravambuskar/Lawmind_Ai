import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { LEGAL_BUSINESS_NAME } from "@/lib/constants";

interface ProductAttributionProps {
  className?: string;
}

export function ProductAttribution({ className }: ProductAttributionProps) {
  return (
    <footer
      className={cn("text-[11px] font-medium leading-4 text-muted-foreground sm:text-xs", className)}
      aria-label="Product attribution"
    >
      <span>This product belongs to {LEGAL_BUSINESS_NAME}.</span>{" "}
      <Link
        to="/communications-policy"
        className="underline decoration-current/40 underline-offset-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Communications policy
      </Link>
    </footer>
  );
}
