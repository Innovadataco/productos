"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Cargando } from "@/components/ui/Cargando";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import { useFetchJson } from "@/components/ui/use-fetch-json";

type Ventana = "24h" | "7d" | "30d";

type Tablero = {
    ventana: Ventana;
    topIpsBloqueadas: Array<{ ip: string; bloqueos: number; ultimoBloqueoEn: string | null }>;
    topIdentificadores: Array<{ identificador: string; plataformaId: string; plataformaNombre: string; total: number }>;
    topFingerprints: Array<{ fingerprintHash: string; reportes: number; ipsUnicas: number; ultimoReporteEn: string | null }>;
    bloqueosVigentes: Array<{ id: string; ipHash: string; ipOriginal: string | null; motivo: string; expiraEn: string | null; creadoEn: string }>;
    alertasActivas: Array<{ senal: string; inicio: string; detalle: string | null }>;
};

const VENTANA_OPCIONES = [
    { value: "24h", label: "Últimas 24 horas" },
    { value: "7d", label: "Últimos 7 días" },
    { value: "30d", label: "Últimos 30 días" },
];

const DURACION_OPCIONES = [
    { value: "24h", label: "24 horas" },
    { value: "7d", label: "7 días" },
    { value: "permanente", label: "Permanente" },
];

export function AdminAntiAbusoOperativo() {
    const [ventana, setVentana] = useState<Ventana>("24h");
    const { datos: tablero, cargando, error, recargar } = useFetchJson<Tablero>(`/api/admin/anti-abuso/tablero?ventana=${ventana}`);

    return (
        <section className="space-y-6" aria-labelledby="anti-abuso-operativo-title">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 id="anti-abuso-operativo-title" className="text-xl font-bold text-body">Tablero operativo</h2>
                    <p className="mt-1 text-sm text-muted">Señales de abuso, IPs bloqueadas e identificadores más reportados.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select label="Ventana" options={VENTANA_OPCIONES} value={ventana} onChange={(e) => setVentana(e.target.value as Ventana)} />
                    <Button onClick={recargar} variant="outline">Recargar</Button>
                </div>
            </div>

            {error && !tablero && (
                <ErrorState title="No pudimos cargar el tablero" description="Ocurrió un problema al consultar los datos." onRetry={recargar} />
            )}
            {!tablero && !error && (
                <div className="glass rounded-2xl p-6">
                    <Cargando texto="Cargando tablero..." />
                </div>
            )}

            {tablero && (
                <>
                    <PanelBloquearIp onChange={recargar} />

                    {tablero.alertasActivas.length > 0 && (
                        <div className="rounded-2xl border border-rubi/20 bg-rubi/5 p-4">
                            <h3 className="mb-2 font-semibold text-rubi">Alertas activas</h3>
                            <ul className="space-y-1 text-sm">
                                {tablero.alertasActivas.map((a) => (
                                    <li key={a.senal}>
                                        <span className="font-mono">{a.senal}</span>
                                        <span className="ml-2 text-muted">{a.detalle ?? `desde ${formatearFecha(a.inicio)}`}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <TablaSimple
                            titulo="Top IPs bloqueadas por rate-limit"
                            vacio="No hay IPs bloqueadas en esta ventana."
                            encabezados={["IP", "Bloqueos", "Último bloqueo"]}
                            filas={tablero.topIpsBloqueadas.map((r) => [r.ip, r.bloqueos, formatearFecha(r.ultimoBloqueoEn)])}
                        />
                        <TablaSimple
                            titulo="Top identificadores más reportados"
                            vacio="No hay identificadores reportados en esta ventana."
                            encabezados={["Identificador", "Plataforma", "Reportes"]}
                            filas={tablero.topIdentificadores.map((r) => [r.identificador, r.plataformaNombre, r.total])}
                        />
                    </div>

                    <TablaSimple
                        titulo="Top fingerprints repetidores"
                        vacio="No hay fingerprints repetidos en esta ventana."
                        encabezados={["Fingerprint", "Reportes", "IPs únicas", "Último reporte"]}
                        filas={tablero.topFingerprints.map((r) => [
                            truncar(r.fingerprintHash, 24),
                            r.reportes,
                            r.ipsUnicas,
                            formatearFecha(r.ultimoReporteEn),
                        ])}
                    />

                    <div className="glass rounded-2xl p-6">
                        <h3 className="mb-4 text-lg font-semibold text-body">Bloqueos vigentes</h3>
                        {tablero.bloqueosVigentes.length === 0 ? (
                            <EmptyState title="Sin bloqueos activos" description="No hay IPs en la blocklist vigente." />
                        ) : (
                            <Tabla sinContenedor>
                                <TablaHead>
                                    <tr>
                                        <th className="px-4 py-3 font-medium">IP</th>
                                        <th className="px-4 py-3 font-medium">IP hash</th>
                                        <th className="px-4 py-3 font-medium">Motivo</th>
                                        <th className="px-4 py-3 font-medium">Expira</th>
                                        <th className="px-4 py-3 font-medium">Creado</th>
                                        <th className="px-4 py-3 font-medium text-right">Acción</th>
                                    </tr>
                                </TablaHead>
                                <TablaBody>
                                    {tablero.bloqueosVigentes.map((b) => (
                                        <tr key={b.id}>
                                            <td className="px-4 py-3 font-mono text-xs">{b.ipOriginal ?? "—"}</td>
                                            <td className="px-4 py-3 font-mono text-xs text-muted">{truncar(b.ipHash, 16)}</td>
                                            <td className="px-4 py-3 text-body">{b.motivo}</td>
                                            <td className="px-4 py-3 text-body">{b.expiraEn ? formatearFecha(b.expiraEn) : "Nunca"}</td>
                                            <td className="px-4 py-3 text-body">{formatearFecha(b.creadoEn)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <BotonDesbloquear id={b.id} onChange={recargar} />
                                            </td>
                                        </tr>
                                    ))}
                                </TablaBody>
                            </Tabla>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}

function PanelBloquearIp({ onChange }: { onChange: () => void }) {
    const [ip, setIp] = useState("");
    const [motivo, setMotivo] = useState("");
    const [duracion, setDuracion] = useState<"24h" | "7d" | "permanente">("24h");
    const [enviando, setEnviando] = useState(false);
    const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

    const submit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            setEnviando(true);
            setMensaje(null);
            try {
                const res = await fetch("/api/admin/anti-abuso/bloquear", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ip, motivo, duracion }),
                });
                const json = await res.json().catch(() => ({ error: { message: "Error de red" } }));
                if (!res.ok) {
                    setMensaje({ tipo: "error", texto: json.error?.message ?? "No se pudo bloquear" });
                } else {
                    setMensaje({ tipo: "ok", texto: "IP bloqueada." });
                    setIp("");
                    setMotivo("");
                    onChange();
                }
            } catch {
                setMensaje({ tipo: "error", texto: "Error de red" });
            } finally {
                setEnviando(false);
            }
        },
        [ip, motivo, duracion, onChange]
    );

    return (
        <form onSubmit={submit} className="glass rounded-2xl p-4 sm:p-5">
            <h3 className="mb-4 font-semibold text-body">Bloquear IP</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="md:col-span-2">
                    <Input label="IP" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.0.2.10" required />
                </div>
                <Select
                    label="Duración"
                    options={DURACION_OPCIONES}
                    value={duracion}
                    onChange={(e) => setDuracion(e.target.value as "24h" | "7d" | "permanente")}
                />
                <div className="md:col-span-1 flex items-end">
                    <Button type="submit" disabled={enviando}>
                        {enviando ? "Bloqueando..." : "Bloquear"}
                    </Button>
                </div>
            </div>
            <div className="mt-3">
                <Input label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo obligatorio" required />
            </div>
            {mensaje && (
                <p className={`mt-3 text-sm ${mensaje.tipo === "ok" ? "text-pino" : "text-rubi"}`}>{mensaje.texto}</p>
            )}
        </form>
    );
}

function BotonDesbloquear({ id, onChange }: { id: string; onChange: () => void }) {
    const [abierto, setAbierto] = useState(false);
    const [motivo, setMotivo] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const abrir = useCallback(() => {
        setMotivo("");
        setError(null);
        setAbierto(true);
    }, []);

    const cerrar = useCallback(() => {
        if (enviando) return;
        setAbierto(false);
    }, [enviando]);

    const desbloquear = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            if (motivo.trim().length < 20) {
                setError("El motivo debe tener al menos 20 caracteres.");
                return;
            }
            setError(null);
            setEnviando(true);
            try {
                const res = await fetch("/api/admin/anti-abuso/desbloquear", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id, motivo: motivo.trim() }),
                });
                const json = await res.json().catch(() => ({ error: { message: "Error de red" } }));
                if (!res.ok) {
                    setError(json.error?.message ?? "No se pudo desbloquear");
                    return;
                }
                setAbierto(false);
                setMotivo("");
                onChange();
            } catch {
                setError("Error de red");
            } finally {
                setEnviando(false);
            }
        },
        [id, motivo, onChange]
    );

    return (
        <>
            <Button onClick={abrir} variant="outline">Desbloquear</Button>
            <Modal isOpen={abierto} onClose={cerrar} title="Desbloquear IP" size="sm">
                <form onSubmit={desbloquear} className="space-y-4">
                    <p className="text-sm text-muted">
                        El desbloqueo queda auditado. Escribe el motivo con al menos 20 caracteres.
                    </p>
                    <Textarea
                        label="Motivo"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value.slice(0, 500))}
                        placeholder="Explica por qué se desbloquea esta IP..."
                        rows={4}
                        required
                    />
                    {error && <p className="text-sm text-rubi">{error}</p>}
                    <div className="flex justify-end gap-2">
                        <Button type="button" onClick={cerrar} variant="secondary" disabled={enviando}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={enviando || motivo.trim().length < 20} isLoading={enviando}>
                            Confirmar desbloqueo
                        </Button>
                    </div>
                </form>
            </Modal>
        </>
    );
}

function TablaSimple({
    titulo,
    vacio,
    encabezados,
    filas,
}: {
    titulo: string;
    vacio: string;
    encabezados: string[];
    filas: Array<(string | number)[]>;
}) {
    return (
        <div className="glass rounded-2xl p-6">
            <h3 className="mb-4 text-lg font-semibold text-body">{titulo}</h3>
            {filas.length === 0 ? (
                <EmptyState title={vacio} description="" />
            ) : (
                <Tabla sinContenedor>
                    <TablaHead>
                        <tr>
                            {encabezados.map((h) => (
                                <th key={h} className="px-4 py-3 font-medium">{h}</th>
                            ))}
                        </tr>
                    </TablaHead>
                    <TablaBody>
                        {filas.map((fila, idx) => (
                            <tr key={idx}>
                                {fila.map((celda, cidx) => (
                                    <td key={cidx} className="px-4 py-3 text-body">{celda}</td>
                                ))}
                            </tr>
                        ))}
                    </TablaBody>
                </Tabla>
            )}
        </div>
    );
}

function formatearFecha(fecha: string | null): string {
    if (!fecha) return "—";
    return new Date(fecha).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

function truncar(texto: string, max: number): string {
    if (texto.length <= max) return texto;
    return `${texto.slice(0, max)}…`;
}
