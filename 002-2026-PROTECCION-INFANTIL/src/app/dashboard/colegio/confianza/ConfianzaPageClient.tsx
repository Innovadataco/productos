"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Tabla, TablaHead, TablaBody } from "@/components/ui/Tabla";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Cargando } from "@/components/ui/Cargando";
import { Markdown } from "@/lib/docs/markdown";

interface Documento {
    clave: string;
    titulo: string;
    ruta: string;
}

interface EventoAuditoria {
    id: string;
    accion: string;
    tipoRecurso: string;
    fecha: string;
    resumen: string | null;
}

export default function ConfianzaPageClient() {
    const [documentos, setDocumentos] = useState<Documento[]>([]);
    const [documentoActivo, setDocumentoActivo] = useState<string>("transparencia");
    const [markdown, setMarkdown] = useState<string | null>(null);
    const [titulo, setTitulo] = useState<string>("");
    const [cargandoDoc, setCargandoDoc] = useState(true);
    const [errorDoc, setErrorDoc] = useState<string | null>(null);

    const [eventos, setEventos] = useState<EventoAuditoria[]>([]);
    const [cargandoAuditoria, setCargandoAuditoria] = useState(true);
    const [errorAuditoria, setErrorAuditoria] = useState<string | null>(null);
    const [dias, setDias] = useState<30 | 60 | 90>(90);

    const cargarDocumentos = useCallback(async () => {
        try {
            const res = await fetch("/api/colegio/confianza/documentos", { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.documentos) {
                setDocumentos(data.documentos);
            }
        } catch {
            // no crítico
        }
    }, []);

    const cargarDocumento = useCallback(async (clave: string) => {
        setCargandoDoc(true);
        setErrorDoc(null);
        try {
            const res = await fetch(`/api/colegio/confianza/documentos?clave=${clave}`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setErrorDoc(data?.error?.message || "Error cargando documento");
                setMarkdown(null);
                return;
            }
            setTitulo(data.titulo);
            setMarkdown(data.markdown);
        } catch {
            setErrorDoc("Error de red cargando documento");
            setMarkdown(null);
        } finally {
            setCargandoDoc(false);
        }
    }, []);

    const cargarAuditoria = useCallback(async () => {
        setCargandoAuditoria(true);
        setErrorAuditoria(null);
        try {
            const res = await fetch(`/api/colegio/confianza/auditoria?dias=${dias}`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setErrorAuditoria(data?.error?.message || "Error cargando auditoría");
                setEventos([]);
                return;
            }
            setEventos(data.items ?? []);
        } catch {
            setErrorAuditoria("Error de red cargando auditoría");
            setEventos([]);
        } finally {
            setCargandoAuditoria(false);
        }
    }, [dias]);

    useEffect(() => {
        cargarDocumentos();
    }, [cargarDocumentos]);

    useEffect(() => {
        cargarDocumento(documentoActivo);
    }, [documentoActivo, cargarDocumento]);

    useEffect(() => {
        cargarAuditoria();
    }, [cargarAuditoria]);

    const descargarPDF = async () => {
        try {
            const res = await fetch("/api/colegio/confianza/protocolo/pdf", { credentials: "include" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setErrorDoc(data?.error?.message || "Error generando PDF");
                return;
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            const filename = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] || "protocolo.pdf";
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            setErrorDoc("Error de red descargando PDF");
        }
    };

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-2xl font-bold text-body">Confianza institucional</h1>
                <p className="text-subtle">Transparencia, protocolo e historial de auditoría</p>
            </header>

            <section className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                        <Select
                            label="Documento"
                            options={documentos.map((d) => ({ value: d.clave, label: d.titulo }))}
                            value={documentoActivo}
                            onChange={(e) => setDocumentoActivo(e.target.value)}
                            className="w-64"
                        />
                        <Button onClick={descargarPDF} variant="outline">
                            Descargar PDF
                        </Button>
                    </div>
                </div>

                {cargandoDoc ? (
                    <Cargando texto="Cargando documento..." />
                ) : errorDoc ? (
                    <ErrorState title="No pudimos cargar el documento" description={errorDoc} />
                ) : markdown ? (
                    <GlassCard className="p-6">
                        <h2 className="mb-4 text-xl font-bold text-body">{titulo}</h2>
                        <Markdown source={markdown} />
                    </GlassCard>
                ) : null}
            </section>

            <section className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-xl font-bold text-body">Historial de auditoría</h2>
                    <Select
                        label="Período"
                        options={[
                            { value: "30", label: "Últimos 30 días" },
                            { value: "60", label: "Últimos 60 días" },
                            { value: "90", label: "Últimos 90 días" },
                        ]}
                        value={String(dias)}
                        onChange={(e) => setDias(Number(e.target.value) as 30 | 60 | 90)}
                        className="w-44"
                    />
                </div>

                {cargandoAuditoria ? (
                    <Cargando texto="Cargando auditoría..." />
                ) : errorAuditoria ? (
                    <ErrorState title="No pudimos cargar la auditoría" description={errorAuditoria} />
                ) : eventos.length === 0 ? (
                    <EmptyState
                        title="Sin eventos registrados"
                        description="No hay eventos de auditoría para este colegio en el período seleccionado."
                    />
                ) : (
                    <Tabla aria-label="Historial de auditoría del colegio">
                        <TablaHead>
                            <tr>
                                <th className="px-4 py-3 font-semibold">Fecha</th>
                                <th className="px-4 py-3 font-semibold">Acción</th>
                                <th className="px-4 py-3 font-semibold">Recurso</th>
                                <th className="px-4 py-3 font-semibold">Resumen</th>
                            </tr>
                        </TablaHead>
                        <TablaBody>
                            {eventos.map((evento) => (
                                <tr key={evento.id}>
                                    <td className="px-4 py-3 text-sm">{new Date(evento.fecha).toLocaleString("es-CO", { timeZone: "America/Bogota" })}</td>
                                    <td className="px-4 py-3 text-sm">{evento.accion}</td>
                                    <td className="px-4 py-3 text-sm">{evento.tipoRecurso}</td>
                                    <td className="px-4 py-3 text-sm">{evento.resumen ?? "—"}</td>
                                </tr>
                            ))}
                        </TablaBody>
                    </Tabla>
                )}
            </section>
        </div>
    );
}
