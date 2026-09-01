"use client";

/**
 * SPEC-351 (T034+T035) — generar informe firmado + historial inmutable.
 * Voz USTED. Un solo componente con las dos piezas para no fragmentar
 * el detalle del caso.
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

interface InformeVista {
    id: string;
    correlativo: string;
    generadoEn: string;
    firmadoPorNombre: string;
    codigoVerificacion: string;
}

const SECCIONES: Array<{ clave: string; label: string; porDefecto: boolean }> = [
    { clave: "hechos", label: "Hechos del caso", porDefecto: true },
    { clave: "actuacion", label: "Actuación del colegio (bitácora)", porDefecto: true },
    { clave: "analisis_comite", label: "Análisis del comité (si existió)", porDefecto: true },
    { clave: "contexto_curso", label: "Contexto del curso", porDefecto: false },
];

const fmtFecha = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota",
});

export function InformesCasoPanel({ casoId }: { casoId: string }) {
    const [informes, setInformes] = useState<InformeVista[]>([]);
    const [seleccion, setSeleccion] = useState<Set<string>>(
        new Set(SECCIONES.filter((s) => s.porDefecto).map((s) => s.clave))
    );
    const [generando, setGenerando] = useState(false);
    const [mensaje, setMensaje] = useState("");

    const cargar = useCallback(async () => {
        try {
            const res = await fetch(`/api/colegio/casos/${casoId}/informes`, { credentials: "include" });
            if (!res.ok) return;
            const body = await res.json();
            setInformes(body.informes ?? []);
        } catch {
            // silencioso: el historial vacío ya comunica
        }
    }, [casoId]);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    const alternar = (clave: string) => {
        setSeleccion((prev) => {
            const s = new Set(prev);
            if (s.has(clave)) s.delete(clave);
            else s.add(clave);
            return s;
        });
    };

    const generar = useCallback(async () => {
        setGenerando(true);
        setMensaje("");
        try {
            const res = await fetch(`/api/colegio/casos/${casoId}/informes`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ secciones: [...seleccion] }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error?.message ?? "No pudimos generar el informe.");
            }
            // Descargar el PDF directamente de la respuesta.
            const blob = await res.blob();
            const correlativo = res.headers.get("X-Informe-Correlativo") ?? "informe";
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${correlativo}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            if (res.headers.get("X-Aviso-Escudo") === "sin-escudo") {
                setMensaje("Informe generado. Cargue el escudo del colegio en Configuración para membretar sus informes.");
            } else {
                setMensaje(`Informe ${correlativo} generado y descargado.`);
            }
            await cargar();
        } catch (err) {
            setMensaje(err instanceof Error ? err.message : "No pudimos generar el informe.");
        } finally {
            setGenerando(false);
        }
    }, [casoId, seleccion, cargar]);

    return (
        <section className="rounded-2xl border border-tinta/10 bg-papel/60 p-4 dark:border-papel/10 dark:bg-tinta/40">
            <h2 className="font-medium text-body">Informe firmado</h2>
            <p className="mt-1 text-sm text-muted">
                Genere un documento membretado con los hechos y la actuación del colegio,
                firmado por usted y verificable públicamente por su código.
            </p>

            <fieldset className="mt-3 space-y-2">
                <legend className="text-xs uppercase tracking-wide text-subtle">Secciones del informe</legend>
                {SECCIONES.map((s) => (
                    <label key={s.clave} className="flex items-center gap-2 text-sm text-body">
                        <input
                            type="checkbox"
                            checked={seleccion.has(s.clave)}
                            onChange={() => alternar(s.clave)}
                            className="accent-pino"
                        />
                        {s.label}
                    </label>
                ))}
            </fieldset>

            <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button onClick={generar} disabled={generando || seleccion.size === 0}>
                    {generando ? "Generando…" : "Generar informe"}
                </Button>
                {mensaje && <span className="text-xs text-muted">{mensaje}</span>}
            </div>

            {/* ── Historial inmutable ── */}
            <div className="mt-6">
                <h3 className="text-sm font-medium text-body">Informes generados</h3>
                {informes.length === 0 ? (
                    <p className="mt-1 text-sm text-muted">Aún no se han generado informes de este caso.</p>
                ) : (
                    <ul className="mt-2 space-y-2">
                        {informes.map((i) => (
                            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-papel/80 p-3 text-sm dark:bg-tinta/60">
                                <span>
                                    <strong>{i.correlativo}</strong>
                                    {" · "}
                                    {fmtFecha.format(new Date(i.generadoEn))}
                                    {" · "}
                                    <span className="text-muted">firmado por {i.firmadoPorNombre}</span>
                                </span>
                                <span className="font-mono text-xs text-muted" title="Código de verificación pública">
                                    {i.codigoVerificacion}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
                {informes.length > 0 && (
                    <p className="mt-2 text-xs text-muted">
                        El historial es permanente: los informes no se editan ni se eliminan.
                        Si necesita corregir algo, genere un informe nuevo.
                    </p>
                )}
            </div>
        </section>
    );
}
