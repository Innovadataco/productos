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
    const [archivo, setArchivo] = useState<File | null>(null);
    const [subiendo, setSubiendo] = useState(false);
    const [resumen, setResumen] = useState<{ crear: number; omitidos: number; errores: number } | null>(null);
    const [tokenConfirmar, setTokenConfirmar] = useState<string | null>(null);
    const [detalles, setDetalles] = useState<Array<Record<string, unknown>>>([]);

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

    const subirYValidar = async () => {
        if (!archivo) return;
        setError(null);
        setSubiendo(true);
        try {
            const fd = new FormData();
            fd.append("archivo", archivo);
            const res = await fetch("/api/colegio/carga-profesores/validar", {
                method: "POST",
                credentials: "include",
                body: fd,
            });
            const json = await res.json();
            setResumen(json.resumen ?? null);
            setDetalles(json.filas ?? []);
            setTokenConfirmar(json.token ?? null);
            if (!res.ok) {
                setError("El archivo tiene problemas. Revise el detalle abajo.");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos validar el archivo.");
        } finally {
            setSubiendo(false);
        }
    };

    const confirmar = async () => {
        if (!tokenConfirmar) return;
        setSubiendo(true);
        try {
            const res = await fetch("/api/colegio/carga-profesores/confirmar", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: tokenConfirmar }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error?.message || "No pudimos confirmar la carga.");
            setResumen(null);
            setDetalles([]);
            setTokenConfirmar(null);
            setArchivo(null);
            await cargarProfesores();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error confirmando la carga.");
        } finally {
            setSubiendo(false);
        }
    };

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

            <GlassCard>
                <h2 className="font-semibold text-body">O cargue una lista desde Excel/CSV</h2>
                <p className="mt-1 text-sm text-muted">
                    <a href="/api/colegio/carga-profesores/plantilla" className="text-accent underline" target="_blank" rel="noreferrer">
                        Descargar plantilla
                    </a>
                    {" · "}
                    Formato admitido: CSV o XLSX.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                        type="file"
                        accept=".csv,.xlsx"
                        onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                        className="text-sm"
                    />
                    <Button
                        variant="secondary"
                        onClick={subirYValidar}
                        disabled={!archivo || subiendo}
                        isLoading={subiendo && !tokenConfirmar}
                    >
                        Validar
                    </Button>
                    {tokenConfirmar && (
                        <Button onClick={confirmar} disabled={subiendo} isLoading={subiendo}>
                            Confirmar carga
                        </Button>
                    )}
                </div>
                {resumen && (
                    <p className="mt-3 text-sm text-body">
                        {resumen.crear} listos · {resumen.omitidos} omitidos · {resumen.errores} con problemas
                    </p>
                )}
                {detalles.length > 0 && (
                    <details className="mt-2 text-sm text-muted">
                        <summary className="cursor-pointer">Ver detalle por fila</summary>
                        <ul className="mt-2 max-h-48 overflow-auto">
                            {detalles.map((d, i) => (
                                <li key={i} className="border-b border-tinta/5 py-1">
                                    Fila {String(d.linea ?? "?")}: {String(d.estado ?? "")}
                                    {d.razon ? ` — ${String(d.razon)}` : ""}
                                    {d.columna ? ` (${String(d.columna)})` : ""}
                                </li>
                            ))}
                        </ul>
                    </details>
                )}
            </GlassCard>

            {error && <Alerta tono="advertencia">{error}</Alerta>}

            <Button onClick={continuar} disabled={!listo} className="w-full">
                Continuar
            </Button>
        </div>
    );
}
