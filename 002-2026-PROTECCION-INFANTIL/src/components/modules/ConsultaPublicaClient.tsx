"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatPlataformasResumen } from "@/lib/plataforma";
import type { NivelRiesgoConsulta } from "@/lib/riesgo-consulta";

import { useAuth } from "@/lib/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/ui/ErrorState";

function formatFecha(iso: string | null | undefined) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-CO", { dateStyle: "medium" });
}

function badgeRiesgo(nivel: NivelRiesgoConsulta) {
    switch (nivel) {
        case "ALTO":
            return { variant: "danger" as const, label: "Riesgo alto" };
        case "MEDIO":
            return { variant: "warning" as const, label: "Riesgo medio" };
        case "BAJO":
        default:
            return { variant: "success" as const, label: "Riesgo bajo" };
    }
}

type ConsultaResponse = {
    identificador: string;
    tieneReportes: boolean;
    mensaje?: string;
    nivelRiesgo?: NivelRiesgoConsulta;
    totalReportes?: number;
    reportesAutenticados?: number;
    reportesAnonimos?: number;
    ultimoReporte?: string | null;
    plataformas?: { id: string; nombre: string; clave: string; total: number; otraPlataforma?: string | null }[];
    resumenPlataformas?: string;
};

export function ConsultaPublicaClient() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [identificador, setIdentificador] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [data, setData] = useState<ConsultaResponse | null>(null);

    const isAutenticado = !authLoading && !!user && user.rol === "PARENT";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!identificador.trim() || identificador.length < 3) {
            setError("Ingresa un identificador válido (mínimo 3 caracteres).");
            return;
        }
        setLoading(true);
        setError("");
        setData(null);
        try {
            const res = await fetch(`/api/consulta?identificador=${encodeURIComponent(identificador)}`, {
                credentials: "include",
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                setError(json?.error?.message || "Error consultando el identificador.");
                return;
            }
            setData(json);
        } catch {
            setError("Error de conexión. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-body">Consulta pública</h1>
                <p className="mt-2 text-muted">
                    Ingresa un número, nick o usuario para conocer el riesgo agregado reportado.
                </p>
                <p className="text-xs text-subtle">
                    No se muestra el contenido de los reportes ni datos de las personas.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="mx-auto max-w-xl">
                <div className="glass rounded-2xl p-4 sm:p-5">
                    <Input
                        label="Número, nick o usuario"
                        placeholder="Ej: 3002222222 o @usuario"
                        value={identificador}
                        onChange={(e) => setIdentificador(e.target.value)}
                    />
                    <div className="mt-4">
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Consultando..." : "Consultar"}
                        </Button>
                    </div>
                </div>
            </form>

            {error && (
                <div className="mx-auto mt-6 max-w-xl">
                    <ErrorState
                        title="No pudimos completar la consulta"
                        description={error}
                        onRetry={() => {
                            setError("");
                            if (identificador.trim()) handleSubmit({ preventDefault: () => undefined } as React.FormEvent);
                        }}
                    />
                </div>
            )}

            {data && !data.tieneReportes && (
                <div className="mx-auto mt-6 max-w-xl rounded-xl glass p-6 text-center">
                    <p className="text-body">{data.mensaje || "Sin reportes registrados para este identificador."}</p>
                </div>
            )}

            {data?.tieneReportes && (
                <div className="mt-8 space-y-5 animate-floatUp">
                    <GlassCard className="text-center">
                        <p className="text-sm text-subtle">{data.identificador}</p>
                        <div className="mt-3 flex justify-center">
                            <Badge variant={badgeRiesgo(data.nivelRiesgo ?? "BAJO").variant} className="text-sm px-3 py-1">
                                {badgeRiesgo(data.nivelRiesgo ?? "BAJO").label}
                            </Badge>
                        </div>
                        <p className="mt-4 text-base font-medium text-body">
                            {data.resumenPlataformas || formatPlataformasResumen(data.plataformas ?? [], data.totalReportes)}
                        </p>
                    </GlassCard>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <MetricCard label="Total reportes" value={data.totalReportes ?? 0} />
                        <MetricCard label="Último reporte" value={formatFecha(data.ultimoReporte)} />
                    </div>

                    <div className="glass rounded-2xl p-6 text-center">
                        {isAutenticado ? (
                            <>
                                <p className="text-body font-medium">¿Deseas ver el detalle completo?</p>
                                <p className="mt-1 text-sm text-muted">
                                    Accede a tu panel para ver el historial detallado, mapa aproximado y seguimiento de tus reportes.
                                </p>
                                <div className="mt-4">
                                    <Button
                                        variant="primary"
                                        className="w-full sm:w-auto"
                                        onClick={() => router.push("/dashboard")}
                                    >
                                        Ver detalle completo
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-body font-medium">¿Deseas ver el detalle completo?</p>
                                <p className="mt-1 text-sm text-muted">
                                    Crea una cuenta para acceder al historial detallado, mapa aproximado y seguimiento de tus reportes.
                                </p>
                                <div className="mt-4">
                                    <Link href="/registro">
                                        <Button variant="primary" className="w-full sm:w-auto">
                                            Crear una cuenta
                                        </Button>
                                    </Link>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="glass rounded-2xl p-5 text-center">
            <p className="text-2xl font-bold text-body font-mono">{value}</p>
            <p className="mt-1 text-xs text-subtle">{label}</p>
        </div>
    );
}
