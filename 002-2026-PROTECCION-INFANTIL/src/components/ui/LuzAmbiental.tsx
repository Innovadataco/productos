import type { CSSProperties } from "react";
import type { EstadoSistema } from "./Anillo";

/**
 * SPEC-157 (§4.6) — Campo de luz ambiental detrás del vidrio.
 * La traslucidez solo se percibe con algo detrás: un campo de radiales que cambia
 * de color con el estado del colegio (pino → ámbar → rubí). Color SOLO por token.
 * Es decorativo de atmósfera: aria-hidden; el dato lo dan los anillos (§4.0.2).
 */

const TOKEN_ESTADO: Record<EstadoSistema, string> = {
    pino: "--pino-rgb",
    ambar: "--ambar-rgb",
    rubi: "--rubi-rgb",
};

interface LuzAmbientalProps {
    estado: EstadoSistema;
    className?: string;
}

export function LuzAmbiental({ estado, className = "" }: LuzAmbientalProps) {
    const token = TOKEN_ESTADO[estado];
    const estilo: CSSProperties = {
        background: `
            radial-gradient(560px 380px at 25% 15%, rgb(var(${token}) / 0.22) 0%, transparent 60%),
            radial-gradient(480px 340px at 80% 85%, rgb(var(${token}) / 0.16) 0%, transparent 55%),
            rgb(var(--papel-rgb))
        `,
    };
    return (
        <div
            aria-hidden="true"
            data-estado={estado}
            className={`absolute inset-0 -z-10 overflow-hidden rounded-[inherit] ${className}`}
            style={estilo}
        />
    );
}
