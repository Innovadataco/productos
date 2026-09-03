"use client";

/**
 * SPEC-408 · Ficha del Verificador — descargar documento, marcar CUMPLE/NO CUMPLE
 * por ítem, observación obligatoria si NO CUMPLE, aprobar bloqueado si hay uno
 * en NO CUMPLE. UI viva: entrada suave, hover, íconos SVG de trazo.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type EstadoItem = "PENDIENTE" | "CUMPLE" | "NO_CUMPLE";

interface Requisito {
    clave: string;
    nombre: string;
    descripcion: string;
}

interface Ficha {
    solicitudId: string;
    profesional: {
        id: string;
        nombreVisible: string;
        email: string;
        tituloProfesional: string;
        especialidades: string[];
        ciudadNombre: string;
        aniosExperiencia: number;
        presentacion: string;
        atiendeVirtual: boolean;
        atiendePresencial: boolean;
    };
    autorizacionArchivoUrl: string | null;
    requisitos: Requisito[];
    checklist: Record<string, { estado: EstadoItem; observacion: string }>;
    historial: Array<{
        id: string;
        resultado: "APROBADO" | "RECHAZADO" | "MAS_INFORMACION";
        revisadoPor: string;
        revisadoEn: string;
        notaInterna: string | null;
    }>;
}

function IconCheck({ className = "h-4 w-4" }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}
function IconX({ className = "h-4 w-4" }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}
function IconDownload({ className = "h-4 w-4" }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
    );
}

export function FichaVerificacionClient({ ficha }: { ficha: Ficha }) {
    const router = useRouter();
    const [checklist, setChecklist] = useState(() =>
        Object.fromEntries(
            ficha.requisitos.map((r) => [
                r.clave,
                ficha.checklist[r.clave] ?? { estado: "PENDIENTE" as EstadoItem, observacion: "" },
            ]),
        ),
    );
    const [enviando, setEnviando] = useState(false);
    const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

    const noCumple = useMemo(
        () => ficha.requisitos.filter((r) => checklist[r.clave]?.estado === "NO_CUMPLE"),
        [ficha.requisitos, checklist],
    );
    const todosDecididos = ficha.requisitos.every((r) => checklist[r.clave]?.estado !== "PENDIENTE");
    const observacionesCompletas = noCumple.every((r) => checklist[r.clave].observacion.trim().length > 0);
    const puedeAprobar = todosDecididos && noCumple.length === 0;
    const puedeDevolver = todosDecididos && noCumple.length > 0 && observacionesCompletas;

    function setEstado(clave: string, estado: EstadoItem) {
        setChecklist((prev) => ({ ...prev, [clave]: { ...prev[clave], estado } }));
    }
    function setObservacion(clave: string, observacion: string) {
        setChecklist((prev) => ({ ...prev, [clave]: { ...prev[clave], observacion } }));
    }

    async function enviarDecision() {
        setEnviando(true);
        setMensaje(null);
        try {
            const cuerpo = {
                checklist: Object.fromEntries(
                    ficha.requisitos.map((r) => {
                        const item = checklist[r.clave];
                        return [
                            r.clave,
                            item.estado === "CUMPLE"
                                ? { estado: "CUMPLE", observacion: "" }
                                : { estado: "NO_CUMPLE", observacion: item.observacion.trim() },
                        ];
                    }),
                ),
            };
            const res = await fetch(`/api/admin/verificacion-profesionales/${ficha.solicitudId}/decidir`, {
                method: "POST",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(cuerpo),
            });
            if (!res.ok) {
                const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
                throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
            }
            const json = (await res.json()) as { data: { resultado: "APROBADO" | "MAS_INFORMACION" } };
            setMensaje({
                tipo: "ok",
                texto:
                    json.data.resultado === "APROBADO"
                        ? "Perfil aprobado. El profesional recibió el aviso."
                        : "Devuelto al profesional con las observaciones. Le llegó el correo.",
            });
            setTimeout(() => router.push("/dashboard/admin/verificacion"), 1200);
        } catch (e) {
            setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : String(e) });
        } finally {
            setEnviando(false);
        }
    }

    return (
        <div className="space-y-6 anim-entrada">
            {/* Encabezado del profesional */}
            <section className="glass rounded-3xl p-6 sm:p-8">
                <p className="microetiqueta">Solicitud en revisión</p>
                <h1 className="titular-h1 mt-1">{ficha.profesional.nombreVisible}</h1>
                <p className="cuerpo text-subtle mt-1">
                    {ficha.profesional.tituloProfesional} · {ficha.profesional.ciudadNombre} ·
                    {" "}{ficha.profesional.aniosExperiencia} años de experiencia
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {ficha.profesional.especialidades.map((e) => (
                        <span key={e} className="rounded-full bg-tinta/5 px-3 py-1 text-xs text-body">
                            {e}
                        </span>
                    ))}
                    <span className="ml-auto font-mono text-xs text-subtle">{ficha.profesional.email}</span>
                </div>
                <p className="cuerpo mt-4 text-body">{ficha.profesional.presentacion}</p>
                {ficha.autorizacionArchivoUrl && (
                    <a
                        className="mt-4 inline-flex items-center gap-2 rounded-full bg-tinta/5 px-4 py-2 text-sm font-medium text-body hover:bg-tinta/10 transition"
                        href={ficha.autorizacionArchivoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <IconDownload />
                        Descargar autorización firmada
                    </a>
                )}
            </section>

            {/* Checklist */}
            <section aria-labelledby="checklist-titulo">
                <h2 id="checklist-titulo" className="titular-seccion">
                    Verificación por ítem
                </h2>
                <p className="cuerpo text-subtle mt-1">
                    Marcá cada requisito. Si algo <em className="palabra-estado">no cumple</em>, escribí qué corregir —
                    el profesional lo recibe tal cual.
                </p>
                <ul className="mt-4 space-y-3">
                    {ficha.requisitos.map((r, i) => {
                        const item = checklist[r.clave];
                        return (
                            <li
                                key={r.clave}
                                className="glass rounded-2xl p-5 anim-entrada"
                                style={{ animationDelay: `${100 + i * 60}ms` }}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="flex-1">
                                        <p className="font-semibold text-body">{r.nombre}</p>
                                        {r.descripcion && <p className="cuerpo text-subtle mt-1">{r.descripcion}</p>}
                                    </div>
                                    <div className="flex gap-2" role="radiogroup" aria-label={`Estado de ${r.nombre}`}>
                                        <button
                                            type="button"
                                            role="radio"
                                            aria-checked={item.estado === "CUMPLE"}
                                            onClick={() => setEstado(r.clave, "CUMPLE")}
                                            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                                                item.estado === "CUMPLE"
                                                    ? "bg-emerald-500/10 text-emerald-700 ring-2 ring-emerald-500/40 dark:text-emerald-300"
                                                    : "bg-tinta/5 text-subtle hover:bg-tinta/10 hover:text-body"
                                            }`}
                                        >
                                            <IconCheck />
                                            Cumple
                                        </button>
                                        <button
                                            type="button"
                                            role="radio"
                                            aria-checked={item.estado === "NO_CUMPLE"}
                                            onClick={() => setEstado(r.clave, "NO_CUMPLE")}
                                            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                                                item.estado === "NO_CUMPLE"
                                                    ? "bg-rose-500/10 text-rose-700 ring-2 ring-rose-500/40 dark:text-rose-300"
                                                    : "bg-tinta/5 text-subtle hover:bg-tinta/10 hover:text-body"
                                            }`}
                                        >
                                            <IconX />
                                            No cumple
                                        </button>
                                    </div>
                                </div>
                                {item.estado === "NO_CUMPLE" && (
                                    <div className="mt-3">
                                        <label className="microetiqueta block" htmlFor={`obs-${r.clave}`}>
                                            Observación · obligatoria
                                        </label>
                                        <textarea
                                            id={`obs-${r.clave}`}
                                            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-3 text-sm text-body focus:outline-none focus:ring-2 focus:ring-sky-500"
                                            rows={2}
                                            value={item.observacion}
                                            onChange={(e) => setObservacion(r.clave, e.target.value)}
                                            placeholder="Qué debe corregir el profesional. El texto se le muestra tal cual."
                                        />
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </section>

            {/* Historial (solo si hay algo) */}
            {ficha.historial.length > 0 && (
                <section aria-labelledby="historial-titulo">
                    <h2 id="historial-titulo" className="titular-seccion">Historial</h2>
                    <ul className="mt-3 space-y-2">
                        {ficha.historial.map((h) => (
                            <li key={h.id} className="rounded-xl bg-tinta/5 p-4 text-sm text-body">
                                <p className="flex items-center gap-2">
                                    <span className="font-mono text-xs text-subtle">
                                        {new Date(h.revisadoEn).toISOString().slice(0, 16).replace("T", " ")}
                                    </span>
                                    <span
                                        className={`font-semibold ${
                                            h.resultado === "APROBADO"
                                                ? "text-emerald-700 dark:text-emerald-300"
                                                : h.resultado === "MAS_INFORMACION"
                                                    ? "text-amber-700 dark:text-amber-300"
                                                    : "text-rose-700 dark:text-rose-300"
                                        }`}
                                    >
                                        {h.resultado === "MAS_INFORMACION" ? "DEVUELTO" : h.resultado}
                                    </span>
                                    <span className="text-subtle">— {h.revisadoPor}</span>
                                </p>
                                {h.notaInterna && <p className="mt-1 text-subtle">{h.notaInterna}</p>}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Acción */}
            <div className="glass sticky bottom-4 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <p className="cuerpo text-subtle">
                    {puedeAprobar
                        ? "Todo cumple — al aprobar el perfil pasa a activo."
                        : puedeDevolver
                            ? `${noCumple.length} ítem(s) por corregir — al enviar, el profesional recibe las observaciones por correo.`
                            : todosDecididos
                                ? "Faltan observaciones en algún ítem NO CUMPLE."
                                : "Marcá cada requisito antes de decidir."}
                </p>
                <button
                    type="button"
                    disabled={enviando || (!puedeAprobar && !puedeDevolver)}
                    onClick={enviarDecision}
                    className={`rounded-full px-6 py-2 text-sm font-semibold text-white transition ${
                        puedeAprobar
                            ? "bg-emerald-600 hover:bg-emerald-700"
                            : puedeDevolver
                                ? "bg-amber-600 hover:bg-amber-700"
                                : "bg-slate-400 cursor-not-allowed"
                    }`}
                >
                    {enviando ? "Enviando…" : puedeAprobar ? "Aprobar" : "Devolver con observaciones"}
                </button>
            </div>

            {mensaje && (
                <div
                    role="status"
                    className={`rounded-2xl p-4 anim-entrada ${
                        mensaje.tipo === "ok" ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" : "bg-rose-500/10 text-rose-800 dark:text-rose-200"
                    }`}
                >
                    {mensaje.texto}
                </div>
            )}
        </div>
    );
}
