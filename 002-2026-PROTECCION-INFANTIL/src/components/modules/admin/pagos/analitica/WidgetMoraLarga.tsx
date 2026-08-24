import Link from "next/link";
import { WidgetSeccion } from "./WidgetSeccion";
import type { ItemMoraDto } from "@/lib/pagos/analitica.service";

/**
 * SPEC-218 (002-PI-118) · Widget 2 (US-002/AS-002): mora larga (>30 días).
 * Tarjetas rojas ordenadas por días de mora con acción "Crear bono ad-hoc"
 * (lleva al módulo de bonos, donde ya vive la creación — D-72 reutilizar).
 */
export function WidgetMoraLarga({ data }: { data: { total: number; items: ItemMoraDto[] } }) {
    return (
        <WidgetSeccion titulo="Mora larga (+30 días)" total={data.total}>
            {data.items.length === 0 ? (
                <p className="text-sm text-muted">No hay suscripciones con más de 30 días de mora.</p>
            ) : (
                <ul className="space-y-3">
                    {data.items.map((item) => (
                        <li
                            key={item.suscripcionId}
                            className="rounded-xl border border-rubi/30 bg-rubi/10 px-4 py-3 dark:border-rubi/40 dark:bg-rubi/20"
                        >
                            <div className="flex items-start justify-between gap-3 text-sm">
                                <div>
                                    <p className="font-medium text-body">{item.nombre}</p>
                                    <p className="text-xs text-muted">
                                        {item.rol === "COLEGIO" ? "Colegio" : "Padre"} ·{" "}
                                        {item.estado === "EN_GRACIA" ? "En gracia" : "Suspendida"}
                                    </p>
                                </div>
                                <p className="text-sm font-semibold text-rubi">{item.diasMora} días</p>
                            </div>
                            <Link
                                href="/dashboard/admin/pagos/bonos"
                                className="mt-2 inline-block rounded-lg bg-tinta/10 px-3 py-1 text-xs font-medium text-body hover:bg-tinta/20 dark:bg-tinta/15 dark:hover:bg-tinta/25"
                            >
                                Crear bono ad-hoc
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </WidgetSeccion>
    );
}
