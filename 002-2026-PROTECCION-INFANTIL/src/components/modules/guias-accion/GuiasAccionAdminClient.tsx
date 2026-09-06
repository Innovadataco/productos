"use client";

import { useEffect, useMemo, useState } from "react";
import { EstadoGuiaAccion } from "@prisma/client";
import { Guia, Pagination } from "./types";
import { EditorGuiaModal, PreviewGuiaModal } from "./GuiasAccionModals";

const ESTADO_LABEL: Record<EstadoGuiaAccion, string> = {
    [EstadoGuiaAccion.BORRADOR]: "Borrador",
    [EstadoGuiaAccion.PENDIENTE_APROBACION_COMITE]: "Pendiente de aprobación",
    [EstadoGuiaAccion.ACTIVA]: "Activa",
    [EstadoGuiaAccion.REEMPLAZADA]: "Reemplazada",
};

const ESTADO_CLASS: Record<EstadoGuiaAccion, string> = {
    [EstadoGuiaAccion.BORRADOR]: "bg-tinta/10 text-body",
    [EstadoGuiaAccion.PENDIENTE_APROBACION_COMITE]: "bg-ambar/20 text-estado-ambar",
    [EstadoGuiaAccion.ACTIVA]: "bg-pino/10 text-estado-pino",
    [EstadoGuiaAccion.REEMPLAZADA]: "bg-tinta/10 text-muted",
};

export default function GuiasAccionAdminClient() {
    const [guias, setGuias] = useState<Guia[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<"ambar" | "cielo">("ambar");
    const [estadoFiltro, setEstadoFiltro] = useState<EstadoGuiaAccion | "">("");
    const [editando, setEditando] = useState<Guia | null>(null);
    const [preview, setPreview] = useState<Guia | null>(null);
    const [mensaje, setMensaje] = useState<string | null>(null);

    const fetchGuias = async (page = pagination.page) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("pageSize", String(pagination.pageSize));
            if (estadoFiltro) params.set("estado", estadoFiltro);
            const res = await fetch(`/api/admin/guias-accion?${params.toString()}`);
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
    }, [estadoFiltro]);

    const categoriasActivas = useMemo(() => new Set(guias.filter((g) => g.estado === EstadoGuiaAccion.ACTIVA).map((g) => g.categoria)), [guias]);

    const handleNueva = async (categoria: string) => {
        setError(null);
        try {
            const res = await fetch("/api/admin/guias-accion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    categoria,
                    tituloEmocional: "Nueva guía de acción",
                    categoriaBadgeTexto: categoria,
                    pasosJson: [{ orden: 1, tipo: "TRANQUILIDAD", titulo: "Primer paso", descripcion: "Edite este paso" }],
                    botonesAccionJson: [{ tipo: "url", texto: "Ejemplo", valor: "https://teprotejo.org", estilo: "secundario" }],
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message ?? "Error al crear guía");
            setEditando(data.guia as Guia);
            void fetchGuias(1);
            setMensaje("Guía creada en borrador.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        }
    };

    const handleGuardar = async (guia: Guia) => {
        setError(null);
        try {
            const res = await fetch(`/api/admin/guias-accion/${guia.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tituloEmocional: guia.tituloEmocional,
                    subtitulo: guia.subtitulo,
                    categoriaBadgeTexto: guia.categoriaBadgeTexto,
                    pasosJson: guia.pasosJson,
                    calloutTitulo: guia.calloutTitulo,
                    calloutTexto: guia.calloutTexto,
                    botonesAccionJson: guia.botonesAccionJson,
                    piePagina: guia.piePagina,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message ?? "Error al guardar guía");
            setEditando(null);
            void fetchGuias(pagination.page);
            setMensaje("Guía guardada.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        }
    };

    const handleEnviar = async (id: string) => {
        setError(null);
        try {
            const res = await fetch(`/api/admin/guias-accion/${id}/enviar-comite`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message ?? "Error al enviar guía");
            void fetchGuias(pagination.page);
            setMensaje("Guía enviada al comité.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        }
    };

    return (
        <div className="space-y-6">
            <div className="border-b border-tinta/10 dark:border-tinta/15">
                <nav className="-mb-px flex gap-6" aria-label="Tabs de guías">
                    <button
                        type="button"
                        onClick={() => setTab("ambar")}
                        className={`inline-flex items-center border-b-2 px-1 py-3 text-sm font-medium transition ${
                            tab === "ambar"
                                ? "border-cielo text-cielo dark:border-cielo dark:text-cielo"
                                : "border-transparent text-muted hover:border-tinta/15 hover:text-body"
                        }`}
                    >
                        Administrar
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab("cielo")}
                        className={`inline-flex items-center border-b-2 px-1 py-3 text-sm font-medium transition ${
                            tab === "cielo"
                                ? "border-cielo text-cielo dark:border-cielo dark:text-cielo"
                                : "border-transparent text-muted hover:border-tinta/15 hover:text-body"
                        }`}
                    >
                        Preview
                    </button>
                </nav>
            </div>

            {mensaje && (
                <div className="rounded-md bg-pino/10 p-3 text-sm text-estado-pino">
                    {mensaje}
                    <button type="button" className="ml-2 font-semibold" onClick={() => setMensaje(null)}>×</button>
                </div>
            )}
            {error && <div className="rounded-md bg-rubi/10 p-3 text-sm text-estado-rubi">{error}</div>}

            {tab === "ambar" && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <select
                            value={estadoFiltro}
                            onChange={(e) => setEstadoFiltro(e.target.value as EstadoGuiaAccion | "")}
                            className="rounded-md border border-tinta/15 px-3 py-2 text-sm"
                        >
                            <option value="">Todos los estados</option>
                            {Object.values(EstadoGuiaAccion).map((e) => (
                                <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
                            ))}
                        </select>
                        <select
                            onChange={(e) => { if (e.target.value) void handleNueva(e.target.value); e.target.value = ""; }}
                            className="rounded-md border border-tinta/15 px-3 py-2 text-sm"
                            defaultValue=""
                        >
                            <option value="" disabled>+ Nueva guía...</option>
                            {["GROOMING", "SEXTORSION", "DIFUSION_NO_CONSENTIDA", "EXTORSION", "DOXING", "CIBERACOSO", "SOLICITUD_ENCUENTRO", "COMPARTIMIENTO_SEXUAL", "OTRO"].map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    {loading ? (
                        <p className="text-sm text-muted">Cargando...</p>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-tinta/10">
                            <table className="min-w-full divide-y divide-tinta/10 text-sm">
                                <thead className="bg-tinta/5">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-body">Categoría</th>
                                        <th className="px-4 py-3 text-left font-semibold text-body">Versión</th>
                                        <th className="px-4 py-3 text-left font-semibold text-body">Título</th>
                                        <th className="px-4 py-3 text-left font-semibold text-body">Estado</th>
                                        <th className="px-4 py-3 text-left font-semibold text-body">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-tinta/10 bg-papel">
                                    {guias.map((g) => (
                                        <tr key={g.id}>
                                            <td className="px-4 py-3 font-medium">{g.categoria}</td>
                                            <td className="px-4 py-3 text-muted">v{g.versionSecuencial}</td>
                                            <td className="px-4 py-3">{g.tituloEmocional}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${ESTADO_CLASS[g.estado]}`}>
                                                    {ESTADO_LABEL[g.estado]}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => { setEditando(g); setPreview(null); }}
                                                        className="rounded-md bg-tinta/10 px-2 py-1 text-xs font-medium text-body hover:bg-tinta/15"
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setPreview(g); setEditando(null); }}
                                                        className="rounded-md bg-cielo/10 px-2 py-1 text-xs font-medium text-cielo hover:bg-cielo/20"
                                                    >
                                                        Preview
                                                    </button>
                                                    {g.estado === EstadoGuiaAccion.BORRADOR && (
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleEnviar(g.id)}
                                                            className="rounded-md bg-ambar/10 px-2 py-1 text-xs font-medium text-estado-ambar hover:bg-ambar/20"
                                                        >
                                                            Enviar a comité
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {guias.length === 0 && (
                                        <tr>
                                            <td className="px-4 py-6 text-center text-muted" colSpan={5}>
                                                No hay guías que coincidan con el filtro.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

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

            {tab === "cielo" && (
                <div className="rounded-lg border border-tinta/10 bg-tinta/5 p-6 text-sm text-muted">
                    Seleccione &quot;Preview&quot; en una guía del listado para ver cómo se verá públicamente.
                </div>
            )}

            {editando && (
                <EditorGuiaModal
                    guia={editando}
                    onClose={() => setEditando(null)}
                    onSave={(g) => void handleGuardar(g)}
                    categoriasOcupadas={categoriasActivas}
                />
            )}

            {preview && (
                <PreviewGuiaModal guia={preview} onClose={() => setPreview(null)} />
            )}
        </div>
    );
}
