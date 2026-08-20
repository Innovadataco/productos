"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ErrorState } from "@/components/ui/ErrorState";
import { Cargando } from "@/components/ui/Cargando";
import { TarjetaMetrica } from "@/components/ui/TarjetaMetrica";

type Escenario = "robot_inundando" | "ataque_coordinado" | "bot_ips_rotativas" | "denunciante_spam" | "personalizado";

type Run = {
    id: string;
    escenario: Escenario;
    n: number;
    ipInyectada: string;
    identificador: string;
    plataforma: string;
    estado: "PENDIENTE" | "EN_PROGRESO" | "COMPLETADA" | "FALLIDA" | "CANCELADA";
    totalEsperado: number;
    totalEnviados: number;
    totalBloqueados: number;
    totalSpam: number;
    latenciaPromedioMs: number | null;
    fechaInicio: string | null;
    fechaFin: string | null;
    creadoEn: string;
};

const ESCENARIO_OPCIONES = [
    { value: "robot_inundando", label: "1. Robot inundando (50 reportes / 1 IP)" },
    { value: "ataque_coordinado", label: "2. Ataque coordinado (30 reportes / IPs distintas / mismo identificador)" },
    { value: "bot_ips_rotativas", label: "3. Bot con IPs rotativas" },
    { value: "denunciante_spam", label: "4. Denunciante spam (mismo usuario / víctimas distintas)" },
    { value: "personalizado", label: "5. Personalizado" },
];

const ESTADO_LABELS: Record<string, string> = {
    PENDIENTE: "Pendiente",
    EN_PROGRESO: "En progreso",
    COMPLETADA: "Completada",
    FALLIDA: "Fallida",
    CANCELADA: "Cancelada",
};

export function AdminAntiAbusoSimulador() {
    const [escenario, setEscenario] = useState<Escenario>("robot_inundando");
    const [n, setN] = useState(50);
    const [ip, setIp] = useState("192.0.2.10");
    const [identificador, setIdentificador] = useState("");
    const [plataforma, setPlataforma] = useState("whatsapp");
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [runId, setRunId] = useState<string | null>(null);
    const [run, setRun] = useState<Run | null>(null);

    const cargarRun = useCallback(async (id: string) => {
        try {
            const res = await fetch(`/api/admin/anti-abuso/simular/${id}`, { credentials: "include" });
            if (!res.ok) return;
            const json = await res.json();
            setRun(json.run as Run);
        } catch {
            // ignorar errores de polling
        }
    }, []);

    useEffect(() => {
        if (!runId) {
            setRun(null);
            return;
        }
        void cargarRun(runId);
        const interval = setInterval(() => {
            void cargarRun(runId);
        }, 2000);
        return () => clearInterval(interval);
    }, [runId, cargarRun]);

    const iniciar = useCallback(async () => {
        setEnviando(true);
        setError(null);
        setRunId(null);
        try {
            const res = await fetch("/api/admin/anti-abuso/simular", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    escenario,
                    n,
                    ip,
                    identificador: identificador || undefined,
                    plataforma,
                }),
            });
            const json = await res.json().catch(() => ({ error: { message: "Error de red" } }));
            if (!res.ok) {
                setError(json.error?.message ?? "No se pudo iniciar");
                return;
            }
            setRunId(json.runId);
        } catch {
            setError("Error de red");
        } finally {
            setEnviando(false);
        }
    }, [escenario, n, ip, identificador, plataforma]);

    const cancelar = useCallback(async () => {
        if (!runId) return;
        try {
            await fetch(`/api/admin/anti-abuso/simular/${runId}/cancelar`, {
                method: "POST",
                credentials: "include",
            });
            void cargarRun(runId);
        } catch {
            // ignore
        }
    }, [runId, cargarRun]);

    const finalizada = run && ["COMPLETADA", "FALLIDA", "CANCELADA"].includes(run.estado);

    return (
        <section className="space-y-6" aria-labelledby="anti-abuso-simulador-title">
            <div>
                <h2 id="anti-abuso-simulador-title" className="text-xl font-bold text-body">Simulador de abusos</h2>
                <p className="mt-1 text-sm text-muted">
                    Genera reportes reales contra el pipeline anti-abuso. La IP inyectable debe estar en rangos RFC 5737.
                </p>
            </div>

            <div className="glass rounded-2xl p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Select
                        label="Escenario"
                        options={ESCENARIO_OPCIONES}
                        value={escenario}
                        onChange={(e) => setEscenario(e.target.value as Escenario)}
                    />
                    <Input
                        label="Cantidad (N)"
                        type="number"
                        min={1}
                        max={200}
                        value={n}
                        onChange={(e) => setN(Number(e.target.value))}
                    />
                    <Input
                        label="IP inyectable (RFC 5737)"
                        value={ip}
                        onChange={(e) => setIp(e.target.value)}
                        placeholder="192.0.2.x"
                    />
                    <Input
                        label="Identificador objetivo"
                        value={identificador}
                        onChange={(e) => setIdentificador(e.target.value)}
                        placeholder="Teléfono, nick o perfil"
                    />
                    <Input
                        label="Plataforma"
                        value={plataforma}
                        onChange={(e) => setPlataforma(e.target.value)}
                    />
                </div>
                {error && <p className="mt-3 text-sm text-rubi">{error}</p>}
                <div className="mt-4 flex gap-2">
                    <Button onClick={iniciar} disabled={enviando || !!runId}>
                        {enviando ? "Iniciando..." : "Iniciar simulación"}
                    </Button>
                    {runId && !finalizada && (
                        <Button onClick={cancelar} variant="danger" disabled={!runId}>
                            Cancelar simulación
                        </Button>
                    )}
                </div>
            </div>

            {runId && !run && (
                <div className="glass rounded-2xl p-6">
                    <Cargando texto="Cargando estado de la simulación..." />
                </div>
            )}

            {run && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-body">
                            Simulación {run.id.slice(0, 8)} · {ESTADO_LABELS[run.estado] ?? run.estado}
                        </h3>
                        <span className="text-sm text-muted">
                            {run.fechaInicio ? new Date(run.fechaInicio).toLocaleString("es-CO") : "—"}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        <TarjetaMetrica disposicion="panel" label="Esperados" value={run.totalEsperado} />
                        <TarjetaMetrica disposicion="panel" label="Enviados (201)" value={run.totalEnviados} tone="up" />
                        <TarjetaMetrica disposicion="panel" label="Bloqueados (429)" value={run.totalBloqueados} tone="down" />
                        <TarjetaMetrica disposicion="panel" label="Spam" value={run.totalSpam} />
                        <TarjetaMetrica disposicion="panel" label="Latencia promedio" value={`${run.latenciaPromedioMs ?? 0} ms`} />
                    </div>
                    {!finalizada && (
                        <p className="text-sm text-muted">
                            Los reportes entran al pipeline real (rate-limit, PII, motor). En la Mac del CEO cada reporte puede tardar ~1.5 min en Ollama.
                        </p>
                    )}
                </div>
            )}
        </section>
    );
}
