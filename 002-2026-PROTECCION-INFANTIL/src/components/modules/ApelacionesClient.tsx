"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alerta } from "@/components/ui/Alerta";
import { Cargando } from "@/components/ui/Cargando";
import { CanalesOficiales } from "@/components/modules/CanalesOficiales";

/**
 * SPEC-110 — Área del apelante. El titular (o representante acreditado) radica su
 * apelación con evidencia PDF sobre sí mismo y consulta el estado de sus casos.
 * Regla dura: NO se muestra contenido de reportes; solo el número N de reportes
 * asociados. Textos en español neutro, sin voseo.
 */

type Plataforma = { id: string; clave: string; nombre: string };

type ApelacionItem = {
    id: string;
    numero: string;
    identificador: string;
    plataforma: { nombre: string; clave: string };
    estado: "RECIBIDA" | "EN_REVISION" | "ACEPTADA" | "RECHAZADA";
    esRepresentante: boolean;
    creadoEn: string;
    plazoRespuestaEn: string;
    decision: string | null;
    motivacionResolucion: string | null;
    resueltoEn: string | null;
    numeroReportesAsociados: number;
};

type Mensaje = { type: "success" | "error"; text: string } | null;

const ESTADO_LABEL: Record<string, string> = {
    RECIBIDA: "Recibida",
    EN_REVISION: "En revisión",
    ACEPTADA: "Aceptada",
    RECHAZADA: "Rechazada",
};

const ESTADO_VARIANT: Record<string, "info" | "warning" | "success" | "neutral"> = {
    RECIBIDA: "info",
    EN_REVISION: "warning",
    ACEPTADA: "success",
    RECHAZADA: "neutral",
};

function formatFecha(iso: string): string {
    return new Date(iso).toLocaleDateString("es-CO", { timeZone: "America/Bogota", year: "numeric", month: "long", day: "numeric" });
}

export function ApelacionesClient() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();

    const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
    const [items, setItems] = useState<ApelacionItem[]>([]);
    const [cargando, setCargando] = useState(true);
    const [mensaje, setMensaje] = useState<Mensaje>(null);

    const [identificador, setIdentificador] = useState("");
    const [plataformaId, setPlataformaId] = useState("");
    const [motivo, setMotivo] = useState("");
    const [esRepresentante, setEsRepresentante] = useState(false);
    const [acreditacion, setAcreditacion] = useState("");
    const [archivo, setArchivo] = useState<File | null>(null);
    const [enviando, setEnviando] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const res = await fetch("/api/apelaciones/mias?page=1&pageSize=50", { credentials: "include" });
            if (res.status === 401) {
                router.push("/login");
                return;
            }
            const data = await res.json().catch(() => ({}));
            if (res.ok) setItems(data.items || []);
        } catch {
            // silencioso: la lista simplemente queda vacía
        } finally {
            setCargando(false);
        }
    }, [router]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push("/login");
            return;
        }
        fetch("/api/plataformas", { credentials: "include" })
            .then((r) => r.json())
            .then((d) => setPlataformas(d.plataformas || []))
            .catch(() => setPlataformas([]));
        cargar();
    }, [authLoading, user, router, cargar]);

    async function enviar(e: React.FormEvent) {
        e.preventDefault();
        setMensaje(null);
        if (!archivo) {
            setMensaje({ type: "error", text: "Debes adjuntar el documento de evidencia en PDF." });
            return;
        }
        setEnviando(true);
        try {
            const form = new FormData();
            form.append("identificador", identificador.trim());
            form.append("plataformaId", plataformaId);
            form.append("motivo", motivo.trim());
            form.append("esRepresentante", esRepresentante ? "true" : "false");
            if (esRepresentante) form.append("acreditacion", acreditacion.trim());
            form.append("documento", archivo);

            const res = await fetch("/api/apelaciones", { method: "POST", credentials: "include", body: form });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMensaje({
                    type: "success",
                    text: `Apelación radicada con el número ${data.apelacion.numero}. El comité de validación la revisará y responderá en un plazo máximo de 15 días hábiles.`,
                });
                setIdentificador("");
                setPlataformaId("");
                setMotivo("");
                setEsRepresentante(false);
                setAcreditacion("");
                setArchivo(null);
                await cargar();
            } else {
                setMensaje({ type: "error", text: data?.error?.message || "No se pudo radicar la apelación." });
            }
        } catch {
            setMensaje({ type: "error", text: "Error de red al radicar la apelación." });
        } finally {
            setEnviando(false);
        }
    }

    if (authLoading || !user) {
        return (
            <main className="mx-auto max-w-4xl px-4 py-12 text-center">
                <Cargando />
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-body">Apelar un identificador</h1>
                <p className="mt-1 text-sm text-muted">
                    Si tu número, nick o perfil aparece en la consulta pública y consideras que los reportes no te
                    corresponden, puedes ejercer tu derecho de petición (Ley 1581 de 2012).
                </p>
            </div>

            <GlassCard className="mb-6">
                <h2 className="text-sm font-semibold text-body">Qué debes saber antes de apelar</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                    <li>Un humano del comité de validación revisa tu caso y decide; <strong>apelar no oculta nada por sí solo</strong>.</li>
                    <li>El plazo de respuesta es de <strong>15 días hábiles</strong>.</li>
                    <li>Por protección de las víctimas, <strong>no verás el contenido de los reportes</strong>: solo se te informa cuántos existen.</li>
                    <li>El documento que adjuntes es una prueba de tu identidad: se guarda cifrado, solo lo ve el comité y se elimina automáticamente 30 días después de resolver tu caso.</li>
                </ul>
            </GlassCard>

            <GlassCard>
                <h2 className="text-lg font-semibold text-body">Radicar apelación</h2>
                <form onSubmit={enviar} className="mt-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor="apel-identificador" className="mb-1 block text-sm font-medium text-body">
                                Identificador (número, nick o perfil)
                            </label>
                            <input
                                id="apel-identificador"
                                type="text"
                                required
                                minLength={3}
                                maxLength={100}
                                value={identificador}
                                onChange={(e) => setIdentificador(e.target.value)}
                                className="glass-input w-full rounded-xl px-3 py-2 text-sm text-body"
                                placeholder="+573001234567"
                            />
                        </div>
                        <div>
                            <label htmlFor="apel-plataforma" className="mb-1 block text-sm font-medium text-body">
                                Plataforma
                            </label>
                            <select
                                id="apel-plataforma"
                                required
                                value={plataformaId}
                                onChange={(e) => setPlataformaId(e.target.value)}
                                className="glass-input w-full rounded-xl px-3 py-2 text-sm text-body"
                            >
                                <option value="">Selecciona una plataforma</option>
                                {plataformas.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="apel-motivo" className="mb-1 block text-sm font-medium text-body">
                            Motivo de la apelación
                        </label>
                        <textarea
                            id="apel-motivo"
                            required
                            minLength={10}
                            maxLength={4000}
                            rows={4}
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            className="glass-input w-full rounded-xl px-3 py-2 text-sm text-body"
                            placeholder="Explica por qué los reportes no te corresponden."
                        />
                    </div>

                    <label className="flex items-center gap-2 text-sm text-body">
                        <input
                            type="checkbox"
                            checked={esRepresentante}
                            onChange={(e) => setEsRepresentante(e.target.checked)}
                            className="h-4 w-4"
                        />
                        Apelo en nombre de otra persona (soy su representante)
                    </label>

                    {esRepresentante && (
                        <div>
                            <label htmlFor="apel-acreditacion" className="mb-1 block text-sm font-medium text-body">
                                Acreditación de la representación
                            </label>
                            <textarea
                                id="apel-acreditacion"
                                required={esRepresentante}
                                maxLength={4000}
                                rows={2}
                                value={acreditacion}
                                onChange={(e) => setAcreditacion(e.target.value)}
                                className="glass-input w-full rounded-xl px-3 py-2 text-sm text-body"
                                placeholder="Describe tu vínculo y cómo lo acreditas (p. ej. madre del titular, registro civil)."
                            />
                        </div>
                    )}

                    <div>
                        <label htmlFor="apel-documento" className="mb-1 block text-sm font-medium text-body">
                            Documento de evidencia (PDF, máximo 5 MB)
                        </label>
                        <input
                            id="apel-documento"
                            type="file"
                            accept="application/pdf"
                            required
                            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-semibold dark:border-slate-700"
                        />
                        <p className="mt-1 text-xs text-subtle">
                            Adjunta un documento sobre ti mismo (p. ej. certificado de titularidad de la línea). Nunca subas archivos sobre otra persona.
                        </p>
                    </div>

                    {mensaje && (
                        <Alerta tono={mensaje.type === "error" ? "error" : "exito"} className="p-4">
                            {mensaje.text}
                        </Alerta>
                    )}

                    <Button type="submit" isLoading={enviando} className="w-full sm:w-auto">
                        Radicar apelación
                    </Button>
                </form>
            </GlassCard>

            <section className="mt-8" aria-labelledby="mis-apelaciones-title">
                <h2 id="mis-apelaciones-title" className="text-lg font-semibold text-body mb-3">Mis apelaciones</h2>
                {cargando ? (
                    <div className="glass rounded-2xl p-8 text-center animate-pulse">
                        <Cargando texto="Cargando apelaciones..." />
                    </div>
                ) : items.length === 0 ? (
                    <EmptyState
                        title="No tienes apelaciones"
                        description="Cuando radices una apelación, aquí verás su estado y la respuesta del comité."
                    />
                ) : (
                    <div className="space-y-3">
                        {items.map((a) => (
                            <GlassCard key={a.id} className="p-4">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <p className="font-mono text-sm font-semibold text-body">{a.numero}</p>
                                        <p className="text-sm text-muted">
                                            {a.identificador} · {a.plataforma.nombre}
                                        </p>
                                    </div>
                                    <Badge variant={ESTADO_VARIANT[a.estado]}>{ESTADO_LABEL[a.estado]}</Badge>
                                </div>
                                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                                    <div>
                                        <dt className="text-subtle">Radicada</dt>
                                        <dd className="text-body">{formatFecha(a.creadoEn)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-subtle">Plazo de respuesta</dt>
                                        <dd className="text-body">{formatFecha(a.plazoRespuestaEn)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-subtle">Reportes asociados</dt>
                                        <dd className="text-body">{a.numeroReportesAsociados}</dd>
                                    </div>
                                </dl>
                                {(a.estado === "ACEPTADA" || a.estado === "RECHAZADA") && a.motivacionResolucion && (
                                    <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900/40">
                                        <p className="font-semibold text-body">
                                            Decisión del comité: {ESTADO_LABEL[a.estado]}
                                        </p>
                                        <p className="mt-1 text-muted">{a.motivacionResolucion}</p>
                                    </div>
                                )}
                                <p className="mt-2 text-xs text-subtle">
                                    Por protección de las víctimas no se muestra el contenido de los reportes, solo su número.
                                </p>
                            </GlassCard>
                        ))}
                    </div>
                )}
            </section>

            <CanalesOficiales />
        </main>
    );
}
