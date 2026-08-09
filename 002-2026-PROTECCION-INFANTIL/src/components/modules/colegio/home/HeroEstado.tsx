import Link from "next/link";
import { Declaracion } from "@/components/ui/Declaracion";
import { PanelVidrio } from "@/components/ui/PanelVidrio";
import type { EstadoSistema } from "@/components/ui/Anillo";

/**
 * SPEC-143 (US1, FR-004) — Hero de estado: la declaración del semáforo con su luz
 * ambiental y el punto que late cada 3,4 s (único bucle del sistema).
 *
 * CONDICIÓN DE COPY (ZEUS, D1): en ámbar el texto dice EXPLÍCITAMENTE que ya está
 * atendido ("hubo algo y ya lo atendiste") — el ámbar nunca se lee como trabajo
 * pendiente cuando no lo hay.
 */

interface CopyEstado {
    titular: string;
    palabra: string;
    detalle: string;
    etiqueta: string;
}

const COPY: Record<EstadoSistema, CopyEstado> = {
    pino: {
        titular: "Tu colegio está {palabra}",
        palabra: "tranquilo",
        detalle: "Sin alertas nuevas sobre tus estudiantes.",
        etiqueta: "Tranquilo",
    },
    ambar: {
        titular: "Hubo {palabra} y ya lo atendiste",
        palabra: "algo",
        detalle: "Las señales recientes ya están atendidas: no tienes nada pendiente.",
        etiqueta: "Atendido",
    },
    rubi: {
        titular: "Tu colegio {palabra}",
        palabra: "necesita que actúes hoy",
        detalle: "Tienes alertas nuevas sobre tus estudiantes sin gestionar.",
        etiqueta: "Actúa hoy",
    },
};

const PUNTO_ESTADO: Record<EstadoSistema, string> = {
    pino: "bg-pino",
    ambar: "bg-ambar",
    rubi: "bg-rubi",
};

interface HeroEstadoProps {
    estado: EstadoSistema;
    className?: string;
}

export function HeroEstado({ estado, className = "" }: HeroEstadoProps) {
    const copy = COPY[estado];
    return (
        <PanelVidrio estado={estado} className={`p-6 sm:p-10 ${className}`}>
            <div className="flex items-center gap-2.5">
                <span
                    aria-hidden="true"
                    data-punto-estado={estado}
                    className={`anim-pulso inline-block h-3 w-3 rounded-full ${PUNTO_ESTADO[estado]}`}
                />
                <p className="microetiqueta">Protección del colegio hoy · {copy.etiqueta}</p>
            </div>
            <Declaracion titular={copy.titular} palabra={copy.palabra} estado={estado} className="mt-4" />
            <p className="cuerpo mt-4 text-muted">{copy.detalle}</p>
            {estado === "rubi" && (
                <Link
                    href="/dashboard/colegio/alertas"
                    className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl accent-gradient px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
                >
                    Ver avisos nuevos →
                </Link>
            )}
        </PanelVidrio>
    );
}
