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
      <span>This product belongs to {LEGAL_BUSINESS_NAME}.</span>
      <span className="mx-1.5 text-border" aria-hidden="true">|</span>
      <Link to="/privacy-policy" className="underline decoration-current/40 underline-offset-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Privacy</Link>
      <span className="mx-1 text-border" aria-hidden="true">·</span>
      <Link to="/terms" className="underline decoration-current/40 underline-offset-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Terms</Link>
      <span className="mx-1 text-border" aria-hidden="true">·</span>
      <Link to="/copyright-policy" className="underline decoration-current/40 underline-offset-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Copyright</Link>
    </footer>
  );
}
