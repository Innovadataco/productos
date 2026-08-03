import type { EstadoSistema } from "./Anillo";

/**
 * SPEC-157 (§4.1) — La declaración de estado: el sistema le habla al rector.
 * El titular va en Instrument Serif (titular-estado); la palabra del estado
 * (*tranquilos* / *algo* / *necesita que actúes hoy*) en cursiva serif y en el
 * color del estado por token. La cursiva es del sistema, no decorativa.
 *
 * El titular marca la posición de la palabra con `{palabra}`; si no lo trae, la
 * palabra se añade al final.
 */

interface DeclaracionProps {
    titular: string;
    palabra: string;
    estado: EstadoSistema;
    className?: string;
}

const MARCADOR = "{palabra}";

export function Declaracion({ titular, palabra, estado, className = "" }: DeclaracionProps) {
    const clasePalabra = `palabra-estado text-estado-${estado}`;
    const indice = titular.indexOf(MARCADOR);

    const antes = indice >= 0 ? titular.slice(0, indice) : titular.endsWith(" ") ? titular : `${titular} `;
    const despues = indice >= 0 ? titular.slice(indice + MARCADOR.length) : "";

    return (
        <h1 className={`titular-estado text-body ${className}`}>
            {antes}
            <em className={clasePalabra}>{palabra}</em>
            {despues}
        </h1>
    );
}
