import type { CSSProperties } from "react";
import type { TableroColegio } from "@/lib/dal/repositories/colegio-resumen";
import { EmbudoEstado } from "@/components/modules/colegio/tablero/EmbudoEstado";
import { RelojActividad } from "@/components/modules/colegio/tablero/RelojActividad";
import { RitmoMensual } from "@/components/modules/colegio/tablero/RitmoMensual";
import { BarrasPorCurso } from "@/components/modules/colegio/tablero/BarrasPorCurso";

/**
 * SPEC-158 (T007, FR-001) — Composición del tablero de control del colegio:
 * embudo de estado (cabecera, "qué me espera a mí"), reloj de actividad 24 h +
 * ritmo mensual a dos columnas, y barras por curso. Todo entra escalonado con
 * la curva única (§4.5) y se calla; reduced-motion lo apaga todo (media query
 * global). Solo `RitmoMensual` es client (Recharts); el resto es server-safe.
 */

function retardo(ms: number): CSSProperties {
    return { "--anim-retardo": `${ms}ms` } as CSSProperties;
}

interface TableroClientProps {
    datos: TableroColegio;
}

export default function TableroClient({ datos }: TableroClientProps) {
    return (
        <main className="min-h-screen p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
                <header className="anim-entrada">
                    <h1 className="titular-seccion text-body">El tablero de tu colegio</h1>
                    <p className="mt-0.5 text-sm text-muted">
                        Qué te espera, a qué horas llegan los reportes y dónde poner la atención.
                    </p>
                </header>

                <div className="anim-entrada" style={retardo(70)}>
                    <EmbudoEstado embudo={datos.embudo} />
                </div>

                <div className="anim-entrada grid gap-5 sm:gap-6 lg:grid-cols-2" style={retardo(140)}>
                    <RelojActividad horas={datos.reloj24h} />
                    <RitmoMensual puntos={datos.ritmoMensual} />
                </div>

                <div className="anim-entrada" style={retardo(210)}>
                    <BarrasPorCurso cursos={datos.barrasCurso} />
                </div>
            </div>
        </main>
    );
}
