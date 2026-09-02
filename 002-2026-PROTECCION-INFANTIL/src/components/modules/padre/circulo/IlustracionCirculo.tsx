/**
 * A-73 (SPEC-367) · Ilustración del círculo: tú y tus hijos al centro, y
 * alrededor las personas que vigilas. Los lugares libres invitan a agregar.
 *
 * Es solo visual: NO lee el módulo "A quién protejo" (no hay relación en BD).
 * Los colores salen de las variables del sistema de diseño, no de la paleta
 * suelta de Tailwind (piso de `tokens:check`). Nunca rojo: ámbar es la alerta.
 */
import { iniciales, nombreVisible, tonoDeContacto, type Contacto } from "./tipos";

const PINO = "rgb(var(--pino-rgb))";
const PINO_CLARO = "rgb(var(--pino-100-rgb))";
const AMBAR = "rgb(var(--ambar-rgb))";
const AMBAR_INK = "rgb(var(--ambar-ink-rgb))";
const AMBAR_SUAVE = "rgb(var(--ambar-rgb) / 0.14)";
const TRAZO = "rgb(var(--tinta-rgb) / 0.18)";
const APAGADO = "rgb(var(--tinta-subtle-rgb))";
const PAPEL = "rgb(var(--papel-rgb))";

/** Las cuatro posiciones del anillo, en el orden en que se van llenando. */
const PUESTOS = [
    { x: 245, y: 45, etiquetaY: 20 },
    { x: 115, y: 45, etiquetaY: 20 },
    { x: 245, y: 175, etiquetaY: 205 },
    { x: 115, y: 175, etiquetaY: 205 },
] as const;

export function IlustracionCirculo({ contactos }: { contactos: Contacto[] }) {
    // Se muestran hasta cuatro; los de atención primero para que se vean.
    const orden = [...contactos].sort((a, b) => {
        const peso = (c: Contacto) => (tonoDeContacto(c) === "ambar" ? 0 : tonoDeContacto(c) === "verde" ? 1 : 2);
        return peso(a) - peso(b);
    });
    const enElAnillo = orden.slice(0, PUESTOS.length);
    const libres = PUESTOS.slice(enElAnillo.length);

    const descripcion =
        enElAnillo.length === 0
            ? "Tú y tus hijos al centro; alrededor, lugares libres para las personas que vas a vigilar"
            : `Tú y tus hijos al centro; alrededor, ${enElAnillo.length} persona${enElAnillo.length === 1 ? "" : "s"} que vigilas`;

    return (
        <svg
            viewBox="0 0 360 220"
            role="img"
            aria-label={descripcion}
            className="mx-auto block h-auto w-full max-w-[360px]"
        >
            <circle cx="180" cy="110" r="92" fill="none" stroke={TRAZO} strokeWidth="1.5" strokeDasharray="3 7" />

            {/* Un hilo del centro a cada puesto ocupado */}
            {enElAnillo.map((c, i) => {
                const p = PUESTOS[i]!;
                const enAtencion = tonoDeContacto(c) === "ambar";
                return (
                    <line
                        key={`hilo-${c.id}`}
                        x1="180"
                        y1="110"
                        x2={p.x}
                        y2={p.y}
                        stroke={enAtencion ? AMBAR : TRAZO}
                        strokeWidth={enAtencion ? 2 : 1.3}
                    />
                );
            })}
            {libres.map((p) => (
                <line key={`hilo-libre-${p.x}-${p.y}`} x1="180" y1="110" x2={p.x} y2={p.y} stroke={TRAZO} strokeWidth="1.3" />
            ))}

            {/* El centro: tú y tus hijos */}
            <circle cx="180" cy="110" r="46" fill={PINO} />
            <circle cx="180" cy="92" r="9" fill={PAPEL} />
            <path d="M180 103c-9 0-15 6-15 14v11h30v-11c0-8-6-14-15-14z" fill={PAPEL} />
            <circle cx="160" cy="118" r="6" fill={PINO_CLARO} />
            <path d="M160 126c-6 0-9.5 4-9.5 9v7h19v-7c0-5-3.5-9-9.5-9z" fill={PINO_CLARO} />
            <circle cx="200" cy="118" r="6" fill={PINO_CLARO} />
            <path d="M200 126c-6 0-9.5 4-9.5 9v7h19v-7c0-5-3.5-9-9.5-9z" fill={PINO_CLARO} />
            <text x="180" y="176" textAnchor="middle" fontSize="11.5" fontWeight="600" fill={PINO}>
                Tú y tus hijos
            </text>

            {/* Las personas del anillo */}
            {enElAnillo.map((c, i) => {
                const p = PUESTOS[i]!;
                const tono = tonoDeContacto(c);
                const nombre = nombreVisible(c);
                const corto = nombre.split(/\s+/)[0] ?? nombre;
                return (
                    <g key={c.id}>
                        {tono === "ambar" && (
                            <circle cx={p.x} cy={p.y} r="24" fill="none" stroke={AMBAR} strokeWidth="2" opacity="0.45" />
                        )}
                        <circle
                            cx={p.x}
                            cy={p.y}
                            r="18"
                            fill={tono === "ambar" ? AMBAR_SUAVE : PAPEL}
                            stroke={tono === "ambar" ? AMBAR : tono === "gris" ? APAGADO : PINO}
                            strokeWidth={tono === "ambar" ? 2.4 : 2.2}
                        />
                        <text
                            x={p.x}
                            y={p.y + 4.5}
                            textAnchor="middle"
                            fontSize="12"
                            fontWeight="700"
                            fill={tono === "ambar" ? AMBAR_INK : tono === "gris" ? APAGADO : PINO}
                        >
                            {iniciales(nombre)}
                        </text>
                        <text
                            x={p.x}
                            y={p.etiquetaY}
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight="600"
                            fill={tono === "ambar" ? AMBAR_INK : APAGADO}
                        >
                            {corto}
                        </text>
                    </g>
                );
            })}

            {/* Lugares libres: el "+" invita a seguir */}
            {libres.map((p) => (
                <g key={`libre-${p.x}-${p.y}`}>
                    <circle cx={p.x} cy={p.y} r="17" fill={PAPEL} stroke={TRAZO} strokeWidth="1.6" strokeDasharray="3 3" />
                    <path
                        d={`M${p.x} ${p.y - 6}v12M${p.x - 6} ${p.y}h12`}
                        stroke={PINO}
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                </g>
            ))}
        </svg>
    );
}
