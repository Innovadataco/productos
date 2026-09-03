"use client";

/**
 * SPEC-344 (A-69 · C1) — Paso 3 · Profesores del colegio.
 *
 * Alta individual + carga por Excel. El paso cierra al tener ≥ 1 profesor
 * activo (el endpoint `POST /api/colegio/profesores` y el confirmar del
 * Excel sellan `sesion_estado` automáticamente).
 *
 * Voz: usted formal Colombia (brief §0).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";
import { CargaProfesoresExcel } from "@/components/modules/colegio/CargaProfesoresExcel";

interface ProfesorItem {
    id: string;
    nombre: string;
    apellidos: string;
    numeroDocumento: string;
    estado: string;
}

export default function PasoProfesoresColegio() {
    const router = useRouter();
    const [profesores, setProfesores] = useState<ProfesorItem[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargarProfesores = async () => {
        setCargando(true);
        try {
            const res = await fetch("/api/colegio/profesores?estado=activo", { credentials: "include" });
            if (!res.ok) throw new Error("No pudimos cargar la lista de profesores.");
            const json = await res.json();
            setProfesores(json.items ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error cargando profesores.");
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => { void cargarProfesores(); }, []);

    const continuar = () => router.push("/camino/colegio/cursos");
    const listo = profesores.some((p) => p.estado === "activo") || profesores.length > 0;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-serif text-2xl text-body">Primero, quiénes enseñan.</h1>
                <p className="mt-2 text-sm text-muted">
                    Sus cuentas también se vigilan: si alguien reporta el usuario de un profesor, usted se entera.
                </p>
            </div>

            <GlassCard>
                <h2 className="font-semibold text-body">Lista actual</h2>
                {cargando ? (
                    <p className="mt-2 text-sm text-muted">Cargando…</p>
                ) : profesores.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">Aún no ha agregado profesores.</p>
                ) : (
                    <ul className="mt-3 divide-y divide-tinta/10">
                        {profesores.map((p) => (
                            <li key={p.id} className="py-2 text-sm text-body">
                                {p.nombre} {p.apellidos}
                                <span className="ml-2 text-xs text-muted">· {p.numeroDocumento}</span>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                    <Link href="/dashboard/colegio/profesores?crear=1" className="rounded-md border border-pino px-3 py-1 text-sm font-medium text-pino">
                        Agregar profesor
                    </Link>
                </div>
            </GlassCard>

            <CargaProfesoresExcel
                titulo="O cargue una lista desde Excel/CSV"
                onCompletado={cargarProfesores}
            />

            {error && <Alerta tono="advertencia">{error}</Alerta>}

            <Button onClick={continuar} disabled={!listo} className="w-full">
                Continuar
            </Button>
        </div>
    );
}
