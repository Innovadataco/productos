"use client";

/**
 * SPEC-344 (A-69 · C1) — Paso 5 · Estudiantes.
 *
 * El paso cierra cuando el colegio tiene ≥ 1 estudiante activo. Ofrece dos
 * caminos: agregar uno a la vez desde la ficha del curso, o cargar una lista
 * completa con el wizard unificado existente (`/dashboard/colegio/cursos/
 * unificado`). El wizard soporta el acudiente con documento opcional
 * aditivo (D-acud del brief); la UI vive en la ficha, aquí solo enlazamos.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";

export default function PasoEstudiantesColegio() {
    const router = useRouter();
    const [totalActivos, setTotalActivos] = useState<number | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargar = async () => {
        setCargando(true);
        try {
            // Endpoint listable existente `/api/colegio/alumnos` está paginado;
            // pedimos pageSize=1 solo para leer total.
            const res = await fetch("/api/colegio/alumnos?estado=activo&pageSize=1", { credentials: "include" });
            if (!res.ok) throw new Error("No pudimos consultar los estudiantes.");
            const json = await res.json();
            setTotalActivos(json.pagination?.total ?? (json.items?.length ?? 0));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error cargando estudiantes.");
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => { void cargar(); }, []);

    const listo = (totalActivos ?? 0) > 0;
    const continuar = () => router.push("/camino/colegio/listo");

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-serif text-2xl text-body">A quién estamos cuidando.</h1>
                <p className="mt-2 text-sm text-muted">
                    Agregue al menos un estudiante para terminar. Puede sumar uno a la vez o cargar
                    la lista completa desde Excel.
                </p>
            </div>

            <GlassCard>
                {cargando ? (
                    <p className="text-sm text-muted">Consultando…</p>
                ) : (
                    <p className="text-sm text-body">
                        Tiene <strong>{totalActivos}</strong> estudiante{totalActivos === 1 ? "" : "s"} activo{totalActivos === 1 ? "" : "s"}.
                    </p>
                )}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Link
                        href="/dashboard/colegio/cursos/unificado"
                        className="rounded-md bg-pino px-3 py-1.5 text-center text-sm font-medium text-white"
                    >
                        Cargar lista desde Excel
                    </Link>
                    <Link
                        href="/dashboard/colegio/cursos"
                        className="rounded-md border border-pino px-3 py-1.5 text-center text-sm font-medium text-pino"
                    >
                        Agregar uno a uno
                    </Link>
                </div>
                <p className="mt-3 text-xs text-muted">
                    El acudiente puede llevar tipo y número de documento (opcional). Sus cuentas también se vigilan:
                    los agresores muchas veces llegan por ahí.
                </p>
            </GlassCard>

            {error && <Alerta tono="advertencia">{error}</Alerta>}

            <Button onClick={continuar} disabled={!listo} className="w-full">
                Terminar
            </Button>
        </div>
    );
}
