"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { FilaListaValidada } from "@/lib/colegio/unificado/validar-lista";

/**
 * SPEC-146 (T005) — Import Excel dentro de la sección 2 del wizard (mockup
 * §5.4): dropzone → POST /api/colegio/cursos/unificado/validar (dry-run, nada
 * se guarda) → vista previa ANTES DE GUARDAR con "N estudiantes listos" y "M
 * filas con problemas" (motivo por fila). El archivo NUNCA se rechaza entero:
 * "Guardar solo los N correctos" vuelca las filas válidas a la tabla editable.
 */

interface Problema {
    fila: number;
    campos: string[];
    mensaje: string;
}

interface ResultadoDryRun {
    filasValidas: FilaListaValidada[];
    problemas: Problema[];
    resumen: { estudiantes: number; identificadores: number; conProblemas: number; total: number };
}

interface ImportExcelProps {
    onAceptar: (filas: FilaListaValidada[]) => void;
}

export function ImportExcel({ onAceptar }: ImportExcelProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [cargando, setCargando] = useState(false);
    const [resultado, setResultado] = useState<ResultadoDryRun | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [arrastrando, setArrastrando] = useState(false);

    async function validar(archivo: File) {
        setCargando(true);
        setError(null);
        setResultado(null);
        try {
            const formData = new FormData();
            formData.append("archivo", archivo);
            const res = await fetch("/api/colegio/cursos/unificado/validar", {
                method: "POST",
                credentials: "include",
                body: formData,
            });
            const data: unknown = await res.json().catch(() => null);
            if (!res.ok) {
                const mensaje =
                    data && typeof data === "object" && "error" in data
                        ? (data as { error?: { message?: string } }).error?.message
                        : undefined;
                setError(mensaje ?? "No pudimos leer el archivo. Revise que sea la plantilla y vuelva a intentar.");
                return;
            }
            setResultado(data as ResultadoDryRun);
        } catch {
            setError("Error de red al validar el archivo. Inténtalo de nuevo.");
        } finally {
            setCargando(false);
        }
    }

    function reiniciar() {
        setResultado(null);
        setError(null);
        if (inputRef.current) inputRef.current.value = "";
    }

    if (resultado) {
        const listos = resultado.resumen.estudiantes;
        const conProblemas = resultado.problemas.length;
        return (
            <div className="space-y-4" aria-live="polite">
                <p className="text-sm font-semibold text-body">
                    Vista previa ({resultado.resumen.total} filas) — ANTES DE GUARDAR:
                </p>
                {listos > 0 ? (
                    <p className="text-sm font-semibold text-estado-pino">✓ {listos} estudiantes listos para crear</p>
                ) : null}
                {conProblemas > 0 ? (
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-estado-ambar">⚠ {conProblemas} filas con problemas:</p>
                        <ul className="list-inside space-y-1 text-sm text-muted">
                            {resultado.problemas.map((p) => (
                                <li key={p.fila}>
                                    • Fila {p.fila} — {p.mensaje}
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}
                <div className="flex flex-wrap gap-3">
                    <Button type="button" variant="outline" className="min-h-12" onClick={reiniciar}>
                        Corregir en Excel y reintentar
                    </Button>
                    {listos > 0 ? (
                        <Button type="button" className="min-h-12" onClick={() => onAceptar(resultado.filasValidas)}>
                            Guardar solo los {listos} correctos
                        </Button>
                    ) : null}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div
                role="button"
                tabIndex={0}
                aria-label="Arrastre su Excel o haga clic aquí"
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        inputRef.current?.click();
                    }
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    setArrastrando(true);
                }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setArrastrando(false);
                    const archivo = e.dataTransfer.files[0];
                    if (archivo) void validar(archivo);
                }}
                className={`ring-accent glass-input flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-tinta/15 p-6 text-center motion-safe:transition-colors ${
                    arrastrando ? "bg-tinta/10" : ""
                }`}
            >
                <span aria-hidden="true" className="text-2xl">📤</span>
                <span className="text-sm font-semibold text-body">
                    {cargando ? "Revisando su lista…" : "Arrastre su Excel o haga clic aquí"}
                </span>
                <span className="text-xs text-subtle">CSV o XLSX, hasta 500 filas</span>
            </div>
            <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                onChange={(e) => {
                    const archivo = e.target.files?.[0];
                    if (archivo) void validar(archivo);
                }}
            />

            {error ? (
                <p role="alert" className="rounded-xl bg-tinta/5 p-3 text-sm font-semibold text-estado-ambar">
                    {error}
                </p>
            ) : null}

            <div className="text-center">
                <p className="text-sm text-muted">📥 ¿No tiene plantilla?</p>
                <a
                    href="/api/colegio/cursos/unificado/plantilla"
                    download
                    className="ring-accent mt-1 inline-flex min-h-12 items-center rounded-xl px-4 text-sm font-semibold text-accent hover:underline"
                >
                    Descargar plantilla Excel
                </a>
            </div>
        </div>
    );
}
