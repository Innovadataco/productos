"use client";

/**
 * SPEC-408 + SPEC-691 · «Mi estado»: el profesional ve su estado de verificación y,
 * según cuál sea, qué puede hacer. No ve `resultado` ni checklist estructurado — solo
 * la observación escrita por el Verificador, tal cual.
 *
 * SPEC-691 (forma de Diseño, FORMA-SPEC691 · 13-09): cada estado tiene su pantalla.
 * NUNCA rubí — el rojo se reserva a la criticidad de protección de un menor (D-120);
 * estos son estados de CUENTA. VENCIDO y RECHAZADO van en ámbar (piden su acción);
 * SUSPENDIDO en tinta neutra (no hay acción que él pueda tomar). Color + rótulo
 * SIEMPRE (WCAG 1.4.1), nunca color solo.
 *
 * Ajustes medidos por el CEO sobre la forma:
 *  · RECHAZADO no se produce nunca (el ciclo devuelve MAS_INFORMACION, no rechaza —
 *    verificador/service.ts). Se maneja a la DEFENSIVA: sin nada operativo, sin
 *    recorrido propio.
 *  · SUSPENDIDO: copy aprobada por Diseño (Gestión 17c375e/8d9ecf2), verbatim — la
 *    causa como hecho (tres citas vencidas sin respuesta), sin culpar al profesional
 *    (no le avisamos), y la salida real (el equipo lo levanta vía contacto). Insignia
 *    neutra, solo lectura, sin reenviar. La acción del administrador va en SPEC-692.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Vista {
    estadoPerfil: "BORRADOR" | "EN_REVISION" | "ACTIVO" | "RECHAZADO" | "VENCIDO" | "SUSPENDIDO";
    puedeReenviar: boolean;
    observaciones: Array<{ requisito: string; observacion: string }>;
}

/** Canal real para suspensión (mockup Momento 1-bis · Gestión 8e5e800). */
const CONTACTO_SUSPENSION = "gerencia@innovadataco.com";

/**
 * Insignia por estado. Ámbar = necesita su acción; pino = todo bien; tinta neutra =
 * no lo resuelve él. NUNCA rubí (D-120). El texto de la insignia acompaña al color.
 */
const INSIGNIA: Record<Vista["estadoPerfil"], { texto: string; clase: string }> = {
    BORRADOR: { texto: "En corrección", clase: "bg-ambar/10 text-estado-ambar" },
    EN_REVISION: { texto: "En revisión", clase: "bg-ambar/10 text-estado-ambar" },
    ACTIVO: { texto: "Activa", clase: "bg-pino/10 text-estado-pino" },
    VENCIDO: { texto: "Vencida", clase: "bg-ambar/10 text-estado-ambar" },
    RECHAZADO: { texto: "No aprobada", clase: "bg-ambar/10 text-estado-ambar" },
    SUSPENDIDO: { texto: "Suspendida", clase: "bg-tinta/10 text-body dark:bg-tinta/20" },
};

const TITULO: Record<Vista["estadoPerfil"], string> = {
    BORRADOR: "Termine su registro",
    EN_REVISION: "Su perfil está en revisión",
    ACTIVO: "Su perfil está activo",
    VENCIDO: "Su verificación venció.",
    RECHAZADO: "Su solicitud no fue aprobada.",
    SUSPENDIDO: "Su perfil profesional está suspendido",
};

export function EstadoVerificacionProfesionalClient({ vista, habilitado }: { vista: Vista; habilitado: boolean }) {
    const router = useRouter();
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // SPEC-691 (ajuste del CEO): la pantalla se decide por `habilitado`, no solo por
    // `estado`. ACTIVO con la vigencia vencida pero el worker sin correr
    // (habilitado=false) se MUESTRA como VENCIDO — si no, diría «activo» a quien no
    // puede operar. El resto de los estados se muestran tal cual.
    const estadoMostrado: Vista["estadoPerfil"] =
        vista.estadoPerfil === "ACTIVO" && !habilitado ? "VENCIDO" : vista.estadoPerfil;
    const insignia = INSIGNIA[estadoMostrado];

    async function reenviar() {
        setEnviando(true);
        setError(null);
        try {
            const res = await fetch("/api/profesional/verificacion/reenviar", {
                method: "POST",
                credentials: "include",
            });
            if (!res.ok) {
                // I-410: el mensaje del servidor, no «HTTP NNN».
                const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
                throw new Error(j?.error?.message ?? `El servidor respondió con un error (HTTP ${res.status}).`);
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
            <header className="space-y-2">
                <p className="microetiqueta">Verificación de su perfil</p>
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="titular-h1">{TITULO[estadoMostrado]}</h1>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${insignia.clase}`}>
                        {insignia.texto}
                    </span>
                </div>
            </header>

            {estadoMostrado === "EN_REVISION" && (
                <div className="glass rounded-2xl p-6">
                    <p className="cuerpo text-body">
                        Ya estamos revisando sus documentos. Le avisamos apenas haya novedad — no hace falta que
                        haga nada.
                    </p>
                </div>
            )}

            {estadoMostrado === "ACTIVO" && (
                <div className="glass rounded-2xl p-6">
                    <p className="cuerpo text-body">
                        Su perfil quedó activo. Ahora puede cargar su carta de presentación, su disponibilidad y
                        aparecer en el directorio de familias.
                    </p>
                </div>
            )}

            {estadoMostrado === "VENCIDO" && (
                <div className="glass rounded-2xl p-6 space-y-2">
                    <p className="cuerpo text-body">
                        La vigencia de su verificación se cumplió. Para volver a atender, envíela de nuevo a revisión.
                    </p>
                    <p className="cuerpo text-subtle">
                        Mientras se revisa, su perfil no aparece para las familias.
                    </p>
                </div>
            )}

            {estadoMostrado === "SUSPENDIDO" && (
                <div className="glass rounded-2xl p-6 space-y-3">
                    {/* SPEC-691 · copy aprobada por Diseño (Gestión 17c375e/8d9ecf2), verbatim:
                        la causa como HECHO, sin culpar al profesional (no le avisamos), y la
                        salida real (el equipo lo levanta). Solo lectura, sin reenviar. */}
                    <p className="cuerpo text-body">
                        Tres solicitudes de cita seguidas vencieron sin respuesta. Cuando llegaron esas solicitudes
                        no le enviamos ningún aviso, así que es muy probable que no las haya visto — no fue un
                        descuido suyo.
                    </p>
                    <p className="cuerpo text-subtle">
                        Para reactivar su perfil, escríbanos a{" "}
                        <a href={`mailto:${CONTACTO_SUSPENSION}`} className="font-medium text-accent hover:underline">
                            {CONTACTO_SUSPENSION}
                        </a>{" "}
                        y el equipo lo levanta.
                    </p>
                </div>
            )}

            {estadoMostrado === "RECHAZADO" && (
                // Defensivo: este estado no se produce (el ciclo devuelve, no rechaza).
                // Sin recorrido propio ni nada operativo; si Diseño manda forma, entra acá.
                <div className="glass rounded-2xl p-6">
                    <p className="cuerpo text-body">
                        Su solicitud no está aprobada. Revise las observaciones y vuelva a enviarla cuando las haya
                        corregido.
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
                        Cuando termine de corregir, envíe su perfil a revisión otra vez.
                    </p>
                    <button
                        type="button"
                        disabled={enviando}
                        onClick={reenviar}
                        className="mt-4 rounded-full bg-pino px-6 py-2 text-sm font-semibold text-white transition hover:bg-pino/90 disabled:cursor-not-allowed disabled:bg-tinta/30"
                    >
                        {enviando ? "Enviando…" : "Enviar a revisión"}
                    </button>
                    {error && <p className="mt-2 text-sm text-estado-rubi">{error}</p>}
                </div>
            )}
        </div>
    );
}
