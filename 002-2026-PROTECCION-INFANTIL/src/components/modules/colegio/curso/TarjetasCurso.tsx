import { TarjetaMetrica } from "@/components/ui/TarjetaMetrica";

/**
 * SPEC-147 (US1, FR-001) — Tarjetas de estado del curso (mockup §5.5):
 * "Reportes 30d" (métrica D2: reportes DISTINTOS, con delta vs los 30 días
 * anteriores) e "Identificadores" (total activo + cobertura en %).
 * I-29: solo conteos agregados — cero scores.
 */

interface TarjetasCursoProps {
    alertas30d: number;
    delta30d: number;
    identificadoresActivos: number;
    /** Cobertura de identificadores en porcentaje entero (0-100). */
    coberturaPct: number;
    /** SPEC-163: total de acudientes activos del curso. */
    acudientesActivos: number;
    className?: string;
}

export function textoDelta(delta: number): string {
    if (delta > 0) return `↑ ${delta} vs mes previo`;
    if (delta < 0) return `↓ ${Math.abs(delta)} vs mes previo`;
    return "sin cambio vs mes previo";
}

export function TarjetasCurso({
    alertas30d,
    delta30d,
    identificadoresActivos,
    coberturaPct,
    acudientesActivos,
    className = "",
}: TarjetasCursoProps) {
    return (
        <section aria-label="Estado del curso" className={`grid grid-cols-2 gap-3 ${className}`}>
            <TarjetaMetrica disposicion="panel" label="Reportes 30d" value={alertas30d} sub={textoDelta(delta30d)} />
            <TarjetaMetrica
                disposicion="panel"
                label="Identificadores"
                value={identificadoresActivos}
                sub={`Cobertura ${coberturaPct}%`}
            />
            <TarjetaMetrica disposicion="panel" label="Acudientes" value={acudientesActivos} sub="activos" />
        </section>
    );
}
