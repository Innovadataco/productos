import BarrasHorizontales, { type FilaBarraH } from "../pulso/BarrasHorizontales";
import { formatearCategoria } from "@/lib/bi/pulso";
import { fmtMiles } from "../pulso/formatos";

/**
 * Contrato GeoData.comportamiento (capa de datos, SPEC-006): comportamiento
 * por país y por ciudad con su categoría top. categoriaTop NULL → la UI dice
 * "sin clasificar" (formatearCategoria), jamás inventa una categoría.
 */
export interface ComportamientoGeoData {
    porPais: { pais: string; total: number; categoriaTop: string | null }[];
    porCiudadTop: { ciudad: string; total: number; categoriaTop: string | null }[];
}

/**
 * Comportamiento por país/ciudad (mejora aprobada por el dueño tras probar
 * /geografia en vivo): dos tarjetas con barras horizontales compartidas;
 * cada fila muestra el total real y la categoría top legible de ese país o
 * ciudad. Candado 9: sección o tarjeta vacía → nota honesta, nunca barras
 * mudas. Candado 10: totales y categorías salen del contrato; aquí solo se
 * formatean.
 */
export default function ComportamientoGeo({
    comportamiento,
    retardo = 120,
}: {
    comportamiento: ComportamientoGeoData | null;
    retardo?: number;
}) {
    if (comportamiento === null) {
        return (
            <div
                className="glass anim-entrada mb-4 p-6"
                style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
            >
                <h3 className="mb-1 text-[16.5px] font-semibold">Comportamiento por país y ciudad</h3>
                <p className="py-6 text-center text-[13.5px] text-muted">
                    La réplica aún no expone el comportamiento por país y ciudad.
                </p>
            </div>
        );
    }

    return (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <TarjetaComportamiento
                titulo="Por país"
                filas={comportamiento.porPais.map((p) => ({
                    nombre: p.pais,
                    total: p.total,
                    categoriaTop: p.categoriaTop,
                }))}
                vacio="Aún no hay países con reportes en la réplica."
                retardo={retardo}
            />
            <TarjetaComportamiento
                titulo="Por ciudad"
                filas={comportamiento.porCiudadTop.map((c) => ({
                    nombre: c.ciudad,
                    total: c.total,
                    categoriaTop: c.categoriaTop,
                }))}
                vacio="Aún no hay ciudades con reportes en la réplica."
                retardo={retardo + 60}
            />
        </div>
    );
}

function TarjetaComportamiento({
    titulo,
    filas,
    vacio,
    retardo,
}: {
    titulo: string;
    filas: { nombre: string; total: number; categoriaTop: string | null }[];
    vacio: string;
    retardo: number;
}) {
    const barras: FilaBarraH[] = filas.map((f) => ({
        etiqueta: `${f.nombre} · ${formatearCategoria(f.categoriaTop)}`,
        total: f.total,
    }));
    const totalFilas = filas.reduce((acc, f) => acc + f.total, 0);

    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[16.5px] font-semibold">{titulo}</h3>
            <div className="mb-4 text-[13px] text-muted">
                {filas.length === 0
                    ? "Sin datos todavía"
                    : `${fmtMiles(filas.length)} ${filas.length === 1 ? "entrada" : "entradas"} · ${fmtMiles(totalFilas)} ${totalFilas === 1 ? "reporte" : "reportes"} · con su categoría top`}
            </div>
            {barras.length === 0 ? (
                <p className="py-10 text-center text-[13.5px] text-muted">{vacio}</p>
            ) : (
                <BarrasHorizontales filas={barras} retardoBase={retardo} />
            )}
        </div>
    );
}
