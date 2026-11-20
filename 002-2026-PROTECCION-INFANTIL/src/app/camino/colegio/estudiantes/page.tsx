"use client";

/**
 * SPEC-344 (A-69 · C1) — Paso 5 · Estudiantes del colegio.
 *
 * SPEC-956 (Jelkin vivo, prod e3d0f98f) — ESPEJO de Profesores (SPEC-442): el paso
 * estaba ROTO. Sus dos botones eran `<Link>` que SACABAN al panel
 * (`/dashboard/colegio/cursos/unificado` y `/dashboard/colegio/cursos`), así que el
 * rector salía del camino y NO podía terminarlo. Ahora el alta vive DENTRO del paso:
 *   · «Lista actual» = `GET /api/colegio/estudiantes` (SPEC-931, solo activos).
 *   · «Agregar un estudiante» = selector de curso OBLIGATORIO (cursos del paso 4) +
 *     reusar `FormAgregarEstudiante` (POST /api/colegio/cursos/{cursoId}/alumnos).
 *   · Pie: «Terminar» (≥1 estudiante activo) → /camino/colegio/listo · «Atrás» →
 *     /camino/colegio/cursos.
 *
 * La carga por Excel inline NO entra acá (no existe componente/endpoint de bulk
 * solo-estudiantes; el bulk de hoy es el wizard unificado entero): va en SPEC-959.
 * Por eso el subtítulo NO promete Excel — la pantalla no lo hace.
 *
 * Volver client component (como Profesores) es correcto: la lista sale de un endpoint
 * que SÍ existe (931), no del `/api/colegio/alumnos` inexistente que rompió SPEC-355.
 * El guardián del paso lo aplica el middleware (`estado.pasoCamino`), igual que Profesores.
 *
 * Voz: usted formal Colombia.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Alerta } from "@/components/ui/Alerta";
import { FormAgregarEstudiante } from "@/components/modules/colegio/curso/FormAgregarEstudiante";

interface EstudianteItem {
    id: string;
    nombre: string;
    curso: { id: string; nombre: string };
}

interface CursoItem {
    id: string;
    nombre: string;
}

export default function PasoEstudiantesColegio() {
    const router = useRouter();
    const [estudiantes, setEstudiantes] = useState<EstudianteItem[]>([]);
    const [total, setTotal] = useState(0);
    const [cursos, setCursos] = useState<CursoItem[]>([]);
    const [cursoId, setCursoId] = useState("");
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalAbierto, setModalAbierto] = useState(false);

    const cargarEstudiantes = useCallback(async () => {
        setCargando(true);
        try {
            const res = await fetch("/api/colegio/estudiantes?pageSize=100", { credentials: "include" });
            if (!res.ok) throw new Error("No pudimos cargar la lista de estudiantes.");
            const json = await res.json();
            setEstudiantes(Array.isArray(json.items) ? json.items : []);
            setTotal(typeof json.pagination?.total === "number" ? json.pagination.total : (json.items?.length ?? 0));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error cargando estudiantes.");
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        void cargarEstudiantes();
        fetch("/api/colegio/cursos", { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then((json) => {
                const filas: unknown = json?.cursos ?? [];
                if (Array.isArray(filas)) {
                    setCursos(
                        filas
                            .filter((c): c is CursoItem => typeof c === "object" && c !== null && "id" in c && "nombre" in c)
                            .map((c) => ({ id: String(c.id), nombre: String(c.nombre) })),
                    );
                }
            })
            .catch(() => null);
    }, [cargarEstudiantes]);

    const listo = total > 0;
    const terminar = () => router.push("/camino/colegio/listo");
    const atras = () => router.push("/camino/colegio/cursos");

    const cursoOptions = [
        { value: "", label: "Elija…" },
        ...cursos.map((c) => ({ value: c.id, label: c.nombre })),
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-serif text-2xl text-body">A quién estamos cuidando.</h1>
                <p className="mt-2 text-sm text-muted">
                    Agregue al menos un estudiante para terminar. Puede sumarlos uno a la vez.
                </p>
            </div>

            <GlassCard>
                <h2 className="font-semibold text-body">Lista actual</h2>
                {cargando ? (
                    <p className="mt-2 text-sm text-muted">Cargando…</p>
                ) : estudiantes.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">Aún no ha agregado estudiantes.</p>
                ) : (
                    <ul className="mt-3 divide-y divide-tinta/10">
                        {estudiantes.map((e) => (
                            <li key={e.id} className="py-2 text-sm text-body">
                                {e.nombre}
                                <span className="ml-2 text-xs text-muted">· {e.curso.nombre}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </GlassCard>

            {/* SPEC-956: agregar estudiante SIN salir del camino (espejo de Profesores). */}
            <GlassCard>
                <h2 className="font-semibold text-body">Agregar un estudiante</h2>
                <p className="mt-1 text-xs text-muted">
                    Puede agregar varios; al terminar el camino los edita desde el panel.
                </p>
                <div className="mt-3">
                    <Select
                        label="¿En qué curso?"
                        options={cursoOptions}
                        value={cursoId}
                        onChange={(e) => setCursoId(e.target.value)}
                    />
                </div>
                <p className="mt-3 text-xs text-muted">
                    El acudiente es opcional. Sus cuentas también se vigilan: los agresores muchas veces
                    llegan por ahí.
                </p>
                {cursos.length === 0 && !cargando ? (
                    <p className="mt-3 text-xs text-muted">Primero cree un curso en el paso anterior.</p>
                ) : null}
                <div className="mt-3 flex justify-end">
                    <Button onClick={() => setModalAbierto(true)} disabled={!cursoId}>
                        Agregar estudiante
                    </Button>
                </div>
            </GlassCard>

            {cursoId ? (
                <FormAgregarEstudiante
                    cursoId={cursoId}
                    isOpen={modalAbierto}
                    onClose={() => setModalAbierto(false)}
                    onCreado={() => {
                        void cargarEstudiantes();
                    }}
                />
            ) : null}

            {error ? <Alerta tono="advertencia">{error}</Alerta> : null}

            {!listo ? (
                <p className="w-full rounded-xl border border-tinta/15 px-4 py-2 text-center text-sm text-muted">
                    Agregue su primer estudiante para terminar.
                </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Button onClick={terminar} disabled={!listo} className="w-full sm:flex-1">
                    Terminar
                </Button>
                <button
                    type="button"
                    onClick={atras}
                    className="w-full rounded-xl border border-tinta/20 px-4 py-2 text-sm font-medium text-muted hover:border-pino hover:text-pino sm:w-auto"
                >
                    Atrás
                </button>
            </div>
        </div>
    );
}
