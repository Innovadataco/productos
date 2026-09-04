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

/**
 * Cuatro posiciones fijas del anillo — usadas SOLO cuando hay ≤ 4 personas.
 * A partir de 5 el anillo pasa a modo generado (ver `puestosParaN` abajo).
 * SPEC-440 P2 (Jelkin vivo 04-09): antes se dibujaban SIEMPRE estos 4, aunque
 * hubiera 5, 10 o 20 personas — «el círculo con 4 teniendo 5» fue el bug
 * reportado. El brief tope 20 marca el máximo a acomodar.
 */
const PUESTOS_FIJOS = [
    { x: 245, y: 45, etiquetaY: 20 },
    { x: 115, y: 45, etiquetaY: 20 },
    { x: 245, y: 175, etiquetaY: 205 },
    { x: 115, y: 175, etiquetaY: 205 },
] as const;

/** Centro visual del svg (viewBox 360×220). */
const CENTRO = { x: 180, y: 110 };
/** Radio del anillo donde se acomodan las personas. */
const RADIO_ANILLO = 92;

interface Puesto { x: number; y: number; etiquetaY: number }

/**
 * Devuelve N puestos equidistantes en el anillo. N ≤ 4 usa los 4 fijos para
 * conservar la composición «doble diagonal» que la ilustración tenía en v1.
 * A partir de N=5 se generan en anillo circular. La etiqueta se ubica por
 * fuera del círculo (etiquetaY = y ± 25, según cuadrante) y solo se pinta
 * cuando hay pocos (se apaga con N alto para no pisarse).
 */
function puestosParaN(n: number): Puesto[] {
    if (n <= PUESTOS_FIJOS.length) return PUESTOS_FIJOS.slice(0, Math.max(n, PUESTOS_FIJOS.length));
    const puestos: Puesto[] = [];
    for (let i = 0; i < n; i++) {
        const angulo = (2 * Math.PI * i) / n - Math.PI / 2;
        const x = CENTRO.x + RADIO_ANILLO * Math.cos(angulo);
        const y = CENTRO.y + RADIO_ANILLO * Math.sin(angulo);
        // Etiqueta hacia afuera: arriba del círculo si el puesto está en la
        // mitad superior, abajo si está en la inferior.
        const etiquetaY = y < CENTRO.y ? Math.round(y - 25) : Math.round(y + 32);
        puestos.push({ x: Math.round(x), y: Math.round(y), etiquetaY });
    }
    return puestos;
}

/** Radio del avatar según cuántas personas comparten el anillo. */
function radioAvatar(n: number): number {
    if (n <= 4) return 18;
    if (n <= 8) return 15;
    if (n <= 12) return 12;
    return 10;
}

/** Fuente de las iniciales, coordinada con el radio del avatar. */
function fontIniciales(n: number): number {
    if (n <= 4) return 12;
    if (n <= 8) return 10.5;
    if (n <= 12) return 9;
    return 8;
}

/** Con más de 6 personas la etiqueta del nombre se pisa, la apagamos. */
function pintarEtiquetaNombre(n: number): boolean {
    return n <= 6;
}

export function IlustracionCirculo({ contactos }: { contactos: Contacto[] }) {
    // Los de atención primero (ámbar antes que verde antes que gris) para que
    // cuando la composición es apretada, el ojo caiga en ellos.
    const orden = [...contactos].sort((a, b) => {
        const peso = (c: Contacto) => (tonoDeContacto(c) === "ambar" ? 0 : tonoDeContacto(c) === "verde" ? 1 : 2);
        return peso(a) - peso(b);
    });
    // Con 0 contactos, mostramos 4 lugares libres invitando a agregar. Con 1..3
    // completamos hasta 4 puestos con lugares libres. Con 4 exactos, todos
    // ocupados. Con 5+, el anillo se distribuye entero: sin lugares libres.
    const puestos = puestosParaN(Math.max(orden.length, PUESTOS_FIJOS.length));
    const enElAnillo = orden.slice(0, puestos.length);
    const libres = orden.length < PUESTOS_FIJOS.length
        ? puestos.slice(enElAnillo.length)
        : [];
    const rAvatar = radioAvatar(orden.length);
    const fIniciales = fontIniciales(orden.length);
    const conEtiqueta = pintarEtiquetaNombre(orden.length);

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
                const p = puestos[i]!;
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
                const p = puestos[i]!;
                const tono = tonoDeContacto(c);
                const nombre = nombreVisible(c);
                const corto = nombre.split(/\s+/)[0] ?? nombre;
                return (
                    <g key={c.id}>
                        {tono === "ambar" && (
                            <circle cx={p.x} cy={p.y} r={rAvatar + 6} fill="none" stroke={AMBAR} strokeWidth="2" opacity="0.45" />
                        )}
                        <circle
                            cx={p.x}
                            cy={p.y}
                            r={rAvatar}
                            fill={tono === "ambar" ? AMBAR_SUAVE : PAPEL}
                            stroke={tono === "ambar" ? AMBAR : tono === "gris" ? APAGADO : PINO}
                            strokeWidth={tono === "ambar" ? 2.4 : 2.2}
                        />
                        <text
                            x={p.x}
                            y={p.y + fIniciales * 0.36}
                            textAnchor="middle"
                            fontSize={fIniciales}
                            fontWeight="700"
                            fill={tono === "ambar" ? AMBAR_INK : tono === "gris" ? APAGADO : PINO}
                        >
                            {iniciales(nombre)}
                        </text>
                        {conEtiqueta && (
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
                        )}
                    </g>
                );
            })}

            {/* Lugares libres: el "+" invita a seguir (solo aparece con 0..3 contactos). */}
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
