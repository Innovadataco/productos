import { useId } from "react";

/**
 * El Guardián — símbolo de marca (MARCA-EL-GUARDIAN.md, aprobada por Jelkin 30-08-2026).
 *
 * Un escudo de una tinta con la figura del niño RECORTADA en su interior (§2: si sacás
 * la protección, desaparece lo protegido), ocho nodos sobre el borde (IA + la red humana)
 * y un barrido de vigilancia. Colores del sistema (§5): `--pino-rgb` (escudo), `--cielo-rgb`
 * (nodos/barrido), `--ambar-rgb` (único color de alerta · §7: nada de rojo). Se adapta a
 * claro/oscuro por los tokens. La animación respeta `prefers-reduced-motion` (§7).
 *
 * Tres tallas (§4): "viva" (escudo+niño+8 nodos+barrido), "reducida" (+4 nodos), "minima"
 * (solo escudo+niño). El hueco del niño NUNCA se quita (§7).
 */
type GuardianVariante = "viva" | "reducida" | "minima";
type GuardianEstado = "calma" | "alerta";

const NODOS = [
    { cx: 50, cy: 8, delay: 0 },
    { cx: 82, cy: 20, delay: 0.18 },
    { cx: 82, cy: 42, delay: 0.36 },
    { cx: 74, cy: 70, delay: 0.54 },
    { cx: 50, cy: 91, delay: 0.72 },
    { cx: 26, cy: 70, delay: 0.9 },
    { cx: 18, cy: 42, delay: 1.08 },
    { cx: 18, cy: 20, delay: 1.26 },
];

const ESCUDO = "M50 8 82 20v29C82 69.4 68.4 85.6 50 91 31.6 85.6 18 69.4 18 49V20L50 8Z";

export function Guardian({
    className = "h-8 w-8",
    variante = "viva",
    estado = "calma",
    title = "Protección Infantil",
}: {
    className?: string;
    variante?: GuardianVariante;
    estado?: GuardianEstado;
    title?: string;
}) {
    const uid = useId().replace(/:/g, "");
    const maskId = `pi-hueco-${uid}`;
    const clipId = `pi-dentro-${uid}`;

    // §4: en talla mínima solo escudo + niño; reducida = 4 nodos; viva = 8.
    const nodos = variante === "minima" ? [] : variante === "reducida" ? NODOS.filter((_, i) => i % 2 === 0) : NODOS;
    const conBarrido = variante !== "minima";
    // §3: en alerta un solo nodo va en ámbar; los demás atenuados. El header va en calma.
    const nodoAlerta = estado === "alerta" ? 2 : -1;

    return (
        <svg viewBox="0 0 100 100" role="img" aria-label={title} className={className}>
            <defs>
                <mask id={maskId}>
                    <rect width="100" height="100" fill="#fff" />
                    <g fill="#000">
                        <circle cx="50" cy="44" r="7" />
                        <path d="M50 53c-7.2 0-12.7 5.3-12.7 12.5v6.2c0 1.2 1 2.2 2.2 2.2h21c1.2 0 2.2-1 2.2-2.2v-6.2C62.7 58.3 57.2 53 50 53Z" />
                    </g>
                </mask>
                <clipPath id={clipId}>
                    <path d={ESCUDO} />
                </clipPath>
            </defs>
            <g className="pi-cuerpo" data-estado={estado}>
                <path mask={`url(#${maskId})`} fill="rgb(var(--pino-rgb))" d={ESCUDO} />
                {conBarrido && (
                    <g clipPath={`url(#${clipId})`}>
                        <rect className="pi-scan" x="14" y="47" width="72" height="2.4" rx="1.2" fill="rgb(var(--cielo-rgb))" />
                    </g>
                )}
                {nodos.map((n, i) => {
                    const esAlerta = i === nodoAlerta;
                    return (
                        <circle
                            key={`${n.cx}-${n.cy}`}
                            className="pi-nd"
                            cx={n.cx}
                            cy={n.cy}
                            r="3"
                            fill={esAlerta ? "rgb(var(--ambar-rgb))" : "rgb(var(--cielo-rgb))"}
                            style={{
                                animationDelay: `${n.delay}s`,
                                ...(estado === "alerta" && !esAlerta ? { opacity: 0.45 } : {}),
                            }}
                        />
                    );
                })}
            </g>
        </svg>
    );
}
