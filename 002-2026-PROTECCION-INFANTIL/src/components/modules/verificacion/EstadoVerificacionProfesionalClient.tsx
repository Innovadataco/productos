"use client";

/**
 * SPEC-408 · El profesional ve su estado y las observaciones (si las hay) para
 * corregir y reenviar. No ve `resultado` ni checklist estructurado — solo la
 * observación escrita por el Verificador, tal cual.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Vista {
    estadoPerfil: "BORRADOR" | "EN_REVISION" | "ACTIVO" | "RECHAZADO" | "VENCIDO" | "SUSPENDIDO";
    puedeReenviar: boolean;
    observaciones: Array<{ requisito: string; observacion: string }>;
}

const ETIQUETA: Record<Vista["estadoPerfil"], { label: string; tono: string }> = {
    BORRADOR: { label: "en corrección", tono: "text-estado-ambar" },
    EN_REVISION: { label: "en revisión", tono: "text-estado-ambar" },
    ACTIVO: { label: "activo", tono: "text-estado-pino" },
    RECHAZADO: { label: "rechazado", tono: "text-estado-rubi" },
    VENCIDO: { label: "vencido", tono: "text-estado-rubi" },
    SUSPENDIDO: { label: "suspendido", tono: "text-estado-rubi" },
};

export function EstadoVerificacionProfesionalClient({ vista }: { vista: Vista }) {
    const router = useRouter();
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const et = ETIQUETA[vista.estadoPerfil];

    async function reenviar() {
        setEnviando(true);
        setError(null);
        try {
            const res = await fetch("/api/profesional/verificacion/reenviar", {
                method: "POST",
                credentials: "include",
            });
            if (!res.ok) {
                const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
                throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
            }
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setEnviando(false);
        }
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6 anim-entrada">
            <header>
                <p className="microetiqueta">Verificación de tu perfil</p>
                <h1 className="titular-h1 mt-1">
                    Tu perfil está <span className={`palabra-estado ${et.tono}`}>{et.label}</span>
                </h1>
            </header>

            {vista.estadoPerfil === "EN_REVISION" && (
                <div className="glass rounded-2xl p-6">
                    <p className="cuerpo text-body">
                        Ya estamos revisando tus documentos. Te avisamos por correo apenas haya novedad — no hace
                        falta que hagas nada.
                    </p>
                </div>
            )}

            {vista.estadoPerfil === "ACTIVO" && (
                <div className="glass rounded-2xl p-6">
                    <p className="cuerpo text-body">
                        Su perfil quedó activo. Ahora puede cargar su carta de presentación, su disponibilidad y
                        aparecer en el directorio de familias.
                    </p>
                </div>
            )}

            {vista.observaciones.length > 0 && (
                <section aria-labelledby="obs-titulo">
                    <h2 id="obs-titulo" className="titular-seccion">Qué corregir</h2>
                    <ul className="mt-3 space-y-3">
                        {vista.observaciones.map((o, i) => (
                            <li
                                key={i}
                                className="glass rounded-2xl p-5 anim-entrada"
                                style={{ animationDelay: `${i * 60}ms` }}
                            >
                                <p className="font-semibold text-body">{o.requisito}</p>
                                <p className="cuerpo text-subtle mt-1">{o.observacion}</p>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {vista.puedeReenviar && (
                <div className="glass rounded-2xl p-6">
                    <p className="cuerpo text-body">
                        Cuando termine de corregir, reenvíe su perfil para que lo revisemos otra vez.
                    </p>
                    <button
                        type="button"
                        disabled={enviando}
                        onClick={reenviar}
                        className="mt-4 rounded-full bg-pino px-6 py-2 text-sm font-semibold text-white transition hover:bg-pino/90 disabled:cursor-not-allowed disabled:bg-tinta/30"
                    >
                        {enviando ? "Enviando…" : "Reenviar para verificación"}
                    </button>
                    {error && <p className="mt-2 text-sm text-estado-rubi">{error}</p>}
                </div>
            )}
        </div>
    );
}
