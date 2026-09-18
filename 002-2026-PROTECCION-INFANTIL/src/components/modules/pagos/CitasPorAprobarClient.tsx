"use client";

/**
 * SPEC-713 · Admin · aprobar el pago de una cita. La familia pide y «paga»; el admin
 * aprueba acá y la solicitud pasa a PAGADA_PENDIENTE (arranca el reloj de 48 h del
 * profesional para confirmar). Llama a `POST /api/admin/pagos/cita/[id]/activar`, que
 * existía desde SPEC-395 sin pantalla que lo llamara.
 *
 * Voz USTED (área interna, D-107). El monto va como DATO (lo que ya se calculó al crear
 * la solicitud); esta pantalla no lo re-calcula ni mueve otra plata.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export interface CitaPorAprobar {
    id: string;
    familia: string;
    profesional: string;
    franjaInicio: string; // ISO
    montoTotal: number;
    esperaDesde: string; // ISO (creadoEn)
}

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
function fechaHora(iso: string): string {
    return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function CitasPorAprobarClient({ items }: { items: CitaPorAprobar[] }) {
    const router = useRouter();
    const [aprobando, setAprobando] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const aprobar = async (id: string) => {
        setError(null);
        setAprobando(id);
        try {
            const res = await fetch(`/api/admin/pagos/cita/${id}/activar`, { method: "POST", credentials: "include" });
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
                setError(body?.error?.message ?? "No fue posible aprobar el pago.");
                return;
            }
            // Aprobada → sale de la lista (ya no es SIN_CONFIRMAR). Recarga la vista.
            router.refresh();
        } finally {
            setAprobando(null);
        }
    };

    if (items.length === 0) {
        return (
            <p className="rounded-xl border border-tinta/10 px-4 py-8 text-center text-muted dark:border-tinta/20">
                No hay citas con pago por aprobar.
            </p>
        );
    }

    return (
        <div className="space-y-3">
            {error && (
                <p className="rounded-xl bg-ambar/10 px-4 py-3 text-sm text-estado-ambar">{error}</p>
            )}
            <div className="overflow-x-auto rounded-xl border border-tinta/10 dark:border-tinta/20">
                <table className="min-w-full text-sm">
                    <thead className="bg-tinta/5 dark:bg-tinta/10">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-muted">Familia</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Profesional</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Franja</th>
                            <th className="px-4 py-3 text-right font-medium text-muted">Monto</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Espera desde</th>
                            <th className="px-4 py-3 text-right font-medium text-muted">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-tinta/10 dark:divide-tinta/20">
                        {items.map((c) => (
                            <tr key={c.id}>
                                <td className="px-4 py-3 text-body">{c.familia}</td>
                                <td className="px-4 py-3 text-body">{c.profesional}</td>
                                <td className="px-4 py-3 text-body">{fechaHora(c.franjaInicio)}</td>
                                <td className="px-4 py-3 text-right text-body">{COP.format(c.montoTotal)}</td>
                                <td className="px-4 py-3 text-body">{fechaHora(c.esperaDesde)}</td>
                                <td className="px-4 py-3 text-right">
                                    <Button
                                        onClick={() => aprobar(c.id)}
                                        isLoading={aprobando === c.id}
                                        disabled={aprobando !== null}
                                    >
                                        Aprobar pago
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
