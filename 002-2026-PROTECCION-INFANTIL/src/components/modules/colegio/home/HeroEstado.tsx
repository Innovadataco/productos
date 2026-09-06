import Link from "next/link";
import { Declaracion } from "@/components/ui/Declaracion";
import { PanelVidrio } from "@/components/ui/PanelVidrio";
import { colorDeEstadoColegio, type EstadoColegio } from "@/lib/colegio/semaforo";

/**
 * SPEC-143 (US1, FR-004) → SPEC-560 (D-120) — Hero de estado: la declaración del
 * semáforo con su luz ambiental y el punto que late cada 3,4 s.
 *
 * El hero se maneja por estado SEMÁNTICO (`EstadoColegio`), no por color. D-120:
 * PENDIENTE = ámbar (hay que actuar hoy, con CTA a las alertas); ATENDIDO y
 * TRANQUILO = pino (al día). El rubí NO vive en el hero — queda para la alerta de
 * alto riesgo en su tarjeta. El color lo decide `colorDeEstadoColegio`, así cambiar
 * un color no cambia lo que el estado significa.
 */
interface CopyEstado {
    titular: string;
    palabra: string;
    detalle: string;
    etiqueta: string;
}

const COPY: Record<EstadoColegio, CopyEstado> = {
    PENDIENTE: {
        titular: "Su colegio {palabra}",
        palabra: "necesita que actúe hoy",
        detalle: "Tiene alertas nuevas sobre sus estudiantes sin gestionar.",
        etiqueta: "Actúe hoy",
    },
    ATENDIDO: {
        titular: "Hubo {palabra} y ya lo atendió",
        palabra: "algo",
        detalle: "Las señales recientes ya están atendidas: no tiene nada pendiente.",
        etiqueta: "Al día",
    },
    TRANQUILO: {
        titular: "Su colegio está {palabra}",
        palabra: "tranquilo",
        detalle: "Sin alertas nuevas sobre sus estudiantes.",
        etiqueta: "Tranquilo",
    },
};

// SPEC-566 (D-120): sin rubí — el hero ya no puede llegar a ese estado
// (colorDeEstadoColegio devuelve solo pino|ambar). Era código muerto.
const PUNTO_ESTADO = {
    pino: "bg-pino",
    ambar: "bg-ambar",
} as const;

interface HeroEstadoProps {
    estado: EstadoColegio;
    className?: string;
}

export function HeroEstado({ estado, className = "" }: HeroEstadoProps) {
    const copy = COPY[estado];
    const color = colorDeEstadoColegio(estado);
    return (
        <PanelVidrio estado={color} className={`p-6 sm:p-10 ${className}`}>
            <div className="flex items-center gap-2.5">
                <span
                    aria-hidden="true"
                    data-punto-estado={color}
                    className={`anim-pulso inline-block h-3 w-3 rounded-full ${PUNTO_ESTADO[color]}`}
                />
                <p className="microetiqueta">Protección del colegio hoy · {copy.etiqueta}</p>
            </div>
            <Declaracion titular={copy.titular} palabra={copy.palabra} estado={color} className="mt-4" />
            <p className="cuerpo mt-4 text-muted">{copy.detalle}</p>
            {estado === "PENDIENTE" && (
                <Link
                    href="/dashboard/colegio/alertas"
                    className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl accent-gradient px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
                >
                    Ver alertas →
                </Link>
            )}
        </PanelVidrio>
    );
}
