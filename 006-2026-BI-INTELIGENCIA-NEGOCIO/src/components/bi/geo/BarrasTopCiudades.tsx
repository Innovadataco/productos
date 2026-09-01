import type { GeoData } from "@/lib/bi/geo";
import BarrasHorizontales, { type FilaBarraH } from "../pulso/BarrasHorizontales";
import { fmtMiles } from "../pulso/formatos";

/** Cuántas ciudades se listan por nombre antes de agregar el resto. */
const TOP_VISIBLES = 5;

/**
 * Top ciudades del año (mockup v3 pantalla 3): barras horizontales con las
 * TOP_VISIBLES primeras por nombre y una fila gris "Otras N ciudades" que
 * SUMA el resto del ResultSet (agregación de presentación sobre filas
 * reales, como el "Otras categorías" del mockup). Vacío → nota honesta.
 */
export default function BarrasTopCiudades({
    topCiudades,
    ciudadesConReportes,
    paisesConReportes,
    retardo = 140,
}: {
    topCiudades: GeoData["topCiudades"];
    ciudadesConReportes: number;
    paisesConReportes: number;
    retardo?: number;
}) {
    const visibles = topCiudades.slice(0, TOP_VISIBLES);
    const resto = topCiudades.slice(TOP_VISIBLES);
    const totalResto = resto.reduce((acc, c) => acc + c.total, 0);

    const filas: FilaBarraH[] = visibles.map((c) => ({ etiqueta: c.nombre, total: c.total }));
    if (resto.length > 0) {
        filas.push({
            etiqueta: `Otras ${fmtMiles(resto.length)} ${resto.length === 1 ? "ciudad" : "ciudades"}`,
            total: totalResto,
            acento: "subtle",
        });
    }

    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[16.5px] font-semibold">Top ciudades del año</h3>
            <div className="mb-4 text-[13px] text-muted">
                {fmtMiles(ciudadesConReportes)}{" "}
                {ciudadesConReportes === 1 ? "ciudad" : "ciudades"} con reportes ·{" "}
                {fmtMiles(paisesConReportes)}{" "}
                {paisesConReportes === 1 ? "país" : "países"} en el histórico
            </div>
            {filas.length === 0 ? (
                <p className="py-10 text-center text-[13.5px] text-muted">
                    Aún no hay ciudades con reportes en la réplica.
                </p>
            ) : (
                <BarrasHorizontales filas={filas} retardoBase={retardo} />
            )}
        </div>
    );
}
