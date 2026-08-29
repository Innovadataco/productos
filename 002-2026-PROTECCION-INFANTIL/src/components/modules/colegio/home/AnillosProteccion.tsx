import Link from "next/link";
import { Anillo } from "@/components/ui/Anillo";
import { PanelVidrio } from "@/components/ui/PanelVidrio";
import type { EstadoSistema } from "@/components/ui/Anillo";

/**
 * SPEC-143 (US2, FR-005) — Los anillos de protección del colegio: la forma es el
 * dato. Exterior = vigilancia (% con identificadores digitales), interior =
 * reacción (% con acudiente a quien llamar); la leyenda nombra el hueco EN
 * PERSONAS. Con 0 estudiantes no se dibuja nada roto (cero división por cero):
 * se muestra el estado "sin datos aún" y se convida a crear el primer curso.
 */

interface AnillosProteccionProps {
    vigilancia: number;
    reaccion: number;
    estudiantes: number;
    sinRedes: number;
    sinContacto: number;
    estado: EstadoSistema;
    className?: string;
}

export function AnillosProteccion({
    vigilancia,
    reaccion,
    estudiantes,
    sinRedes,
    sinContacto,
    estado,
    className = "",
}: AnillosProteccionProps) {
    if (estudiantes === 0) {
        return (
            <PanelVidrio className={`flex h-full flex-col items-center justify-center p-6 text-center sm:p-8 ${className}`}>
                <h2 className="titular-seccion text-body">Anillos de protección</h2>
                <p className="cuerpo mt-3 text-muted">
                    Aún no hay estudiantes para dibujar. Cuando crees tu primer curso, estos anillos
                    mostrarán a cuántos puedes ver y a cuántos puedes llamar.
                </p>
                <Link
                    href="/dashboard/colegio/cursos/unificado"
                    className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl accent-gradient px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
                >
                    Crear primer curso →
                </Link>
            </PanelVidrio>
        );
    }

    return (
        <PanelVidrio className={`flex h-full flex-col items-center p-6 sm:p-8 ${className}`}>
            <h2 className="titular-seccion self-start text-body">Anillos de protección</h2>
            <Anillo
                vigilancia={vigilancia}
                reaccion={reaccion}
                estudiantes={estudiantes}
                sinRedes={sinRedes}
                sinContacto={sinContacto}
                estado={estado}
                className="mt-4"
            />
            <p className="mt-4 text-center text-xs text-subtle">
                Vigilancia: estudiantes con identificadores digitales registrados · Reacción: con
                acudiente a quien llamar
            </p>
        </PanelVidrio>
    );
}
