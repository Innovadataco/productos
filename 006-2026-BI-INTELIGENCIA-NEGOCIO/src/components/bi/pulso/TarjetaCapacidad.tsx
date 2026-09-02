import type { CapacidadData, SemaforoCapacidad } from "@/lib/bi/capacidad";
import { semaforoCapacidad } from "@/lib/bi/capacidad";
import CifraAnimada from "./CifraAnimada";

/* Etiqueta y color por estado del semáforo (barra izquierda + punto + aviso,
   mismo lenguaje visual que SeccionInsights / TarjetaComercial del mockup v3). */
const SEMAFORO: Record<
    SemaforoCapacidad,
    { etiqueta: string; claseTexto: string; clasePunto: string; claseBarra: string; claseAviso: string }
> = {
    rubi: {
        etiqueta: "Sin capacidad de gestión",
        claseTexto: "text-estado-rubi",
        clasePunto: "punto-bad",
        claseBarra: "bg-[rgb(var(--rubi-rgb))]",
        claseAviso: "border-[rgb(var(--rubi-rgb)/0.3)] bg-[rgb(var(--rubi-rgb)/0.08)] text-estado-rubi",
    },
    ambar: {
        etiqueta: "Capacidad al límite",
        claseTexto: "text-estado-ambar",
        clasePunto: "punto-warn",
        claseBarra: "bg-[rgb(var(--ambar-rgb))]",
        claseAviso: "border-[rgb(var(--ambar-rgb)/0.25)] bg-[rgb(var(--ambar-rgb)/0.08)] text-estado-ambar",
    },
    pino: {
        etiqueta: "Capacidad suficiente",
        claseTexto: "text-estado-pino",
        clasePunto: "punto-ok",
        claseBarra: "bg-[rgb(var(--pino-rgb))]",
        claseAviso: "border-[rgb(var(--pino-rgb)/0.3)] bg-[rgb(var(--pino-rgb)/0.08)] text-estado-pino",
    },
};

/** Cifra con count-up + microetiqueta (CifraAnimada es la única isla client). */
function Cifra({
    valor,
    etiqueta,
    claseValor = "",
}: {
    valor: number;
    etiqueta: string;
    claseValor?: string;
}) {
    return (
        <div>
            <div className={`cifra text-[32px] font-bold leading-none tracking-tight ${claseValor}`}>
                <CifraAnimada valor={valor} />
            </div>
            <div className="microetiqueta mt-1.5">{etiqueta}</div>
        </div>
    );
}

/**
 * Capacidad operativa (mockup v3 · Pulso, tras "BI detectó"): la brecha entre
 * la demanda acumulada (revisión manual + alertas sin asignar) y la capacidad
 * VISIBLE de gestión, en la cara. Candado 9 llevado al extremo: con CERO
 * operarios la tarjeta lo dice en rubí con todas las cifras — no se disimula.
 * Candado 10: toda cifra y el mensaje vienen de CapacidadData; aquí solo se
 * elige color vía semaforoCapacidad (función pura de la capa de datos).
 * Se renderiza SIEMPRE (también con la réplica vacía: 0 operarios y demanda 0
 * es un hecho, no un hueco a ocultar).
 */
export default function TarjetaCapacidad({
    capacidad,
    retardo = 240,
}: {
    capacidad: CapacidadData;
    retardo?: number;
}) {
    const sem = SEMAFORO[semaforoCapacidad(capacidad)];

    return (
        <section aria-label="Capacidad operativa" className="mb-7">
            <div
                className="microetiqueta anim-entrada mb-3 flex items-center gap-2"
                style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
            >
                <span className={`punto anim-pulso ${sem.clasePunto}`} />
                Capacidad operativa · demanda vs. gestión
            </div>
            <div
                className="glass anim-entrada relative overflow-hidden p-6 pl-7"
                style={{ "--anim-retardo": `${retardo + 40}ms` } as React.CSSProperties}
            >
                <span aria-hidden="true" className={`absolute bottom-0 left-0 top-0 w-1 ${sem.claseBarra}`} />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-[16.5px] font-semibold">Capacidad operativa</h3>
                    <span className={`text-[11px] font-bold uppercase tracking-[0.12em] ${sem.claseTexto}`}>
                        {sem.etiqueta}
                    </span>
                </div>
                <p className="mb-5 mt-1 text-[13px] text-muted">
                    Demanda acumulada frente a la capacidad visible de gestión
                </p>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <Cifra valor={capacidad.revisionManual} etiqueta="En revisión manual" />
                    <Cifra valor={capacidad.alertasSinAsignar} etiqueta="Alertas sin asignar" />
                    <Cifra
                        valor={capacidad.operariosConCasos}
                        etiqueta="Operarios con casos"
                        claseValor={sem.claseTexto}
                    />
                    <Cifra valor={capacidad.capacidadMaxPorOperario} etiqueta="Cupo máx. por operario" />
                </div>

                <p className={`mt-5 rounded-xl border px-4 py-3 text-[12.5px] leading-relaxed ${sem.claseAviso}`}>
                    {capacidad.mensaje}
                </p>

                <div className="mt-5 border-t border-[rgb(var(--tinta-rgb)/0.08)] pt-4">
                    <div className="microetiqueta mb-2.5">Casos activos por operario</div>
                    {capacidad.casosPorOperario.length === 0 ? (
                        <p className="text-[13px] text-muted">Ningún operario con casos asignados</p>
                    ) : (
                        <ul className="space-y-1.5">
                            {capacidad.casosPorOperario.map((o) => (
                                <li key={o.id} className="flex items-center justify-between text-[13.5px]">
                                    <span className="font-semibold">{o.id}</span>
                                    <span className="cifra text-muted">
                                        {o.activos} {o.activos === 1 ? "caso activo" : "casos activos"}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="mt-3 text-[11.5px] text-subtle">
                        Seudónimos deterministas: la identidad de los operarios no se replica (Ley 1581).
                    </p>
                </div>
            </div>
        </section>
    );
}
