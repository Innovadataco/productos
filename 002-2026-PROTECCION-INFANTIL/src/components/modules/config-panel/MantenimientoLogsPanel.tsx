"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Alerta } from "@/components/ui/Alerta";
import { Cargando } from "@/components/ui/Cargando";

const SERVICIOS = [
    { value: "", label: "Todos los servicios" },
    { value: "pi-app", label: "pi-app" },
    { value: "pi-worker", label: "pi-worker" },
    { value: "pi-monitor", label: "pi-monitor" },
    { value: "pi-simulador-abuso", label: "pi-simulador-abuso" },
];

const NIVELES = [
    { value: "", label: "Todos los niveles" },
    { value: "DEBUG", label: "DEBUG" },
    { value: "INFO", label: "INFO" },
    { value: "WARN", label: "WARN" },
    { value: "ERROR", label: "ERROR" },
];

function localDateTimeToIso(valor: string): string | undefined {
    if (!valor) return undefined;
    const d = new Date(`${valor}:00`);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
}

function maxAyer(): string {
    const ahora = new Date();
    const ayer = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1, 23, 59);
    const yyyy = ayer.getFullYear();
    const mm = String(ayer.getMonth() + 1).padStart(2, "0");
    const dd = String(ayer.getDate()).padStart(2, "0");
    const hh = String(ayer.getHours()).padStart(2, "0");
    const mi = String(ayer.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export function MantenimientoLogsPanel() {
    const [hasta, setHasta] = useState("");
    const [servicio, setServicio] = useState("");
    const [nivel, setNivel] = useState("");
    const [motivo, setMotivo] = useState("");

    const [contando, setContando] = useState(false);
    const [filasAfectadas, setFilasAfectadas] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [exito, setExito] = useState<string | null>(null);

    const [modalAbierto, setModalAbierto] = useState(false);
    const [purgaEnCurso, setPurgaEnCurso] = useState(false);

    const maxHasta = useMemo(() => maxAyer(), []);

    const buildQuery = (): string => {
        const params = new URLSearchParams();
        params.set("limit", "0");
        const hastaIso = localDateTimeToIso(hasta);
        if (hastaIso) params.set("hasta", hastaIso);
        if (servicio) params.set("servicio", servicio);
        if (nivel) params.set("nivel", nivel);
        return params.toString();
    };

    const validarMotivo = (): string | null => {
        if (motivo.length < 20 || motivo.length > 500) {
            return "El motivo debe tener entre 20 y 500 caracteres.";
        }
        return null;
    };

    const contar = async () => {
        setError(null);
        setExito(null);
        setFilasAfectadas(null);
        if (!hasta) {
            setError("Selecciona una fecha límite.");
            return;
        }
        setContando(true);
        try {
            const res = await fetch(`/api/admin/monitoreo/logs?${buildQuery()}`, {
                credentials: "include",
            });
            const data: unknown = await res.json().catch(() => null);
            if (!res.ok) {
                const mensaje =
                    data && typeof data === "object" && "error" in data
                        ? (data as { error?: { message?: string } }).error?.message
                        : undefined;
                setError(mensaje || "No se pudo contar las filas afectadas.");
                return;
            }
            const total = typeof data === "object" && data !== null ? (data as { total?: number }).total ?? 0 : 0;
            setFilasAfectadas(total);
        } catch {
            setError("Error de red al contar las filas afectadas.");
        } finally {
            setContando(false);
        }
    };

    const confirmarPurga = async () => {
        const errorMotivo = validarMotivo();
        if (errorMotivo) {
            setError(errorMotivo);
            return;
        }
        const hastaIso = localDateTimeToIso(hasta);
        if (!hastaIso) {
            setError("Selecciona una fecha límite válida.");
            return;
        }
        setPurgaEnCurso(true);
        setError(null);
        setExito(null);
        try {
            const res = await fetch("/api/admin/monitoreo/logs", {
                method: "DELETE",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    hasta: hastaIso,
                    ...(servicio ? { servicio } : {}),
                    ...(nivel ? { nivel } : {}),
                    motivo,
                }),
            });
            const data: unknown = await res.json().catch(() => null);
            if (!res.ok) {
                const mensaje =
                    data && typeof data === "object" && "error" in data
                        ? (data as { error?: { message?: string } }).error?.message
                        : undefined;
                setError(mensaje || "No se pudo purgar los logs.");
                return;
            }
            const filas = typeof data === "object" && data !== null ? (data as { filasBorradas?: number }).filasBorradas ?? 0 : 0;
            setExito(`Purga completada. Se eliminaron ${filas} registro${filas === 1 ? "" : "s"}.`);
            setFilasAfectadas(null);
            setMotivo("");
            setHasta("");
        } catch {
            setError("Error de red al purgar los logs.");
        } finally {
            setPurgaEnCurso(false);
            setModalAbierto(false);
        }
    };

    return (
        <section className="glass rounded-2xl p-5 sm:p-6">
            <div className="mb-4">
                <h2 className="text-lg font-semibold text-body">Mantenimiento de logs</h2>
                <p className="text-sm text-muted">
                    Purga registros técnicos anteriores a una fecha límite. Esta acción es irreversible.
                </p>
            </div>

            {error && (
                <Alerta tono="error" className="mb-4">
                    {error}
                </Alerta>
            )}
            {exito && (
                <Alerta tono="exito" role="status" className="mb-4">
                    {exito}
                </Alerta>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2 lg:col-span-1">
                    <Input
                        label="Hasta"
                        type="datetime-local"
                        max={maxHasta}
                        value={hasta}
                        onChange={(e) => setHasta(e.target.value)}
                    />
                </div>
                <div>
                    <Select
                        label="Servicio"
                        options={SERVICIOS}
                        value={servicio}
                        onChange={(e) => setServicio(e.target.value)}
                    />
                </div>
                <div>
                    <Select
                        label="Nivel"
                        options={NIVELES}
                        value={nivel}
                        onChange={(e) => setNivel(e.target.value)}
                    />
                </div>
            </div>

            <div className="mt-4">
                <label htmlFor="motivo-purga" className="block text-sm font-medium text-body mb-1.5">
                    Motivo de la purga
                </label>
                <textarea
                    id="motivo-purga"
                    rows={3}
                    className="w-full rounded-xl px-4 py-3 text-sm text-body placeholder:text-subtle outline-none transition glass-input ring-accent-input"
                    placeholder="Describe por qué se eliminan estos logs (obligatorio, entre 20 y 500 caracteres)."
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted">{motivo.length} / 500 caracteres</p>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button variant="outline" onClick={contar} isLoading={contando} disabled={!hasta}>
                    Contar filas afectadas
                </Button>
                <Button onClick={() => setModalAbierto(true)} disabled={!hasta || !motivo}>
                    Confirmar purga
                </Button>
                {filasAfectadas !== null && (
                    <span className="text-sm text-subtle">
                        Filas afectadas: <span className="font-semibold text-body">{filasAfectadas}</span>
                    </span>
                )}
            </div>

            <Modal isOpen={modalAbierto} onClose={() => setModalAbierto(false)} title="Confirmar purga de logs">
                <div className="space-y-4">
                    <p className="text-sm text-body">
                        Se eliminarán los logs anteriores a{" "}
                        <span className="font-medium">{hasta ? new Date(`${hasta}:00`).toLocaleString("es-CO") : "—"}</span>
                        {servicio && (
                            <>
                                {" "}
                                del servicio <span className="font-medium">{servicio}</span>
                            </>
                        )}
                        {nivel && (
                            <>
                                {" "}
                                con nivel <span className="font-medium">{nivel}</span> o superior
                            </>
                        )}
                        .
                    </p>
                    {filasAfectadas !== null && (
                        <p className="text-sm text-subtle">Registros que se eliminarán: {filasAfectadas}</p>
                    )}
                    <p className="text-sm text-muted">Esta acción no se puede deshacer.</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button variant="outline" onClick={() => setModalAbierto(false)} disabled={purgaEnCurso}>
                            Cancelar
                        </Button>
                        <Button variant="danger" onClick={confirmarPurga} isLoading={purgaEnCurso}>
                            Confirmar purga
                        </Button>
                    </div>
                </div>
            </Modal>
        </section>
    );
}
