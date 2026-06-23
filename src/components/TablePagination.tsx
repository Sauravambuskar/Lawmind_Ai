import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (page: number) => void;
}

export function TablePagination({ currentPage, totalPages, totalItems, startIndex, pageSize, onPrev, onNext, onGoTo }: TablePaginationProps) {
  if (totalPages <= 1) return null;

  const end = Math.min(startIndex + pageSize, totalItems);

  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
      <span className="text-sm text-muted-foreground">
        Showing {startIndex + 1}–{end} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onPrev} disabled={currentPage <= 1}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="px-1 text-muted-foreground text-sm">…</span>
          ) : (
            <Button
              key={p}
              variant={p === currentPage ? "default" : "outline"}
              size="icon"
              className="h-8 w-8 text-xs"
              onClick={() => onGoTo(p)}
            >
              {p}
            </Button>
          )
        )}
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onNext} disabled={currentPage >= totalPages}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
