"use client";
/**
 * SPEC-784 · Formulario de la encuesta de servicio de la cita — opciones CERRADAS, sobre el modelo
 * tipado de 753. Copy y forma de Diseño (`d682cdb`). Voz tú (padre) / usted (profesional).
 *
 * FR-3 · el CHECK VALIDADO se ejercita DESDE la pantalla (imposibilidad estructural, no validación de
 * mensaje): la P1 gobierna qué se RENDERIZA. Si se realizó → aparece la duración y NO la razón; si no
 * se realizó → aparece la razón y NO la duración. La duración DESAPARECE (no un «N/A»): ninguno de sus
 * rangos puede decir honestamente «no hubo sesión». Q3/Q4/Q5 aparecen siempre. Así la UI NUNCA puede
 * enviar la combinación que la base rechaza.
 *
 * FR-5 · CERO texto libre: todo es `radio`; «Otra razón» es una opción cerrada, no abre campo. Ninguna
 * pregunta pide contenido de la sesión (es sobre un menor: qué pasó mecánicamente, nunca qué se habló).
 */
import { useState } from "react";
import {
    PREGUNTAS_SERVICIO,
    RAZONES_NO_REALIZO,
    RAZON_NO_REALIZO_ENUNCIADO,
    labelOpcion,
    type Audiencia,
    type ClavePregunta,
    type DefinicionPregunta,
    type OpcionPregunta,
} from "@/lib/profesional/cita/encuestas-preguntas";

const CORREO_SOPORTE = "gerencia@innovadataco.com";

/** Copy que varía por AUDIENCIA (voz + desenlace). NO es copy por-pregunta: vive en el form. */
const COPY: Record<Audiencia, { intro: (fecha: string) => string; subtitulo: string; enviar: string; gracias: string; panel: string }> = {
    PADRE: {
        intro: (fecha) => `Cuéntanos cómo te fue en tu cita del ${fecha}.`,
        subtitulo: "Es un minuto y nos ayuda a cuidar el servicio.",
        enviar: "Contar cómo me fue",
        // SPEC-792 C3: cierre CÁLIDO del padre (espeja su intro «Cuéntanos cómo te fue»; no presume que
        // estuvo excelente). NO «quedó registrado» (voz de archivador, la del profesional).
        gracias: "Gracias por contarnos cómo te fue. Nos ayuda a cuidar el servicio.",
        panel: "/dashboard",
    },
    PROFESIONAL: {
        intro: () => "Registre cómo fue la sesión.",
        subtitulo: "Su registro nos ayuda a cuidar el servicio de esta cita.",
        enviar: "Registrar",
        // El registro del profesional es un log; su voz es sobria. Se queda como está.
        gracias: "Gracias, quedó registrado.",
        panel: "/dashboard/profesional", // = homeParaRol("PROFESIONAL")
    },
};

interface Props {
    solicitudId: string;
    origen: Audiencia;
    /** Fecha de la cita, ya formateada para pantalla. */
    fecha: string;
}

const preguntaDef = (clave: ClavePregunta): DefinicionPregunta =>
    PREGUNTAS_SERVICIO.find((p) => p.pregunta === clave)!;

export function EncuestaFormulario({ solicitudId, origen, fecha }: Props) {
    const copy = COPY[origen];
    const [valores, setValores] = useState<Partial<Record<string, string>>>({});
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hecho, setHecho] = useState<null | { seRealizo: boolean }>(null);

    const set = (clave: string, key: string) => setValores((v) => ({ ...v, [clave]: key }));

    const seRealizo = valores.SE_REALIZO === undefined ? null : valores.SE_REALIZO === "SI";
    const completa =
        seRealizo !== null &&
        Boolean(valores.OPERADOR && valores.INICIO && valores.ENLACE) &&
        (seRealizo ? Boolean(valores.DURACION) : Boolean(valores.RAZON));

    async function enviar() {
        if (!completa || seRealizo === null) return;
        setEnviando(true);
        setError(null);
        try {
            const res = await fetch("/api/encuesta", {
                method: "POST",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    solicitudId,
                    seRealizo,
                    operador: valores.OPERADOR,
                    inicio: valores.INICIO,
                    enlace: valores.ENLACE,
                    ...(seRealizo ? { duracion: valores.DURACION } : { razonNoRealizo: valores.RAZON }),
                }),
            });
            const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
            if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
            setHecho({ seRealizo });
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setEnviando(false);
        }
    }

    // Desenlace. El padre que dice «no se realizó» recibe acuse + SALIDA (pagó y le importa); el
    // profesional, registro neutro. (FORMA-SPEC784 §3 / FORMA-ENCUESTA-PRIMERA-CITA §6.)
    if (hecho) {
        const padreNoRealizada = origen === "PADRE" && !hecho.seRealizo;
        return (
            <section className="mx-auto max-w-2xl p-4 sm:p-6 space-y-4 anim-entrada">
                <div className="glass rounded-2xl p-5 space-y-3">
                    {padreNoRealizada ? (
                        <>
                            <p className="cuerpo text-body">Lamentamos que no se haya podido. No perdiste tu cupo.</p>
                            <div className="flex flex-wrap gap-3">
                                <a
                                    className="rounded-xl bg-cielo px-4 py-2 text-sm text-white hover:opacity-90"
                                    href={`/dashboard/padre/profesionales?heredarDe=${encodeURIComponent(solicitudId)}`}
                                >
                                    Pedir otra cita
                                </a>
                                <a
                                    className="rounded-xl border border-tinta/15 px-4 py-2 text-sm text-body hover:bg-tinta/5"
                                    href={`mailto:${CORREO_SOPORTE}`}
                                >
                                    Escríbenos
                                </a>
                            </div>
                        </>
                    ) : (
                        // SPEC-792 C1+C3: el cierre del camino feliz (padre-sí y profesional) tenía SALIDA
                        // solo por el botón atrás del navegador. Ahora: mensaje por audiencia (C3) + una
                        // salida real al panel (C1). Botón secundario: la acción (responder) ya se hizo.
                        <>
                            <p className="cuerpo text-body">{copy.gracias}</p>
                            <a
                                className="inline-flex rounded-xl border border-tinta/15 px-4 py-2 text-sm text-body hover:bg-tinta/5"
                                href={copy.panel}
                            >
                                Volver a mi panel
                            </a>
                        </>
                    )}
                </div>
            </section>
        );
    }

    return (
        <section className="mx-auto max-w-2xl p-4 sm:p-6 space-y-5 anim-entrada">
            <header>
                <h1 className="font-serif text-2xl text-body">{copy.intro(fecha)}</h1>
                <p className="cuerpo text-subtle mt-1">{copy.subtitulo}</p>
            </header>

            <PreguntaRadio def={preguntaDef("SE_REALIZO")} origen={origen} valor={valores.SE_REALIZO} onElegir={(k) => set("SE_REALIZO", k)} />

            {/* Razón: SÓLO si NO se realizó. Se RENDERIZA condicional (no se deshabilita) — la duración
                ni siquiera existe en el DOM cuando no se realizó, y viceversa: el CHECK no se puede violar. */}
            {seRealizo === false && (
                <PreguntaRadio
                    enunciado={RAZON_NO_REALIZO_ENUNCIADO}
                    opciones={RAZONES_NO_REALIZO}
                    nombre="RAZON"
                    origen={origen}
                    valor={valores.RAZON}
                    onElegir={(k) => set("RAZON", k)}
                />
            )}

            <PreguntaRadio def={preguntaDef("OPERADOR")} origen={origen} valor={valores.OPERADOR} onElegir={(k) => set("OPERADOR", k)} />
            <PreguntaRadio def={preguntaDef("INICIO")} origen={origen} valor={valores.INICIO} onElegir={(k) => set("INICIO", k)} />
            <PreguntaRadio def={preguntaDef("ENLACE")} origen={origen} valor={valores.ENLACE} onElegir={(k) => set("ENLACE", k)} />

            {/* Duración: SÓLO si se realizó. Desaparece (no «N/A») cuando no se realizó. */}
            {seRealizo === true && (
                <PreguntaRadio def={preguntaDef("DURACION")} origen={origen} valor={valores.DURACION} onElegir={(k) => set("DURACION", k)} />
            )}

            {error && <p className="cuerpo text-rubi" role="alert">{error}</p>}

            <button
                type="button"
                disabled={!completa || enviando}
                onClick={enviar}
                className="rounded-xl bg-cielo px-5 py-2.5 text-sm text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {enviando ? "Enviando…" : copy.enviar}
            </button>
        </section>
    );
}

/**
 * Un grupo de radios de una pregunta. Acepta o una `DefinicionPregunta` (usa su `pregunta` como nombre)
 * o un enunciado + opciones sueltas (para la razón condicional). Los labels se resuelven por AUDIENCIA.
 */
function PreguntaRadio(props: {
    origen: Audiencia;
    valor: string | undefined;
    onElegir: (key: string) => void;
    def?: DefinicionPregunta;
    enunciado?: string;
    opciones?: readonly OpcionPregunta[];
    nombre?: string;
}) {
    const enunciado = props.def?.enunciado ?? props.enunciado ?? "";
    const opciones = props.def?.opciones ?? props.opciones ?? [];
    const nombre = props.def?.pregunta ?? props.nombre ?? enunciado;
    return (
        <fieldset className="glass rounded-2xl p-4 space-y-3">
            <legend className="titular-seccion">{enunciado}</legend>
            <div className="grid gap-2">
                {opciones.map((o) => {
                    const seleccionada = props.valor === o.key;
                    return (
                        <label
                            key={o.key}
                            className={`flex items-center gap-2 rounded-xl border p-3 text-sm cursor-pointer transition ${
                                seleccionada
                                    ? "border-cielo bg-cielo/10 text-body"
                                    : "border-tinta/10 bg-tinta/5 text-body hover:bg-tinta/10"
                            }`}
                        >
                            <input
                                type="radio"
                                name={nombre}
                                value={o.key}
                                checked={seleccionada}
                                onChange={() => props.onElegir(o.key)}
                            />
                            <span>{labelOpcion(o, props.origen)}</span>
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}
