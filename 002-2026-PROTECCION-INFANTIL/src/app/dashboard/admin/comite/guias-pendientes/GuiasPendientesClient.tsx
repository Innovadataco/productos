"use client";

import { useEffect, useState } from "react";
import { EstadoGuiaAccion } from "@prisma/client";

interface Guia {
    id: string;
    categoria: string;
    versionSecuencial: number;
    tituloEmocional: string;
    subtitulo: string | null;
    categoriaBadgeTexto: string;
    pasosJson: unknown;
    calloutTitulo: string | null;
    calloutTexto: string | null;
    botonesAccionJson: unknown;
    piePagina: string | null;
    estado: EstadoGuiaAccion;
    aprobadaPorComiteJson: unknown;
    creadaPor?: { id: string; email: string; nombre: string | null } | null;
    createdAt: string;
}

interface Pagination {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

type Paso = { orden: number; tipo: "TRANQUILIDAD" | "ATENCION" | "ACCION" | "URGENCIA"; titulo: string; descripcion: string };
type Boton = { tipo: "tel" | "url"; texto: string; subtexto?: string; valor: string; estilo: "primario" | "urgente" | "secundario" };

function pasosFrom(json: unknown): Paso[] {
    if (!Array.isArray(json)) return [];
    return json.filter((p) => p && typeof p === "object" && "orden" in p && "titulo" in p) as Paso[];
}

function botonesFrom(json: unknown): Boton[] {
    if (!Array.isArray(json)) return [];
    return json.filter((b) => b && typeof b === "object" && "texto" in b) as Boton[];
}

export default function GuiasPendientesClient() {
    const [guias, setGuias] = useState<Guia[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mensaje, setMensaje] = useState<string | null>(null);
    const [preview, setPreview] = useState<Guia | null>(null);
    const [rechazando, setRechazando] = useState<Guia | null>(null);
    const [motivo, setMotivo] = useState("");

    const fetchGuias = async (page = pagination.page) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/comite/guias-accion?page=${page}&pageSize=${pagination.pageSize}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message ?? "Error al cargar guías");
            setGuias(data.items ?? []);
            setPagination(data.pagination ?? pagination);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchGuias(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAprobar = async (id: string) => {
        setError(null);
        try {
            const res = await fetch(`/api/admin/comite/guias-accion/${id}/aprobar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message ?? "Error al aprobar guía");
            void fetchGuias(pagination.page);
            setMensaje("Guía aprobada.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        }
    };

    const handleRechazar = async (id: string) => {
        setError(null);
        try {
            const res = await fetch(`/api/admin/comite/guias-accion/${id}/rechazar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ motivo: motivo.trim() || "Sin motivo" }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message ?? "Error al rechazar guía");
            setRechazando(null);
            setMotivo("");
            void fetchGuias(pagination.page);
            setMensaje("Guía rechazada.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        }
    };

    return (
        <div className="space-y-6">
            {mensaje && (
                <div className="rounded-md bg-pino/10 p-3 text-sm text-estado-pino">
                    {mensaje}
                    <button type="button" className="ml-2 font-semibold" onClick={() => setMensaje(null)}>×</button>
                </div>
            )}
            {error && <div className="rounded-md bg-rubi/10 p-3 text-sm text-estado-rubi">{error}</div>}

            {loading ? (
                <p className="text-sm text-muted">Cargando...</p>
            ) : guias.length === 0 ? (
                <p className="text-sm text-muted">No hay guías pendientes de aprobación.</p>
            ) : (
                <div className="space-y-4">
                    {guias.map((g) => (
                        <div key={g.id} className="rounded-lg border border-tinta/10 bg-papel p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <span className="inline-flex rounded-full bg-ambar/20 px-2 py-1 text-xs font-medium text-estado-ambar">
                                        {g.categoriaBadgeTexto} · v{g.versionSecuencial}
                                    </span>
                                    <h3 className="mt-2 text-lg font-semibold text-body">{g.tituloEmocional}</h3>
                                    {g.subtitulo && <p className="text-sm text-muted">{g.subtitulo}</p>}
                                    <p className="mt-1 text-xs text-muted">
                                        Creada por {g.creadaPor?.email ?? "—"} ·{" "}
                                        {new Date(g.createdAt).toLocaleDateString("es-CO")}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPreview(g)}
                                        className="rounded-md bg-cielo/10 px-3 py-1.5 text-xs font-medium text-cielo hover:bg-cielo/20"
                                    >
                                        Ver guía
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleAprobar(g.id)}
                                        className="rounded-md bg-pino/10 px-3 py-1.5 text-xs font-medium text-estado-pino hover:bg-pino/20"
                                    >
                                        Aprobar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRechazando(g)}
                                        className="rounded-md bg-rubi/10 px-3 py-1.5 text-xs font-medium text-estado-rubi hover:bg-rubi/20"
                                    >
                                        Rechazar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {pagination.totalPages > 1 && (
                        <div className="flex items-center gap-2">
                            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => void fetchGuias(p)}
                                    className={`rounded-md px-3 py-1 text-sm ${pagination.page === p ? "bg-cielo text-papel" : "bg-tinta/10 text-body hover:bg-tinta/15"}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {preview && <PreviewGuiaModal guia={preview} onClose={() => setPreview(null)} />}

            {rechazando && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-lg bg-papel p-6 shadow-xl">
                        <h3 className="text-lg font-bold text-body">Rechazar guía</h3>
                        <p className="text-sm text-muted">{rechazando.tituloEmocional}</p>
                        <textarea
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            placeholder="Motivo del rechazo (visible en auditoría)"
                            className="mt-4 w-full rounded-md border border-tinta/15 px-3 py-2 text-sm"
                            rows={4}
                        />
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => { setRechazando(null); setMotivo(""); }}
                                className="rounded-md border border-tinta/15 px-4 py-2 text-sm font-medium text-body hover:bg-tinta/5"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleRechazar(rechazando.id)}
                                className="rounded-md bg-rubi px-4 py-2 text-sm font-medium text-papel hover:bg-rubi/90"
                            >
                                Confirmar rechazo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function PreviewGuiaModal({ guia, onClose }: { guia: Guia; onClose: () => void }) {
    const pasos = pasosFrom(guia.pasosJson);
    const botones = botonesFrom(guia.botonesAccionJson);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-papel p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <span className="rounded-full bg-cielo/10 px-3 py-1 text-xs font-semibold text-cielo">{guia.categoriaBadgeTexto}</span>
                    <button type="button" onClick={onClose} className="text-2xl text-muted hover:text-body">×</button>
                </div>
                <h2 className="text-2xl font-bold text-body">{guia.tituloEmocional}</h2>
                {guia.subtitulo && <p className="mt-2 text-muted">{guia.subtitulo}</p>}

                <div className="mt-6 space-y-4">
                    {pasos.map((p) => (
                        <div key={p.orden} className="flex gap-3">
                            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cielo/10 text-xs font-bold text-cielo">{p.orden}</span>
                            <div>
                                <p className="font-semibold text-body">{p.titulo}</p>
                                <p className="text-sm text-muted">{p.descripcion}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {(guia.calloutTitulo || guia.calloutTexto) && (
                    <div className="mt-6 rounded-md bg-ambar/10 p-4">
                        {guia.calloutTitulo && <p className="font-semibold text-estado-ambar">{guia.calloutTitulo}</p>}
                        {guia.calloutTexto && <p className="mt-1 text-sm text-estado-ambar">{guia.calloutTexto}</p>}
                    </div>
                )}

                <div className="mt-6 flex flex-wrap gap-2">
                    {botones.map((b, i) => (
                        <a
                            key={i}
                            href={b.tipo === "tel" ? `tel:${b.valor}` : b.valor}
                            target={b.tipo === "url" ? "_blank" : undefined}
                            rel={b.tipo === "url" ? "noopener noreferrer" : undefined}
                            className={`inline-flex flex-col rounded-md px-4 py-2 text-sm font-medium ${
                                b.estilo === "urgente"
                                    ? "bg-rubi text-papel hover:bg-rubi/90"
                                    : b.estilo === "primario"
                                        ? "bg-cielo text-papel hover:bg-cielo/90"
                                        : "border border-tinta/15 bg-papel text-body hover:bg-tinta/5"
                            }`}
                        >
                            <span>{b.texto}</span>
                            {b.subtexto && <span className="text-xs opacity-80">{b.subtexto}</span>}
                        </a>
                    ))}
                </div>

                {guia.piePagina && <p className="mt-6 text-xs text-muted">{guia.piePagina}</p>}
            </div>
        </div>
    );
}
