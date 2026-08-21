"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Cargando } from "@/components/ui/Cargando";
import { TarjetaMetrica } from "@/components/ui/TarjetaMetrica";
import { AdminAntiAbusoSimuladorDetalleModal } from "./AdminAntiAbusoSimuladorDetalleModal";
import { AdminAntiAbusoSimuladorHistorial } from "./AdminAntiAbusoSimuladorHistorial";

type Escenario = "robot_inundando" | "ataque_coordinado" | "bot_ips_rotativas" | "denunciante_spam" | "personalizado";
type EstadoRun = "PENDIENTE" | "EN_PROGRESO" | "COMPLETADA" | "FALLIDA" | "CANCELADA";

type RunDetalle = {
    id: string;
    escenario: Escenario;
    estado: EstadoRun;
    n: number;
    totalEsperado: number;
    totalEnviados: number;
    totalBloqueados: number;
    totalSpam: number;
    latenciaPromedioMs: number;
    latenciaP50Ms: number;
    latenciaP95Ms: number;
    ipInyectada: string | null;
    identificador: string | null;
    plataforma: string | null;
    usuarioId: string | null;
    descripcionEscenario: string;
    creadoEn: string;
    actualizadoEn: string;
    detalles: Array<{
        idx: number;
        ip: string;
        identificador: string;
        status: number;
        latenciaMs: number;
        estado: string;
    }>;
};

type Sugerencias = {
    escenario: Escenario;
    n: number;
    ip?: string;
    ips?: string[];
    identificador?: string;
    identificadores?: string[];
    plataforma: string;
    usuarioId?: string;
    descripcion: string;
};

const ESCENARIO_OPCIONES = [
    { value: "robot_inundando", label: "1. Robot inundando" },
    { value: "ataque_coordinado", label: "2. Ataque coordinado" },
    { value: "bot_ips_rotativas", label: "3. Bot IPs rotativas" },
    { value: "denunciante_spam", label: "4. Denunciante spam" },
    { value: "personalizado", label: "5. Personalizado" },
];

const ESTADO_LABELS: Record<EstadoRun, string> = {
    PENDIENTE: "Pendiente",
    EN_PROGRESO: "En progreso",
    COMPLETADA: "Completada",
    FALLIDA: "Fallida",
    CANCELADA: "Cancelada",
};

function formatArrayField(value: string): string {
    return value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .join(", ");
}

function arraysFromInput(value: string): string[] {
    return value.split(",").map((v) => v.trim()).filter(Boolean);
}

export function AdminAntiAbusoSimulador() {
    const [subTab, setSubTab] = useState<"nueva" | "historial">("nueva");

    const [escenario, setEscenario] = useState<Escenario>("robot_inundando");
    const [n, setN] = useState(50);
    const [ip, setIp] = useState("");
    const [ips, setIps] = useState("");
    const [identificador, setIdentificador] = useState("");
    const [identificadores, setIdentificadores] = useState("");
    const [plataforma, setPlataforma] = useState("");
    const [usuarioId, setUsuarioId] = useState("");
    const [nota, setNota] = useState("");
    const [sugerencia, setSugerencia] = useState<Sugerencias | null>(null);
    const [cargandoSugerencia, setCargandoSugerencia] = useState(false);

    const [plataformaOptions, setPlataformaOptions] = useState<{ value: string; label: string }[]>([]);

    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [runId, setRunId] = useState<string | null>(null);
    const [run, setRun] = useState<RunDetalle | null>(null);

    const [runModalId, setRunModalId] = useState<string | null>(null);
    const [runModal, setRunModal] = useState<RunDetalle | null>(null);
    const [cargandoModal, setCargandoModal] = useState(false);

    const aplicarSugerencia = useCallback((s: Sugerencias) => {
        setSugerencia(s);
        setN(s.n);
        setPlataforma(s.plataforma);
        setIp(s.ip ?? "");
        setIps(s.ips?.join(", ") ?? "");
        setIdentificador(s.identificador ?? "");
        setIdentificadores(s.identificadores?.join(", ") ?? "");
        setUsuarioId(s.usuarioId ?? "");
    }, []);

    const cargarSugerencia = useCallback(
        async (esc: Escenario, opts?: { silent?: boolean }) => {
            setError(null);
            if (esc === "personalizado") {
                setSugerencia(null);
                setIp("");
                setIps("");
                setIdentificador("");
                setIdentificadores("");
                setPlataforma("");
                setUsuarioId("");
                return;
            }
            if (!opts?.silent) setCargandoSugerencia(true);
            try {
                const res = await fetch(`/api/admin/anti-abuso/simular/sugerencias?escenario=${esc}`, {
                    credentials: "include",
                });
                const json = await res.json().catch(() => ({ error: { message: "Error de red" } }));
                if (!res.ok) {
                    setError(json.error?.message ?? "No se pudieron cargar las sugerencias");
                    return;
                }
                aplicarSugerencia(json.sugerencias as Sugerencias);
            } catch {
                setError("Error de red al cargar sugerencias");
            } finally {
                if (!opts?.silent) setCargandoSugerencia(false);
            }
        },
        [aplicarSugerencia]
    );

    useEffect(() => {
        void cargarSugerencia(escenario);
    }, [escenario, cargarSugerencia]);

    useEffect(() => {
        const FALLBACK_PLATAFORMAS = [
            { value: "whatsapp", label: "WhatsApp" },
            { value: "telegram", label: "Telegram" },
            { value: "instagram", label: "Instagram" },
            { value: "facebook", label: "Facebook" },
        ];

        fetch("/api/plataformas", { credentials: "include" })
            .then((r) => r.json())
            .then((json: { plataformas?: Array<{ clave: string; nombre: string }> }) => {
                const lista = json.plataformas ?? [];
                if (lista.length === 0) {
                    setPlataformaOptions(FALLBACK_PLATAFORMAS);
                    return;
                }
                setPlataformaOptions(
                    lista
                        .filter((p) => p.clave !== "otro")
                        .map((p) => ({ value: p.clave, label: p.nombre }))
                );
            })
            .catch(() => setPlataformaOptions(FALLBACK_PLATAFORMAS));
    }, []);

    const cargarRun = useCallback(async (id: string) => {
        try {
            const res = await fetch(`/api/admin/anti-abuso/simular/${id}`, { credentials: "include" });
            if (!res.ok) return;
            const json = await res.json();
            setRun(json.run as RunDetalle);
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

    const abrirModal = useCallback(async (id: string) => {
        setRunModalId(id);
        setCargandoModal(true);
        try {
            const res = await fetch(`/api/admin/anti-abuso/simular/${id}`, { credentials: "include" });
            if (!res.ok) {
                setRunModalId(null);
                return;
            }
            const json = await res.json();
            setRunModal(json.run as RunDetalle);
        } catch {
            setRunModalId(null);
        } finally {
            setCargandoModal(false);
        }
    }, []);

    const iniciar = useCallback(async () => {
        setEnviando(true);
        setError(null);
        setRunId(null);
        try {
            const body: Record<string, unknown> = { escenario, n };
            // SPEC-192: priorizar arrays sobre campos únicos cuando el array tiene contenido.
            if (identificadores.trim()) body.identificadores = arraysFromInput(identificadores);
            else if (identificador.trim()) body.identificador = identificador.trim();

            if (ips.trim()) body.ips = arraysFromInput(ips);
            else if (ip.trim()) body.ip = ip.trim();

            if (plataforma.trim()) body.plataforma = plataforma.trim();
            if (usuarioId.trim()) body.usuarioId = usuarioId.trim();
            if (nota.trim()) body.nota = nota.trim();

            const res = await fetch("/api/admin/anti-abuso/simular", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body),
            });
            const json = await res.json().catch(() => ({ error: { message: "Error de red" } }));
            if (!res.ok) {
                setError(json.error?.message ?? "No se pudo iniciar");
                return;
            }
            setRunId(json.runId as string);
        } catch {
            setError("Error de red");
        } finally {
            setEnviando(false);
        }
    }, [escenario, n, ip, ips, identificador, identificadores, plataforma, usuarioId, nota]);

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

    const repetirConNuevaSugerencia = useCallback(async () => {
        if (!runModal) return;
        setRunModalId(null);
        setSubTab("nueva");
        setEscenario(runModal.escenario);
        await cargarSugerencia(runModal.escenario, { silent: true });
        setRunId(null);
        setRun(null);
    }, [runModal, cargarSugerencia]);

    const cancelarDesdeModal = useCallback(async () => {
        if (!runModal) return;
        await fetch(`/api/admin/anti-abuso/simular/${runModal.id}/cancelar`, {
            method: "POST",
            credentials: "include",
        });
        setRunModalId(null);
    }, [runModal]);

    const finalizada = run && ["COMPLETADA", "FALLIDA", "CANCELADA"].includes(run.estado);

    return (
        <section className="space-y-6" aria-labelledby="anti-abuso-simulador-title">
            <div>
                <h2 id="anti-abuso-simulador-title" className="text-xl font-bold text-body">Simulador de abusos</h2>
                <p className="mt-1 text-sm text-muted">
                    Genera reportes reales contra el pipeline anti-abuso. La IP inyectable debe estar en rangos RFC 5737.
                </p>
            </div>

            <div role="tablist" aria-label="Sub-secciones simulador" className="flex gap-2 border-b border-tinta/10 pb-1">
                {[
                    { id: "nueva", label: "Nueva corrida" },
                    { id: "historial", label: "Historial" },
                ].map((t) => (
                    <button
                        key={t.id}
                        role="tab"
                        aria-selected={subTab === t.id}
                        onClick={() => setSubTab(t.id as "nueva" | "historial")}
                        className={`px-4 py-2 text-sm font-semibold transition ${
                            subTab === t.id
                                ? "border-b-2 border-sky-600 text-sky-700"
                                : "text-muted hover:text-body"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {subTab === "nueva" && (
                <div className="space-y-6">
                    <div className="glass rounded-2xl p-4 sm:p-5">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                            <Select
                                label="Escenario"
                                options={ESCENARIO_OPCIONES}
                                value={escenario}
                                onChange={(e) => {
                                    setEscenario(e.target.value as Escenario);
                                    setRun(null);
                                    setRunId(null);
                                    setError(null);
                                    setSugerencia(null);
                                }}
                            />
                            <Input
                                label="Cantidad (N)"
                                type="number"
                                min={1}
                                max={200}
                                value={n}
                                onChange={(e) => setN(Number(e.target.value))}
                            />
                            <div className="space-y-1">
                                <Input
                                    label="IP inyectable (RFC 5737)"
                                    value={ip}
                                    onChange={(e) => setIp(e.target.value)}
                                    placeholder="192.0.2.x"
                                    disabled={ips.trim().length > 0}
                                />
                                {ips.trim().length > 0 && (
                                    <p className="text-xs text-muted">Se usa el array de arriba</p>
                                )}
                            </div>
                            <Input
                                label="IPs (array separado por coma)"
                                value={ips}
                                onChange={(e) => setIps(formatArrayField(e.target.value))}
                                placeholder="192.0.2.20, 192.0.2.21, ..."
                            />
                            <div className="space-y-1">
                                <Input
                                    label="Identificador objetivo"
                                    value={identificador}
                                    onChange={(e) => setIdentificador(e.target.value)}
                                    placeholder="Teléfono, nick o perfil"
                                    disabled={identificadores.trim().length > 0}
                                />
                                {identificadores.trim().length > 0 && (
                                    <p className="text-xs text-muted">Se usa el array de arriba</p>
                                )}
                            </div>
                            <Input
                                label="Identificadores (array separado por coma)"
                                value={identificadores}
                                onChange={(e) => setIdentificadores(formatArrayField(e.target.value))}
                                placeholder="3001000001, 3001000002, ..."
                            />
                            <Select
                                label="Plataforma"
                                options={[{ value: "", label: "Selecciona una plataforma" }, ...plataformaOptions]}
                                value={plataforma}
                                onChange={(e) => setPlataforma(e.target.value)}
                            />
                            <Input
                                label="Usuario PARENT de prueba"
                                value={usuarioId}
                                onChange={(e) => setUsuarioId(e.target.value)}
                                placeholder="Solo para denunciante_spam"
                            />
                            <Input
                                label="Nota (interna)"
                                value={nota}
                                onChange={(e) => setNota(e.target.value.slice(0, 200))}
                                placeholder="Opcional, máximo 200 caracteres"
                            />
                        </div>

                        {escenario !== "personalizado" && sugerencia && (
                            <div className="mt-4 rounded-xl bg-sky-50/60 p-3 text-sm text-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
                                <p className="font-medium">Sugerencia del sistema</p>
                                <p className="mt-1">{sugerencia.descripcion}</p>
                                <p className="mt-1 text-xs text-sky-800 dark:text-sky-200">
                                    El sistema propuso esta configuración. Puedes cambiar cualquier campo o dejarlo así.
                                </p>
                                <Button
                                    variant="ghost"
                                    className="mt-2 h-auto px-2 py-1 text-xs"
                                    onClick={() => cargarSugerencia(escenario)}
                                    disabled={cargandoSugerencia}
                                >
                                    {cargandoSugerencia ? "Cargando..." : "Refrescar sugerencia"}
                                </Button>
                            </div>
                        )}

                        {escenario === "denunciante_spam" && !usuarioId.trim() && (
                            <p className="mt-3 text-sm text-rubi">
                                Falta configurar simulacion.spam.usuario_id en Configuración → Sistema. Debe apuntar al id de un usuario PARENT de prueba.
                            </p>
                        )}

                        {error && <p className="mt-3 text-sm text-rubi">{error}</p>}
                        <div className="mt-4 flex gap-2">
                            <Button onClick={iniciar} disabled={enviando || (!!runId && !finalizada)} isLoading={enviando}>
                                Iniciar simulación
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
                                    Simulación {run.id.slice(0, 8)} · {ESTADO_LABELS[run.estado]}
                                </h3>
                                <span className="text-sm text-muted">
                                    {run.creadoEn ? new Date(run.creadoEn).toLocaleString("es-CO") : "—"}
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
                </div>
            )}

            {subTab === "historial" && (
                <AdminAntiAbusoSimuladorHistorial onVerDetalle={abrirModal} />
            )}

            <AdminAntiAbusoSimuladorDetalleModal
                run={runModal}
                isOpen={!!runModalId}
                onClose={() => setRunModalId(null)}
                onRepetir={repetirConNuevaSugerencia}
                onCancelar={cancelarDesdeModal}
                isLoading={cargandoModal}
            />
        </section>
    );
}
