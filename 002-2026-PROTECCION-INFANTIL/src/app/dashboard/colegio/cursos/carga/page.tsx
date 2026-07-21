"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { ColegioNav } from "@/components/modules/colegio/ColegioNav";

type ErrorFila = { fila: number; campos: string[]; mensaje: string };

type ResumenValidacion = { cursos: number; alumnos: number; identificadores: number };

type ResultadoValidar = {
    valido: boolean;
    totalFilas: number;
    filasValidas: number;
    errores: ErrorFila[];
    tokenConfirmacion: string | null;
    resumen: ResumenValidacion | null;
};

type Mensaje = { type: "success" | "error"; text: string } | null;

export default function CargaMasivaPage() {
    const [file, setFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [validando, setValidando] = useState(false);
    const [confirmando, setConfirmando] = useState(false);
    const [resultado, setResultado] = useState<ResultadoValidar | null>(null);
    const [mensaje, setMensaje] = useState<Mensaje>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const descargarPlantilla = async () => {
        try {
            const res = await fetch("/api/colegio/carga/plantilla", { credentials: "include" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setMensaje({ type: "error", text: data?.error?.message || "Error descargando plantilla" });
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "plantilla-carga-alumnos.csv";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            setMensaje({ type: "error", text: "Error de red descargando plantilla" });
        }
    };

    const handleFile = (selected: File | null) => {
        setFile(selected);
        setResultado(null);
        setMensaje(null);
    };

    const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        const dropped = e.dataTransfer.files?.[0] ?? null;
        if (dropped) handleFile(dropped);
    }, []);

    const validar = async () => {
        if (!file) {
            setMensaje({ type: "error", text: "Selecciona un archivo primero" });
            return;
        }
        setValidando(true);
        setMensaje(null);
        try {
            const formData = new FormData();
            formData.append("archivo", file);
            const res = await fetch("/api/colegio/carga/validar", {
                method: "POST",
                credentials: "include",
                body: formData,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setMensaje({ type: "error", text: data?.error?.message || "Error validando archivo" });
                setResultado(null);
            } else {
                setResultado(data as ResultadoValidar);
                if (!data.valido) {
                    setMensaje({ type: "error", text: "El archivo tiene errores. Corrígelos y vuelve a validar." });
                } else {
                    setMensaje({ type: "success", text: "Archivo válido. Puedes confirmar la carga." });
                }
            }
        } catch {
            setMensaje({ type: "error", text: "Error de red validando archivo" });
            setResultado(null);
        } finally {
            setValidando(false);
        }
    };

    const confirmar = async () => {
        if (!resultado?.tokenConfirmacion) return;
        setConfirmando(true);
        setMensaje(null);
        try {
            const res = await fetch("/api/colegio/carga/confirmar", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tokenConfirmacion: resultado.tokenConfirmacion }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setMensaje({ type: "error", text: data?.error?.message || "Error confirmando carga" });
            } else {
                setMensaje({ type: "success", text: `Carga completada: ${data.mensaje}` });
                setResultado(null);
                setFile(null);
            }
        } catch {
            setMensaje({ type: "error", text: "Error de red confirmando carga" });
        } finally {
            setConfirmando(false);
        }
    };

    return (
        <div className="min-h-screen bg-page">
            <ColegioNav />
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-4xl space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-body">Carga masiva de alumnos</h1>
                            <p className="text-sm text-muted">Sube un CSV o Excel con cursos, alumnos e identificadores.</p>
                        </div>
                        <Button variant="secondary" onClick={descargarPlantilla}>
                            Descargar plantilla
                        </Button>
                    </div>

                    {mensaje && (
                        <div
                            className={`rounded-xl p-4 text-sm ${
                                mensaje.type === "error"
                                    ? "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200"
                                    : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
                            }`}
                        >
                            {mensaje.text}
                        </div>
                    )}

                    <GlassCard>
                        <div className="space-y-4">
                            <div
                                role="button"
                                tabIndex={0}
                                className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
                                    dragOver
                                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                                        : "border-emerald-200/50 bg-emerald-50/20 dark:border-emerald-900/30 dark:bg-emerald-950/10"
                                }`}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragOver(true);
                                }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={onDrop}
                                onClick={() => inputRef.current?.click()}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
                                }}
                            >
                                <input
                                    ref={inputRef}
                                    type="file"
                                    accept=".csv,.xlsx,.xls"
                                    className="hidden"
                                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                                />
                                <div className="text-2xl">📄</div>
                                <p className="mt-2 text-sm font-medium text-body">
                                    {file ? file.name : "Arrastra un archivo o haz clic para seleccionar"}
                                </p>
                                <p className="text-xs text-muted">CSV o Excel (.xlsx)</p>
                            </div>

                            <div className="flex gap-3">
                                <Button onClick={validar} isLoading={validando} disabled={!file || validando}>
                                    Validar archivo
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={confirmar}
                                    isLoading={confirmando}
                                    disabled={!resultado?.tokenConfirmacion || confirmando}
                                >
                                    Confirmar carga
                                </Button>
                            </div>
                        </div>
                    </GlassCard>

                    {resultado && (
                        <GlassCard>
                            <h2 className="text-lg font-semibold text-body">Resumen de validación</h2>
                            <div className="mt-4 grid gap-4 sm:grid-cols-3">
                                <div className="rounded-xl glass-input p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Total filas</p>
                                    <p className="text-2xl font-bold text-body">{resultado.totalFilas}</p>
                                </div>
                                <div className="rounded-xl glass-input p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Filas válidas</p>
                                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                                        {resultado.filasValidas}
                                    </p>
                                </div>
                                <div className="rounded-xl glass-input p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Errores</p>
                                    <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                                        {resultado.errores.length}
                                    </p>
                                </div>
                            </div>

                            {resultado.resumen && (
                                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                                    <div className="rounded-xl glass-input p-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Cursos</p>
                                        <p className="text-lg font-semibold text-body">{resultado.resumen.cursos}</p>
                                    </div>
                                    <div className="rounded-xl glass-input p-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Alumnos</p>
                                        <p className="text-lg font-semibold text-body">{resultado.resumen.alumnos}</p>
                                    </div>
                                    <div className="rounded-xl glass-input p-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Identificadores</p>
                                        <p className="text-lg font-semibold text-body">{resultado.resumen.identificadores}</p>
                                    </div>
                                </div>
                            )}

                            {resultado.errores.length > 0 && (
                                <div className="mt-6">
                                    <h3 className="text-sm font-semibold text-body">Errores por fila</h3>
                                    <div className="mt-2 max-h-80 overflow-auto rounded-xl border border-red-200/50 dark:border-red-900/30">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-red-50/50 dark:bg-red-950/20 text-subtle">
                                                <tr>
                                                    <th className="px-4 py-2 font-medium">Fila</th>
                                                    <th className="px-4 py-2 font-medium">Campos</th>
                                                    <th className="px-4 py-2 font-medium">Mensaje</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-red-100 dark:divide-red-900/20">
                                                {resultado.errores.map((error, idx) => (
                                                    <tr key={idx}>
                                                        <td className="px-4 py-2 text-body">{error.fila}</td>
                                                        <td className="px-4 py-2 text-body">{error.campos.join(", ")}</td>
                                                        <td className="px-4 py-2 text-red-700 dark:text-red-300">{error.mensaje}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </GlassCard>
                    )}
                </div>
            </main>
        </div>
    );
}
