"use client";

/**
 * SPEC-344 (A-69 · C1) — Paso 4 · Cursos y materias.
 * SPEC-442 (I-307 · Jelkin vivo 04-09 16:0x): la pantalla NO promete lo que no
 * verificó — cuenta los cursos del fetch y adapta título + copia. Si llegan 0,
 * ofrece «Crear un curso» in-place (no expulsa) y siempre hay botón «Atrás».
 *
 * Antes: h1 fijo «Sus cursos ya están listos» y párrafo hardcodeado «Le dejamos
 * los 11 grados» aunque `cursos.length === 0`. El rector del colegio «sagrado
 * corazon» quedó trabado sin salida.
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
    const [creando, setCreando] = useState(false);
    const [nuevoNombre, setNuevoNombre] = useState("");

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

    /**
     * SPEC-442: «siempre hay salida». Si el paso llegó con 0 cursos (por
     * historia del colegio o porque un camino de alta se salteó la siembra),
     * el rector crea uno acá mismo y continúa. NO se muda al panel.
     */
    const crearCurso = async () => {
        const nombre = nuevoNombre.trim();
        if (!nombre) return;
        setCreando(true);
        setError(null);
        try {
            const res = await fetch("/api/colegio/cursos", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre,
                    anioLectivo: String(new Date().getFullYear()),
                }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => null);
                throw new Error(json?.error?.message || "No pudimos crear el curso.");
            }
            setNuevoNombre("");
            await cargar();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error creando curso.");
        } finally {
            setCreando(false);
        }
    };

    const cursosActivos = cursos.filter((c) => c.estado === "activo");
    const listo = cursosActivos.length > 0;

    const continuar = () => router.push("/camino/colegio/estudiantes");
    const atras = () => router.push("/camino/colegio/profesores");

    // SPEC-442: título y copia dependen del conteo REAL, no de una promesa fija.
    const conteoActivos = cursosActivos.length;
    const tituloDinamico =
        cargando
            ? "Cargando sus cursos…"
            : conteoActivos === 0
                ? "No hay cursos configurados. Cree uno para continuar."
                : `Tiene ${conteoActivos} curso${conteoActivos === 1 ? "" : "s"} activo${conteoActivos === 1 ? "" : "s"}. Ajuste sin digitar nada.`;
    const copiaDinamica =
        conteoActivos === 0
            ? "Este paso exige al menos un curso. Puede crear uno acá mismo o volver al paso anterior."
            : "Para dividir un curso en A/B o asignar materias con profesor, entre a la ficha del curso.";

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-serif text-2xl text-body">{tituloDinamico}</h1>
                <p className="mt-2 text-sm text-muted">{copiaDinamica}</p>
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

            {/* SPEC-442: crear un curso in-place — «siempre hay salida». */}
            <GlassCard>
                <h2 className="text-sm font-semibold text-body">Crear un curso</h2>
                <p className="mt-1 text-xs text-muted">
                    Ejemplo: «Grado 6º» o «Transición A». Puede quitarlo después si no aplica.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                        type="text"
                        value={nuevoNombre}
                        onChange={(e) => setNuevoNombre(e.target.value)}
                        placeholder="Nombre del curso"
                        className="flex-1 rounded-xl border border-tinta/10 bg-white px-3 py-2 text-sm text-body focus:outline-none focus:ring-2 focus:ring-pino dark:bg-tinta/5"
                        maxLength={80}
                    />
                    <Button
                        onClick={crearCurso}
                        isLoading={creando}
                        disabled={!nuevoNombre.trim() || creando}
                    >
                        Crear
                    </Button>
                </div>
            </GlassCard>

            {error && <Alerta tono="advertencia">{error}</Alerta>}

            <p className="text-sm text-muted">
                {cursosActivos.length} curso{cursosActivos.length === 1 ? "" : "s"} activo{cursosActivos.length === 1 ? "" : "s"}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Button onClick={continuar} disabled={!listo} className="w-full sm:flex-1">
                    Continuar
                </Button>
                {/* SPEC-442: botón «Atrás» — nunca queda encerrado en el paso. */}
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
