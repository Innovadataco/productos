/**
 * SPEC-494 · Mueble Skeleton (§4.8) — el fantasma de carga que reemplaza el
 * spinner de PÁGINA. Preserva el layout real (silueta, no una caja gris): al
 * llegar los datos, el contenido aparece sin salto de grilla.
 *
 * - Relleno por token `--skeleton` (nunca `bg-slate-*` crudo). Shimmer suave por
 *   la clase `.skeleton` (globals.css); `prefers-reduced-motion` lo apaga y deja
 *   el fantasma estático visible.
 * - Accesibilidad: envolvé los bloques en `<SkeletonContainer>` (aria-busy +
 *   label); los bloques son decorativos (`aria-hidden`).
 * - El spinner-EN-BOTÓN (acción en curso) NO es esto y se conserva.
 */
import type { ReactNode, CSSProperties } from "react";

/** Bloque base: un rectángulo fantasma. El radio/tamaño se pasa por className. */
export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
    return <div className={`skeleton ${className}`.trim()} style={style} aria-hidden="true" />;
}

/** Contenedor accesible: anuncia "cargando" una vez; los bloques quedan mudos. */
export function SkeletonContainer({
    children,
    className = "",
    label = "Cargando…",
}: {
    children: ReactNode;
    className?: string;
    label?: string;
}) {
    return (
        <div role="status" aria-busy="true" aria-label={label} className={className}>
            {children}
        </div>
    );
}

/** Líneas de texto; la última al 60% de ancho (§ del mueble). */
export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
    return (
        <div className={`space-y-2 ${className}`.trim()} aria-hidden="true">
            {Array.from({ length: lines }).map((_, i) => (
                <div key={i} className={`skeleton h-3.5 rounded ${i === lines - 1 ? "w-3/5" : "w-full"}`} />
            ))}
        </div>
    );
}

/** Anillo/avatar. */
export function SkeletonCircle({ size = 48, className = "" }: { size?: number; className?: string }) {
    return <Skeleton className={`rounded-full ${className}`.trim()} style={{ width: size, height: size }} />;
}

/** Tarjeta fantasma (radio de tarjeta del sistema). */
export function SkeletonCard({ className = "" }: { className?: string }) {
    return <Skeleton className={`rounded-[var(--radio-card)] ${className}`.trim()} />;
}
