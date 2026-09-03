"use client";

/**
 * SPEC-379 (PR B · D5a) — panel de carga masiva de CURSOS por Excel/CSV.
 *
 * Sigue el mismo shape que `CargaProfesoresExcel` (extraído en PR A):
 * validar → resumen + token → confirmar. La duplicación de código con el
 * panel de profesores es intencional: los endpoints y la copia son distintos
 * y meter parámetros al panel de profesores complicaba PR A. Si se abre un
 * tercer panel, extraer un genérico paga.
 */
import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";

interface CargaCursosExcelProps {
    onCompletado?: () => void | Promise<void>;
    titulo?: string;
    subtitulo?: string;
}

export function CargaCursosExcel({
    onCompletado,
    titulo = "Cargar cursos desde Excel/CSV",
    subtitulo,
}: CargaCursosExcelProps) {
    const [archivo, setArchivo] = useState<File | null>(null);
    const [subiendo, setSubiendo] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resumen, setResumen] = useState<{ crear: number; omitidos: number; errores: number } | null>(null);
    const [tokenConfirmar, setTokenConfirmar] = useState<string | null>(null);
    const [detalles, setDetalles] = useState<Array<Record<string, unknown>>>([]);

    const subirYValidar = async () => {
        if (!archivo) return;
        setError(null);
        setSubiendo(true);
        try {
            const fd = new FormData();
            fd.append("archivo", archivo);
            const res = await fetch("/api/colegio/carga-cursos/validar", {
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
            const res = await fetch("/api/colegio/carga-cursos/confirmar", {
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
            if (onCompletado) await onCompletado();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error confirmando la carga.");
        } finally {
            setSubiendo(false);
        }
    };

    return (
        <GlassCard>
            <h2 className="font-semibold text-body">{titulo}</h2>
            <p className="mt-1 text-sm text-muted">
                {subtitulo ? `${subtitulo} · ` : ""}
                <a
                    href="/api/colegio/carga-cursos/plantilla"
                    className="text-accent underline"
                    target="_blank"
                    rel="noreferrer"
                >
                    Descargar plantilla
                </a>
                {" · "}Formato admitido: CSV o XLSX. Columnas: <code>nombre</code> (obligatoria) ·{" "}
                <code>grado</code> (1–11) · <code>anio_lectivo</code> · <code>profesor_titular_documento</code>.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                    className="text-sm"
                    aria-label="Archivo de cursos"
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
            {error && (
                <p className="mt-3 text-sm text-amber-700 dark:text-amber-400" role="alert">
                    {error}
                </p>
            )}
        </GlassCard>
    );
}
