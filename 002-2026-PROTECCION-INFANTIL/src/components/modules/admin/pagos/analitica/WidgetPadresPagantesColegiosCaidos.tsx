import { WidgetSeccion } from "./WidgetSeccion";
import type { ItemPadreColegioCaidoDto } from "@/lib/pagos/analitica.service";

/**
 * SPEC-218 (002-PI-118) · Widget 3 (US-003/AS-003): padres pagantes cuyo
 * colegio vinculado no renovó (SUSPENDIDA/CANCELADA). Card resaltada con el
 * contacto del rector para rescatar la cuenta institucional. La vinculación
 * padre↔colegio es la relación explícita por tenant (no dominio de email).
 */
export function WidgetPadresPagantesColegiosCaidos({
    data,
}: {
    data: { total: number; items: ItemPadreColegioCaidoDto[] };
}) {
    return (
        <WidgetSeccion titulo="Padres pagantes, colegio caído" total={data.total}>
            {data.items.length === 0 ? (
                <p className="text-sm text-muted">No hay padres pagantes de colegios sin renovar.</p>
            ) : (
                <ul className="space-y-3">
                    {data.items.map((item) => (
                        <li
                            key={`${item.padreId}-${item.colegioId}`}
                            className="rounded-xl border border-ambar/30 bg-ambar/10 px-4 py-3 dark:border-ambar/40 dark:bg-ambar/20"
                        >
                            <p className="text-sm font-medium text-body">{item.padreNombre}</p>
                            <p className="mt-0.5 text-xs text-muted">
                                Colegio: {item.colegioNombre} ·{" "}
                                {item.colegioEstado === "CANCELADA" ? "Cancelada" : "Suspendida"}
                            </p>
                            <p className="mt-1 text-xs text-muted">
                                Rector: {item.rectorNombre} ·{" "}
                                <a
                                    href={`mailto:${item.rectorEmail}`}
                                    className="font-medium text-estado-ambar underline hover:text-ambar dark:text-ambar"
                                >
                                    {item.rectorEmail}
                                </a>
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </WidgetSeccion>
    );
}
