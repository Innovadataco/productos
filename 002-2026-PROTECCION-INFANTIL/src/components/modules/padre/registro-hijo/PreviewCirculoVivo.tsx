import { iniciales } from "../circulo/tipos";

/**
 * SPEC-599 · PreviewCirculoVivo — el hijo que se está registrando, dentro del
 * círculo de confianza, reactivo a los datos del formulario. Mismo lenguaje
 * visual que `circulo/IlustracionCirculo.tsx` (viewBox 360×220, centro
 * (180,110) r=46 pino, anillo punteado, puesto del hijo arriba con hilo).
 *
 * Es una VISTA del alta: no lee el módulo «A quién protejo» (misma separación
 * que la ilustración original). Los colores salen de las variables del sistema
 * de diseño — nunca rojo: ámbar es la alerta (tono del círculo).
 */

/** Tono del puesto del hijo: verde = sin reportes · ámbar = requiere atención. */
export type TonoPreview = "verde" | "ambar";

const PINO = "rgb(var(--pino-rgb))";
const PINO_INK = "rgb(var(--pino-ink-rgb))";
const AMBAR = "rgb(var(--ambar-rgb))";
const AMBAR_INK = "rgb(var(--ambar-ink-rgb))";
const AMBAR_SUAVE = "rgb(var(--ambar-rgb) / 0.14)";
const TRAZO = "rgb(var(--tinta-rgb) / 0.18)";
const APAGADO = "rgb(var(--tinta-subtle-rgb))";
const PAPEL = "rgb(var(--papel-rgb))";

/** Puesto fijo del hijo (arriba del centro), como los PUESTOS_FIJOS de la ilustración. */
const PUESTO_HIJO = { x: 180, y: 18, etiquetaY: 52 } as const;

export function PreviewCirculoVivo({
    nombre,
    apellidos,
    edad,
    totalCuentas,
    tono,
}: {
    nombre: string;
    apellidos: string;
    edad: number | null;
    totalCuentas: number;
    tono: TonoPreview;
}) {
    const nombreCompleto = `${nombre} ${apellidos}`.trim();
    const hayNombre = nombreCompleto.length > 0;
    const ini = hayNombre ? iniciales(nombreCompleto) : "·";
    const corto = hayNombre ? (nombre.trim().split(/\s+/)[0] ?? nombre) : "";
    const enAtencion = tono === "ambar";
    const borde = enAtencion ? AMBAR : PINO;
    const tintaTexto = enAtencion ? AMBAR_INK : PINO_INK;

    const detalle = [
        edad !== null ? (edad === 1 ? "1 año" : `${edad} años`) : null,
        totalCuentas === 1 ? "1 cuenta protegida" : `${totalCuentas} cuentas protegidas`,
    ]
        .filter(Boolean)
        .join(" · ");

    const descripcion = hayNombre
        ? `Vista previa: ${corto} ya está dentro de tu círculo de confianza`
        : "Vista previa: tu hijo aparecerá en tu círculo de confianza";

    return (
        <div>
            <svg viewBox="0 0 360 220" role="img" aria-label={descripcion} className="mx-auto block h-auto w-full max-w-[360px]">
                <circle cx="180" cy="110" r="92" fill="none" stroke={TRAZO} strokeWidth="1.5" strokeDasharray="3 7" />

                {/* El hilo se enciende cuando el hijo «entra» al círculo. */}
                <line
                    x1="180"
                    y1="110"
                    x2={PUESTO_HIJO.x}
                    y2={PUESTO_HIJO.y}
                    stroke={borde}
                    strokeWidth="2"
                    style={{ opacity: hayNombre ? 1 : 0, transition: "opacity 0.5s var(--curva)" }}
                />

                {/* El centro: tú y tus hijos (idéntico a la ilustración del círculo). */}
                <circle cx="180" cy="110" r="46" fill={PINO} />
                <circle cx="180" cy="92" r="9" fill={PAPEL} />
                <path d="M180 103c-9 0-15 6-15 14v11h30v-11c0-8-6-14-15-14z" fill={PAPEL} />
                <circle cx="160" cy="118" r="6" fill="rgb(var(--pino-100-rgb))" />
                <path d="M160 126c-6 0-9.5 4-9.5 9v7h19v-7c0-5-3.5-9-9.5-9z" fill="rgb(var(--pino-100-rgb))" />
                <circle cx="200" cy="118" r="6" fill="rgb(var(--pino-100-rgb))" />
                <path d="M200 126c-6 0-9.5 4-9.5 9v7h19v-7c0-5-3.5-9-9.5-9z" fill="rgb(var(--pino-100-rgb))" />
                <text x="180" y="176" textAnchor="middle" fontSize="11.5" fontWeight="600" fill={PINO_INK}>
                    Tú y tus hijos
                </text>

                {/* El puesto del hijo: aparece cuando hay nombre. */}
                <g style={{ opacity: hayNombre ? 1 : 0, transition: "opacity 0.5s var(--curva)" }}>
                    <circle cx={PUESTO_HIJO.x} cy={PUESTO_HIJO.y} r="24" fill="none" stroke={borde} strokeWidth="2" opacity="0.45" />
                    <circle
                        cx={PUESTO_HIJO.x}
                        cy={PUESTO_HIJO.y}
                        r="18"
                        fill={enAtencion ? AMBAR_SUAVE : PAPEL}
                        stroke={borde}
                        strokeWidth="2.2"
                    />
                    <text x={PUESTO_HIJO.x} y={PUESTO_HIJO.y + 4.5} textAnchor="middle" fontSize="12" fontWeight="700" fill={tintaTexto}>
                        {ini}
                    </text>
                    {corto && (
                        <text x={PUESTO_HIJO.x} y={PUESTO_HIJO.etiquetaY} textAnchor="middle" fontSize="11" fontWeight="600" fill={enAtencion ? AMBAR_INK : APAGADO}>
                            {corto}
                        </text>
                    )}
                </g>

                {/* Lugares libres (misma invitación que la ilustración). */}
                {[
                    { x: 245, y: 45 },
                    { x: 115, y: 45 },
                ].map((p) => (
                    <g key={`libre-${p.x}`}>
                        <circle cx={p.x} cy={p.y} r="17" fill={PAPEL} stroke={TRAZO} strokeWidth="1.6" strokeDasharray="3 3" />
                        <path d={`M${p.x} ${p.y - 6}v12M${p.x - 6} ${p.y}h12`} stroke={PINO} strokeWidth="2" strokeLinecap="round" />
                    </g>
                ))}
            </svg>

            {/* Tarjeta del hijo con su estado. */}
            <div
                className={`mt-3 flex items-center gap-3 rounded-2xl border p-3 transition ease-barrido ${
                    hayNombre
                        ? enAtencion
                            ? "border-ambar/50 bg-ambar/10"
                            : "border-pino/40 bg-pino/10"
                        : "border-dashed border-tinta/20"
                }`}
            >
                <span
                    aria-hidden="true"
                    className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border-2 text-sm font-bold transition ease-barrido ${
                        hayNombre
                            ? enAtencion
                                ? "border-ambar text-estado-ambar"
                                : "border-pino text-estado-pino"
                            : "border-dashed border-tinta/25 text-subtle"
                    }`}
                >
                    {ini}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-body">
                        {hayNombre ? nombreCompleto : "Tu hijo aparecerá aquí"}
                    </p>
                    <p className="text-xs text-muted">
                        {hayNombre
                            ? detalle || "Sin cuentas todavía"
                            : "Escribe su nombre para verlo en el círculo"}
                    </p>
                </div>
                <span
                    role="status"
                    className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold transition ease-barrido ${
                        enAtencion ? "bg-ambar/15 text-estado-ambar" : "bg-pino/15 text-estado-pino"
                    }`}
                >
                    {enAtencion ? "1 reporte en revisión" : "Sin reportes"}
                </span>
            </div>
        </div>
    );
}
