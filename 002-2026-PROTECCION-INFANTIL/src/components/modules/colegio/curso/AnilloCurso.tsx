import { Anillo } from "@/components/ui/Anillo";

/**
 * SPEC-147 (US1, FR-001) — Anillo mini (88px) del curso: la misma forma firma de
 * la home a escala de curso (§4.3) + texto corto con los dos porcentajes.
 * Con 0 estudiantes las fracciones ya vienen en 0 (sin NaN) y se dibujan los
 * arcos vacíos — el empty state del curso lo resuelve la página.
 */

interface AnilloCursoProps {
    vigilancia: number;
    reaccion: number;
    estudiantes: number;
    sinRedes: number;
    sinContacto: number;
    className?: string;
}

export function AnilloCurso({ vigilancia, reaccion, estudiantes, sinRedes, sinContacto, className = "" }: AnilloCursoProps) {
    const pctRedes = Math.round(vigilancia * 100);
    const pctAcudiente = Math.round(reaccion * 100);

    return (
        <div className={`flex items-center gap-4 ${className}`}>
            <Anillo
                vigilancia={vigilancia}
                reaccion={reaccion}
                estudiantes={estudiantes}
                sinRedes={sinRedes}
                sinContacto={sinContacto}
                size={88}
            />
            <p className="text-sm text-muted">
                <span className="cifra font-semibold text-body">{pctRedes}%</span> con redes
                <span aria-hidden="true"> · </span>
                <span className="cifra font-semibold text-body">{pctAcudiente}%</span> con acudiente
            </p>
        </div>
    );
}
