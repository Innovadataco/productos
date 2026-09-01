"use client";

/**
 * SPEC-344 (A-69 · C1) — Paso 4 · Cursos y materias.
 *
 * Los 11 grados vienen sembrados desde `crearColegioMinimo` (D-5). El rector
 * puede quitar los que no aplican (inactivarlos, nada-se-borra); puede
 * continuar cuando hay ≥ 1 curso activo — los 11 sembrados cumplen esta
 * condición desde el arranque. La asignación materia↔profesor con candado
 * D3 (`FR-030`) vive en la ficha detallada del curso y en el endpoint
 * `POST /api/colegio/cursos/[id]/materias`; es opcional en el camino.
 *
 * Voz: usted formal Colombia.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";

interface CursoItem {
    id: string;
    nombre: string;
    grado: string | null;
    anioLectivo: string | null;
    estado: string;
}

export default function PasoCursosColegio() {
    const router = useRouter();
    const [cursos, setCursos] = useState<CursoItem[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cambiando, setCambiando] = useState<string | null>(null);

    const cargar = async () => {
        setCargando(true);
        try {
            const res = await fetch("/api/colegio/cursos?incluirInactivos=true", { credentials: "include" });
            if (!res.ok) throw new Error("No pudimos cargar los cursos.");
            const json = await res.json();
            setCursos(((json.cursos ?? json.items) ?? []) as CursoItem[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error cargando cursos.");
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => { void cargar(); }, []);

    const inactivar = async (id: string) => {
        setCambiando(id);
        try {
            const res = await fetch(`/api/colegio/cursos/${id}/estado`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                // Contrato del endpoint (SPEC-355 · ítem 6): el body es el
                // string pelado, igual que CursosPageClient — {estado: …} da 400.
                body: JSON.stringify("inactivo"),
            });
            if (!res.ok) throw new Error("No pudimos inactivar el curso.");
            await cargar();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error inactivando.");
        } finally {
            setCambiando(null);
        }
    };

    const reactivar = async (id: string) => {
        setCambiando(id);
        try {
            const res = await fetch(`/api/colegio/cursos/${id}/estado`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify("activo"),
            });
            if (!res.ok) throw new Error("No pudimos reactivar el curso.");
            await cargar();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error reactivando.");
        } finally {
            setCambiando(null);
        }
    };

    const cursosActivos = cursos.filter((c) => c.estado === "activo");
    const listo = cursosActivos.length > 0;

    const continuar = () => router.push("/camino/colegio/estudiantes");

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-serif text-2xl text-body">Sus cursos ya están listos. Quite los que no tenga.</h1>
                <p className="mt-2 text-sm text-muted">
                    Le dejamos los 11 grados del año lectivo vigente. Ajuste sin digitar nada. Para dividir un
                    curso en A/B o asignar materias con profesor, entre a la ficha del curso.
                </p>
            </div>

            <GlassCard>
                {cargando ? (
                    <p className="text-sm text-muted">Cargando cursos…</p>
                ) : cursos.length === 0 ? (
                    <p className="text-sm text-muted">No hay cursos configurados aún.</p>
                ) : (
                    <ul className="divide-y divide-tinta/10">
                        {cursos.map((c) => (
                            <li key={c.id} className="flex items-center justify-between py-2">
                                <div>
                                    <p className="text-sm font-medium text-body">{c.nombre}</p>
                                    {c.anioLectivo && (
                                        <p className="text-xs text-muted">Año lectivo {c.anioLectivo}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Link
                                        href={`/dashboard/colegio/cursos/${c.id}`}
                                        className="text-xs font-medium text-accent hover:underline"
                                    >
                                        Materias
                                    </Link>
                                    {c.estado === "activo" ? (
                                        <button
                                            type="button"
                                            onClick={() => inactivar(c.id)}
                                            disabled={cambiando === c.id}
                                            className="rounded-md border border-tinta/20 px-2 py-1 text-xs text-muted hover:border-ambar hover:text-ambar"
                                        >
                                            Quitar
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => reactivar(c.id)}
                                            disabled={cambiando === c.id}
                                            className="rounded-md border border-pino px-2 py-1 text-xs text-pino"
                                        >
                                            Reactivar
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </GlassCard>

            {error && <Alerta tono="advertencia">{error}</Alerta>}

            <p className="text-sm text-muted">
                {cursosActivos.length} curso{cursosActivos.length === 1 ? "" : "s"} activo{cursosActivos.length === 1 ? "" : "s"}
            </p>
            <Button onClick={continuar} disabled={!listo} className="w-full">
                Continuar
            </Button>
        </div>
    );
}
