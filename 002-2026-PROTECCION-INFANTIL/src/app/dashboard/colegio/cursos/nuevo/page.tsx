"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { ColegioNav } from "@/components/modules/colegio/ColegioNav";

export default function NuevoCursoPage() {
    const router = useRouter();
    const [nombre, setNombre] = useState("");
    const [grado, setGrado] = useState("");
    const [anioLectivo, setAnioLectivo] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/colegio/cursos", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: nombre.trim(),
                    grado: grado.trim() || undefined,
                    anioLectivo: anioLectivo.trim() || undefined,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                router.push("/dashboard/colegio/cursos");
            } else {
                setError(data?.error?.message || "Error creando curso");
            }
        } catch {
            setError("Error de red creando curso");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-page">
            <ColegioNav />
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-2xl">
                    <Button variant="outline" onClick={() => router.push("/dashboard/colegio/cursos")} className="mb-4">
                        ← Volver a cursos
                    </Button>
                    <GlassCard>
                        <h1 className="text-2xl font-bold text-body">Nuevo curso</h1>
                        <p className="text-sm text-muted">Crea un curso para tu colegio.</p>

                        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                            <Input
                                label="Nombre"
                                required
                                minLength={2}
                                maxLength={150}
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                placeholder="Ej. 6A"
                            />
                            <Input
                                label="Grado"
                                maxLength={100}
                                value={grado}
                                onChange={(e) => setGrado(e.target.value)}
                                placeholder="Ej. Sexto"
                            />
                            <Input
                                label="Año lectivo"
                                maxLength={20}
                                value={anioLectivo}
                                onChange={(e) => setAnioLectivo(e.target.value)}
                                placeholder="Ej. 2026"
                            />

                            {error && (
                                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
                                    {error}
                                </div>
                            )}

                            <div className="flex items-center gap-3 pt-2">
                                <Button type="submit" isLoading={loading}>
                                    Crear curso
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => router.push("/dashboard/colegio/cursos")}
                                >
                                    Cancelar
                                </Button>
                            </div>
                        </form>
                    </GlassCard>
                </div>
            </main>
        </div>
    );
}
