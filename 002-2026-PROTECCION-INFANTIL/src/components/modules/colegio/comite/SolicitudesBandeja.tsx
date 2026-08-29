"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { SolicitudComiteBandejaDto } from "@/lib/dal/types/comite-convivencia";

interface Props {
    puedeResolver: boolean;
}

export function SolicitudesBandeja({ puedeResolver }: Props) {
    const [items, setItems] = useState<SolicitudComiteBandejaDto[]>([]);
    const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 25, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    async function cargar(page = 1) {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/colegio/comite/solicitudes?page=${page}&pageSize=25`);
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message || "Error al cargar la bandeja");
                return;
            }
            setItems(data.items);
            setPagination(data.pagination);
        } catch {
            setError("Error de red al cargar la bandeja");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void cargar(1);
    }, []);

    return (
        <section className="rounded-2xl glass p-6 md:p-8">
            <h2 className="text-xl font-semibold text-body">Casos escalados al comité</h2>
            {error && <p className="mt-4 text-sm text-estado-rubi">{error}</p>}
            {loading ? (
                <p className="mt-4 text-sm text-muted">Cargando…</p>
            ) : items.length === 0 ? (
                <p className="mt-4 text-sm text-muted">No hay casos escalados.</p>
            ) : (
                <>
                    <ul className="mt-4 divide-y divide-tinta/10">
                        {items.map((solicitud) => (
                            <li key={solicitud.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="font-medium text-body">{solicitud.numero}</p>
                                    <p className="text-sm text-muted">
                                        {new Date(solicitud.creadoEn).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })} · {solicitud.estado}
                                    </p>
                                </div>
                                <Link
                                    href={`/dashboard/colegio/comite/casos/${solicitud.id}`}
                                    className="inline-flex items-center justify-center rounded-xl bg-pino px-4 py-2 text-sm font-semibold text-papel shadow hover:bg-pino/90"
                                >
                                    {puedeResolver && solicitud.estado === "PENDIENTE" ? "Revisar y cerrar" : "Ver caso"}
                                </Link>
                            </li>
                        ))}
                    </ul>
                    {pagination.totalPages > 1 && (
                        <div className="mt-6 flex items-center justify-between">
                            <Button
                                type="button"
                                disabled={pagination.page <= 1}
                                onClick={() => void cargar(pagination.page - 1)}
                                variant="outline"
                            >
                                Anterior
                            </Button>
                            <span className="text-sm text-muted">
                                Página {pagination.page} de {pagination.totalPages}
                            </span>
                            <Button
                                type="button"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => void cargar(pagination.page + 1)}
                                variant="outline"
                            >
                                Siguiente
                            </Button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
