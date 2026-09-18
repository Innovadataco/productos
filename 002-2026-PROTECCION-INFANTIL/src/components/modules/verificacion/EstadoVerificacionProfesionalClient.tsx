"use client";

/**
 * SPEC-408 + SPEC-691 · Estado de verificación del profesional: según cuál sea, qué puede hacer.
 * No ve `resultado` ni checklist estructurado — solo la observación escrita por el Verificador.
 *
 * SPEC-706 (PR B): este componente ya NO es una pantalla propia («Mi estado» / `/perfil-profesional/
 * verificacion` se retiró). Se REUBICA como ENCABEZADO de la ficha (una sola pantalla) y es
 * DISPLAY-ONLY: el envío a revisión se movió a la ficha (un solo camino, el PUT del perfil, que
 * valida y nombra lo que falta — SPEC-706 PR A). Acá solo se muestran estado + copy + observaciones.
 *
 * SPEC-691 (forma de Diseño, FORMA-SPEC691 · 13-09): cada estado tiene su copy. NUNCA rubí — el
 * rojo se reserva a la criticidad de protección de un menor (D-120); estos son estados de CUENTA.
 * VENCIDO/RECHAZADO van en ámbar (piden su acción); SUSPENDIDO en tinta neutra. Color + rótulo
 * SIEMPRE (WCAG 1.4.1). SUSPENDIDO: copy verbatim de Diseño (Gestión 17c375e/8d9ecf2). RECHAZADO
 * no se produce (el ciclo devuelve MAS_INFORMACION → BORRADOR); defensivo, sin nada operativo.
 */

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
    // SPEC-691 (ajuste del CEO): la pantalla se decide por `habilitado`, no solo por
    // `estado`. ACTIVO con la vigencia vencida pero el worker sin correr (habilitado=false) se
    // MUESTRA como VENCIDO — si no, diría «activo» a quien no puede operar.
    const estadoMostrado: Vista["estadoPerfil"] =
        vista.estadoPerfil === "ACTIVO" && !habilitado ? "VENCIDO" : vista.estadoPerfil;
    const insignia = INSIGNIA[estadoMostrado];

    return (
        <div className="space-y-6 anim-entrada">
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
                    {/* SPEC-706 (PR A · texto de Diseño, Gestión e69b591): el resultado llega por
                        CORREO (el verificador envía email al decidir) y se dice el bloqueo — la ficha
                        no se puede cambiar mientras está en revisión (lo aplica el servidor en el PUT). */}
                    <p className="cuerpo text-body">
                        Su solicitud quedó en revisión. El resultado le llegará por correo — esté atento a su
                        bandeja. Mientras la revisamos, su ficha no se puede cambiar.
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

            {/* SPEC-706 (PR B): el envío se movió a la ficha (botón «Guardar y enviar a revisión», que
                valida y nombra lo que falta). Este encabezado es DISPLAY-ONLY; `vista.puedeReenviar`
                ya no pinta un botón acá. La ficha, debajo, vuelve a ser editable cuando es su turno. */}
        </div>
    );
}
