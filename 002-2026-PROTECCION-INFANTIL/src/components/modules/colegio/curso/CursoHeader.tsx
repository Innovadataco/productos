import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

/**
 * SPEC-147 (US1, FR-001) — Encabezado del escritorio del curso (mockup §5.5):
 * "← Volver a cursos", nombre del curso (marcado si está inactivo), profesor
 * titular — o "sin titular asignado"; el titular INACTIVO se muestra marcado
 * ("· inactivo", COND-2 de SPEC-145: trazabilidad forense) —, conteo de
 * estudiantes activos y el verbo "Editar curso".
 */

export interface TitularVista {
    nombre: string;
    apellidos: string;
    estado: string;
}

interface CursoHeaderProps {
    nombre: string;
    estadoCurso: string;
    titular: TitularVista | null;
    totalEstudiantes: number;
    onEditar: () => void;
    accionExtra?: React.ReactNode;
}

export function CursoHeader({ nombre, estadoCurso, titular, totalEstudiantes, onEditar, accionExtra }: CursoHeaderProps) {
    return (
        <header>
            <Link
                href="/dashboard/colegio/cursos"
                className="inline-flex min-h-12 items-center rounded-lg text-sm font-semibold text-accent transition hover:underline"
            >
                ← Volver a cursos
            </Link>
            <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-body">
                        {nombre}{" "}
                        {estadoCurso !== "activo" ? <Badge variant="neutral">inactivo</Badge> : null}
                    </h1>
                    <p className="mt-1 text-sm text-muted">
                        {titular ? (
                            <>
                                Prof. titular: {titular.nombre} {titular.apellidos}
                                {titular.estado !== "activo" ? <span className="text-subtle"> · inactivo</span> : null}
                            </>
                        ) : (
                            "Sin titular asignado"
                        )}
                        <span aria-hidden="true"> · </span>
                        {totalEstudiantes} {totalEstudiantes === 1 ? "estudiante" : "estudiantes"}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {accionExtra}
                    <Button variant="outline" className="min-h-12" onClick={onEditar}>
                        Editar curso
                    </Button>
                </div>
            </div>
        </header>
    );
}
