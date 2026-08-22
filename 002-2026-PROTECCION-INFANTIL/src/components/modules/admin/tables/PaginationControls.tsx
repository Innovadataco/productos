"use client";

import { Button } from "@/components/ui/Button";

interface PaginationControlsProps {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
}

export function PaginationControls({ page, totalPages, total, onPageChange }: PaginationControlsProps) {
    return (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <span>
                Página {page} de {Math.max(totalPages, 1)} · {total} registros
            </span>
            <div className="flex gap-2">
                <Button variant="outline" className="px-3 py-1.5 text-xs" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}>
                    Anterior
                </Button>
                <Button variant="outline" className="px-3 py-1.5 text-xs" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
                    Siguiente
                </Button>
            </div>
        </div>
    );
}
