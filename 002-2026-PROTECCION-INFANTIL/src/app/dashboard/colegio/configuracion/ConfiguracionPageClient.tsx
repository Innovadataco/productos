"use client";

import { EscudoColegioUploader } from "@/components/modules/colegio/casos/EscudoColegioUploader";
import { SkeletonDetalle } from "@/components/ui/skeletons";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassCard } from "@/components/ui/GlassCard";

/**
 * SPEC-149 (US4, FR-007) · rediseñada por SPEC-353 (A-69 · C6, FR-005..009) —
 * Configuración de avisos por email del colegio con el diseño A-62 del padre
 * (PreferenciasNotificaciones): frases humanas + Switch con guardado INMEDIATO
 * por fila (optimista, con reversión si falla), umbrales como frase con campos
 * embebidos que persisten al salir del campo, y cabecera "Le escribimos a
 * {correo}" con edición en línea del override. Voz de usted (Colombia);
 * ámbar único color de alerta. Contrato GET/PATCH intacto (FR-008).
 */

type TipoEvento = "REPORTE_NUEVO" | "UMBRAL_CURSO" | "ESTUDIANTE_REPETIDO" | "RESUMEN_SEMANAL";

interface Preferencia {
    tipoEvento: TipoEvento;
    habilitado: boolean;
    emailDestino: string | null;
    emailEfectivo: string | null;
    umbral: number | null;
    ventanaDias: number | null;
}

// SPEC-353 (R5): las 4 frases del catálogo, en usted.
const FRASES: Array<{ tipo: TipoEvento; titulo: string; detalle: string; conUmbral?: boolean }> = [
    {
        tipo: "REPORTE_NUEVO",
        titulo: "Cuando alguien reporte una cuenta de su comunidad",
        detalle: "Le avisamos el mismo día en que llegue un reporte nuevo sobre su colegio.",
    },
    {
        tipo: "UMBRAL_CURSO",
        titulo: "Cuando un curso acumule varios reportes en pocos días",
        detalle: "Le avisamos si un mismo curso concentra la actividad.",
        conUmbral: true,
    },
    {
        tipo: "ESTUDIANTE_REPETIDO",
        titulo: "Cuando un mismo estudiante vuelva a aparecer",
        detalle: "Le avisamos si un estudiante acumula reportes, aunque sea en perfiles distintos.",
        conUmbral: true,
    },
    {
        tipo: "RESUMEN_SEMANAL",
        titulo: "Un resumen de su colegio cada semana",
        detalle: "Cada lunes por la mañana. Si fue una semana tranquila, también se lo contamos.",
    },
];

interface FilaUmbral {
    umbral: string;
    ventanaDias: string;
}

export default function ConfiguracionPageClient() {
    const [emailPorDefecto, setEmailPorDefecto] = useState("");
    const [prefs, setPrefs] = useState<Record<TipoEvento, Preferencia> | null>(null);
    const [umbrales, setUmbrales] = useState<Record<TipoEvento, FilaUmbral>>({} as Record<TipoEvento, FilaUmbral>);
    const [loading, setLoading] = useState(true);
    const [errorCarga, setErrorCarga] = useState("");
    const [aviso, setAviso] = useState("");
    const [guardando, setGuardando] = useState<Set<string>>(new Set());
    const [editandoCorreo, setEditandoCorreo] = useState(false);
    const [correoBorrador, setCorreoBorrador] = useState("");

    const cargar = useCallback(async () => {
        setLoading(true);
        setErrorCarga("");
        try {
            const res = await fetch("/api/colegio/preferencias-avisos", { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setEmailPorDefecto(data.emailPorDefecto || "");
                const nuevos = {} as Record<TipoEvento, Preferencia>;
                const filas = {} as Record<TipoEvento, FilaUmbral>;
                for (const item of (data.items || []) as Preferencia[]) {
                    nuevos[item.tipoEvento] = item;
                    filas[item.tipoEvento] = {
                        umbral: item.umbral ? String(item.umbral) : "",
                        ventanaDias: item.ventanaDias ? String(item.ventanaDias) : "",
                    };
                }
                setPrefs(nuevos);
                setUmbrales(filas);
            } else {
                setErrorCarga(data?.error?.message || "Error cargando la configuración");
            }
        } catch {
            setErrorCarga("Error de red cargando la configuración");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    async function patch(body: Record<string, unknown>): Promise<void> {
        const res = await fetch("/api/colegio/preferencias-avisos", {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.error?.message || "No pudimos guardar el aviso");
        }
    }

    function marcarGuardando(clave: string, activo: boolean) {
        setGuardando((prev) => {
            const next = new Set(prev);
            if (activo) next.add(clave);
            else next.delete(clave);
            return next;
        });
    }

    // FR-005: Switch → PATCH inmediato, optimista, con reversión si falla.
    async function cambiarHabilitado(tipo: TipoEvento, habilitado: boolean) {
        if (!prefs) return;
        const anterior = prefs[tipo];
        setAviso("");
        setPrefs({ ...prefs, [tipo]: { ...anterior, habilitado } });
        marcarGuardando(tipo, true);
        try {
            await patch({ tipoEvento: tipo, habilitado });
        } catch (err) {
            setPrefs((prev) => (prev ? { ...prev, [tipo]: anterior } : prev));
            setAviso(err instanceof Error ? err.message : "No pudimos guardar el aviso");
        } finally {
            marcarGuardando(tipo, false);
        }
    }

    // FR-006: los umbrales persisten al salir del campo (blur), sin botón.
    async function guardarUmbral(tipo: TipoEvento) {
        if (!prefs) return;
        const fila = umbrales[tipo];
        const umbral = parseInt(fila?.umbral ?? "", 10);
        const ventanaDias = parseInt(fila?.ventanaDias ?? "", 10);
        const body = {
            tipoEvento: tipo,
            umbral: Number.isNaN(umbral) ? null : umbral,
            ventanaDias: Number.isNaN(ventanaDias) ? null : ventanaDias,
        };
        const anterior = prefs[tipo];
        if (body.umbral === anterior.umbral && body.ventanaDias === anterior.ventanaDias) return;
        setAviso("");
        marcarGuardando(`${tipo}:umbral`, true);
        try {
            await patch(body);
            setPrefs((prev) =>
                prev ? { ...prev, [tipo]: { ...prev[tipo], umbral: body.umbral, ventanaDias: body.ventanaDias } } : prev,
            );
        } catch (err) {
            setUmbrales((prev) => ({
                ...prev,
                [tipo]: {
                    umbral: anterior.umbral ? String(anterior.umbral) : "",
                    ventanaDias: anterior.ventanaDias ? String(anterior.ventanaDias) : "",
                },
            }));
            setAviso(err instanceof Error ? err.message : "No pudimos guardar el umbral");
        } finally {
            marcarGuardando(`${tipo}:umbral`, false);
        }
    }

    // FR-007: el override de correo es UNO para los 4 avisos (el contrato lo
    // guarda por tipo; la pantalla lo aplica parejo — vacío = correo del rector).
    const overrideActual = prefs ? (prefs.REPORTE_NUEVO?.emailDestino ?? "") : "";
    const correoEfectivo = overrideActual || emailPorDefecto || "su correo de acceso";

    async function guardarCorreo() {
        if (!prefs) return;
        setEditandoCorreo(false);
        const nuevo = correoBorrador.trim() || null;
        if ((nuevo ?? "") === overrideActual) return;
        setAviso("");
        marcarGuardando("correo", true);
        try {
            await Promise.all(FRASES.map((f) => patch({ tipoEvento: f.tipo, emailDestino: nuevo })));
            setPrefs((prev) => {
                if (!prev) return prev;
                const next = { ...prev };
                for (const f of FRASES) next[f.tipo] = { ...next[f.tipo], emailDestino: nuevo };
                return next;
            });
        } catch (err) {
            setAviso(err instanceof Error ? err.message : "No pudimos cambiar el correo");
        } finally {
            marcarGuardando("correo", false);
        }
    }

    return (
        <div className="min-h-screen bg-page">
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-3xl space-y-6">
                    <div>
                        <h1 className="text-2xl font-bold text-body">Configuración</h1>
                        <p className="text-sm text-muted">
                            Elija qué avisos le enviamos por email. Le avisamos pocas veces al día; si hay más
                            novedades, llegan en el resumen semanal.
                        </p>
                    </div>

                    {aviso && (
                        <p className="rounded-xl border border-ambar/40 bg-ambar/10 px-4 py-3 text-sm text-ambar" role="alert">
                            {aviso}
                        </p>
                    )}

                    {/* SPEC-351 (A-69 · D1): escudo institucional para el membrete de informes. */}
                    <EscudoColegioUploader />

                    {loading ? (
                        <SkeletonDetalle />
                    ) : errorCarga ? (
                        <ErrorState title="No pudimos cargar la configuración" description={errorCarga} onRetry={() => void cargar()} />
                    ) : prefs ? (
                        <>
                            {/* Cabecera: a dónde escribimos (FR-007) */}
                            <GlassCard className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                    <Mail className="h-4 w-4 text-muted" aria-hidden="true" />
                                    {editandoCorreo ? (
                                        <input
                                            type="email"
                                            autoFocus
                                            defaultValue={overrideActual}
                                            placeholder={emailPorDefecto || "correo@colegio.edu.co"}
                                            aria-label="Correo de destino de los avisos"
                                            className="rounded-lg border border-tinta/20 bg-transparent px-3 py-1.5 text-sm text-body"
                                            onChange={(e) => setCorreoBorrador(e.target.value)}
                                            onBlur={() => void guardarCorreo()}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                            }}
                                        />
                                    ) : (
                                        <p className="text-sm text-body">
                                            Le escribimos a <span className="font-semibold">{correoEfectivo}</span>
                                        </p>
                                    )}
                                </div>
                                {guardando.has("correo") ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden="true" />
                                ) : (
                                    !editandoCorreo && (
                                        <button
                                            type="button"
                                            className="text-sm font-semibold text-accent hover:underline"
                                            onClick={() => {
                                                setCorreoBorrador(overrideActual);
                                                setEditandoCorreo(true);
                                            }}
                                        >
                                            Cambiar
                                        </button>
                                    )
                                )}
                            </GlassCard>

                            {/* Las 4 frases con Switch (FR-005) y umbrales como frase (FR-006) */}
                            <GlassCard>
                                <h2 className="text-base font-semibold text-body">¿De qué le avisamos?</h2>
                                <div className="mt-4 space-y-5">
                                    {FRASES.map((f) => {
                                        const pref = prefs[f.tipo];
                                        const fila = umbrales[f.tipo];
                                        return (
                                            <div key={f.tipo} data-testid={`aviso-${f.tipo}`}>
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <p className="text-sm font-medium text-body">{f.titulo}</p>
                                                        <p className="mt-0.5 text-sm text-muted">{f.detalle}</p>
                                                    </div>
                                                    {guardando.has(f.tipo) ? (
                                                        <Loader2 className="mt-1 h-5 w-5 animate-spin text-muted" aria-hidden="true" />
                                                    ) : (
                                                        <Switch
                                                            checked={pref?.habilitado ?? false}
                                                            onChange={(v) => void cambiarHabilitado(f.tipo, v)}
                                                            ariaLabel={f.titulo}
                                                        />
                                                    )}
                                                </div>
                                                {f.conUmbral && pref?.habilitado && (
                                                    <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                                                        Avisar a partir de
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={100}
                                                            value={fila?.umbral ?? ""}
                                                            placeholder={String(pref.umbral ?? "")}
                                                            aria-label={`Umbral de reportes para ${f.titulo}`}
                                                            className="w-14 rounded-lg border border-tinta/20 bg-transparent px-2 py-1 text-center text-body"
                                                            onChange={(e) =>
                                                                setUmbrales((prev) => ({
                                                                    ...prev,
                                                                    [f.tipo]: { ...prev[f.tipo], umbral: e.target.value },
                                                                }))
                                                            }
                                                            onBlur={() => void guardarUmbral(f.tipo)}
                                                        />
                                                        reportes en
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={90}
                                                            value={fila?.ventanaDias ?? ""}
                                                            placeholder={String(pref.ventanaDias ?? "")}
                                                            aria-label={`Ventana de días para ${f.titulo}`}
                                                            className="w-14 rounded-lg border border-tinta/20 bg-transparent px-2 py-1 text-center text-body"
                                                            onChange={(e) =>
                                                                setUmbrales((prev) => ({
                                                                    ...prev,
                                                                    [f.tipo]: { ...prev[f.tipo], ventanaDias: e.target.value },
                                                                }))
                                                            }
                                                            onBlur={() => void guardarUmbral(f.tipo)}
                                                        />
                                                        días
                                                        {guardando.has(`${f.tipo}:umbral`) && (
                                                            <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden="true" />
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </GlassCard>
                        </>
                    ) : null}
                </div>
            </main>
        </div>
    );
}
