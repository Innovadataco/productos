import type { AnaliticaData } from "@/lib/bi/analitica";
import BarrasHorizontales from "@/components/bi/pulso/BarrasHorizontales";

/**
 * El frente padre (mockup v4, sección 5 izquierda): padres como actores
 * agregados — jamás identidades (Ley 1581). Usa las BarrasHorizontales
 * compartidas del sistema; las cifras son las del contrato (candado 10).
 * Candado 9: si el frente padre está en cero en la réplica, la tarjeta lo
 * dice con un aviso honesto en vez de posar de vacía.
 */
export default function FrentePadre({
    frente,
}: {
    frente: AnaliticaData["frentePadre"];
}) {
    const sinActividad =
        frente.reportesPadres === 0 && frente.suscripcionesPadre === 0 && frente.hijosCirculo === 0;

    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": "460ms" } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[17px] font-semibold">El frente padre</h3>
            <div className="mb-4 text-[13px] text-muted">Padres como actores — sin identidades (Ley 1581)</div>
            <BarrasHorizontales
                filas={[
                    { etiqueta: "Reportes de padres", total: frente.reportesPadres },
                    { etiqueta: "Reportes de colegios", total: frente.reportesColegios },
                    { etiqueta: "Suscripciones padre", total: frente.suscripcionesPadre },
                    { etiqueta: "Hijos en círculo", total: frente.hijosCirculo },
                ]}
            />
            {sinActividad && (
                <div className="aviso-honesto">
                    El frente padre aún no tiene actividad en la réplica — cuando llegue, esta tarjeta cobra
                    vida sola.
                </div>
            )}
        </div>
    );
}
