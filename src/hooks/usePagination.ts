import { useMemo, useState } from "react";

const ITEMS_PER_PAGE = 10;

export function usePagination<T>(items: T[], perPage = ITEMS_PER_PAGE) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safeCurrentPage = Math.min(page, totalPages);

  const paginatedItems = useMemo(
    () => items.slice((safeCurrentPage - 1) * perPage, safeCurrentPage * perPage),
    [items, safeCurrentPage, perPage]
  );

  const goToPage = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)));
  const nextPage = () => goToPage(safeCurrentPage + 1);
  const prevPage = () => goToPage(safeCurrentPage - 1);

  return {
    currentPage: safeCurrentPage,
    totalPages,
    paginatedItems,
    goToPage,
    nextPage,
    prevPage,
    totalItems: items.length,
    startIndex: (safeCurrentPage - 1) * perPage,
  };
}
