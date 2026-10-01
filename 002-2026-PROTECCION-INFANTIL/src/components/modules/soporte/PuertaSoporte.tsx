"use client";

/**
 * SPEC-752 · La puerta de PQR/soporte (§4c de FORMA-CANAL-CONTINUIDAD; FORMA-SPEC752).
 *
 * El padre elige UN motivo cerrado y envía; NO escribe. Sin campo de texto libre
 * (imposibilidad estructural: un textarea entre un padre y soporte arrastra contenido
 * sensible de un menor). Sin plazo en la UI — la confirmación dice el QUÉ pasa después,
 * no el CUÁNDO. La puerta URGENTE (141/CAI/Te Protejo) es `CanalesOficiales`, aparte.
 *
 * SPEC-819 (FORMA-SPEC819) · cuando el motivo es «Mis datos personales» es habeas data y
 * arranca un término legal. El sistema NO infiere el tipo ni el sujeto: los PREGUNTA en dos
 * ejes ([NORMA] discriminadores) — QUÉ (ver/corregir/pedir borrar) y DE QUIÉN (míos / de un
 * hijo de una lista cerrada). Nada viene pre-seleccionado; no se puede enviar sin ambos ejes.
 * Sigue SIN plazo y SIN lenguaje de abogado en lo que ve el padre.
 *
 * Presentacional: recibe `onEnviar` (lo cablea quien la coloca, con el endpoint real) y la
 * lista de `hijos` del padre (para el selector del sujeto). Muestra el número de seguimiento
 * que DEVUELVE el registro — nunca uno inventado.
 */
import { useState } from "react";
import type { MotivoPeticionServicio, TipoSolicitudHabeasData, ClaseDatoTitular } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import {
    MOTIVOS_SOPORTE,
    COPY_PUERTA_SOPORTE,
    confirmacionSoporte,
    tituloDeMotivo,
    TIPOS_HABEAS_DATA,
    SUJETOS_HABEAS_DATA,
    CLASES_DATO_HABEAS,
    COPY_SUPRESION_LIMITE,
    COPY_HABEAS_PREGUNTA,
} from "@/lib/soporte/motivos-soporte";
import { COPY_CORRECCION_RELATO } from "@/lib/profesional/cita/copy-correccion-relato";

/** SPEC-827 · RECTIFICACION/SUPRESION exigen el OBJETO (≥1 clase); CONSULTA no lleva. */
const TIPOS_CON_OBJETO: readonly TipoSolicitudHabeasData[] = ["RECTIFICACION", "SUPRESION"];

/** Calidad del peticionario que la puerta del padre puede registrar (2 de las 3 del enum). */
type CalidadPuerta = "TITULAR_CUENTA" | "REPRESENTANTE_LEGAL";

/** Lo que la puerta entrega al cablear `onEnviar`. Para habeas data viajan los dos ejes resueltos. */
export type EnvioSoporte =
    | { motivo: Exclude<MotivoPeticionServicio, "DATOS_PERSONALES"> }
    | {
          motivo: "DATOS_PERSONALES";
          tipo: TipoSolicitudHabeasData;
          sujeto: { calidad: "TITULAR_CUENTA" } | { calidad: "REPRESENTANTE_LEGAL"; hijoId: string };
          /** SPEC-827 · el OBJETO: clases sobre las que recae. Vacío para CONSULTA, ≥1 para RECTIFICACION/SUPRESION. */
          clasesSolicitadas: ClaseDatoTitular[];
      };

export interface HijoOpcion {
    id: string;
    nombre: string;
}

interface PuertaSoporteProps {
    /** Registra la petición y devuelve su número de seguimiento. */
    onEnviar: (envio: EnvioSoporte) => Promise<{ numeroSeguimiento: string }>;
    /** Hijos registrados del padre (para el sujeto «de mi hijo»). Vacío ⇒ esa opción se deshabilita. */
    hijos: HijoOpcion[];
}

export function PuertaSoporte({ onEnviar, hijos }: PuertaSoporteProps) {
    const [seleccion, setSeleccion] = useState<MotivoPeticionServicio | null>(null);
    // Ejes de habeas data — SPEC-819. Nada pre-seleccionado ([NORMA] no inferir).
    const [tipoSel, setTipoSel] = useState<TipoSolicitudHabeasData | null>(null);
    const [calidadSel, setCalidadSel] = useState<CalidadPuerta | null>(null);
    const [hijoIdSel, setHijoIdSel] = useState<string | null>(null);
    // SPEC-827 · EJE C: el OBJETO. Multi-select (puede recaer sobre más de una clase). Nada pre-elegido.
    const [clasesSel, setClasesSel] = useState<ClaseDatoTitular[]>([]);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resultado, setResultado] = useState<{ numeroSeguimiento: string; tituloMotivo: string } | null>(null);

    const esDatos = seleccion === "DATOS_PERSONALES";

    function elegirMotivo(m: MotivoPeticionServicio) {
        setSeleccion(m);
        // Cambiar de motivo limpia los ejes de habeas data: nunca arrastrar una elección vieja.
        setTipoSel(null);
        setCalidadSel(null);
        setHijoIdSel(null);
        setClasesSel([]);
    }

    function elegirTipo(t: TipoSolicitudHabeasData) {
        setTipoSel(t);
        // Cambiar de tipo limpia el OBJETO: CONSULTA no lleva, y no se arrastra una elección vieja entre tipos.
        setClasesSel([]);
    }

    function alternarClase(c: ClaseDatoTitular) {
        setClasesSel((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
    }

    const requiereObjeto = tipoSel !== null && TIPOS_CON_OBJETO.includes(tipoSel);

    function elegirCalidad(c: CalidadPuerta) {
        setCalidadSel(c);
        // Con un solo hijo, se nombra pre-elegido pero VISIBLE y confirmado (el registro necesita el id,
        // no un supuesto). Con varios, nada pre-elegido: el padre elige cuál.
        setHijoIdSel(c === "REPRESENTANTE_LEGAL" && hijos.length === 1 ? hijos[0].id : null);
    }

    // ¿Están los ejes resueltos? sujeto «de mi hijo» exige un hijo; y SPEC-827: RECTIFICACION/SUPRESION
    // exigen ≥1 clase (el objeto) — sin él la petición no es accionable y el plazo corre igual.
    const habeasCompleto =
        tipoSel !== null &&
        (calidadSel === "TITULAR_CUENTA" || (calidadSel === "REPRESENTANTE_LEGAL" && hijoIdSel !== null)) &&
        (!requiereObjeto || clasesSel.length > 0);
    const puedeEnviar = seleccion !== null && (!esDatos || habeasCompleto);

    function construirEnvio(): EnvioSoporte | null {
        if (seleccion === null) return null;
        if (seleccion !== "DATOS_PERSONALES") {
            return { motivo: seleccion };
        }
        if (tipoSel === null || calidadSel === null) return null;
        // SPEC-827 · el objeto viaja solo para los tipos que lo llevan; CONSULTA va con [] (el CHECK/ruta lo exigen).
        const clasesSolicitadas = requiereObjeto ? clasesSel : [];
        if (requiereObjeto && clasesSolicitadas.length === 0) return null;
        if (calidadSel === "REPRESENTANTE_LEGAL") {
            if (hijoIdSel === null) return null;
            return {
                motivo: "DATOS_PERSONALES",
                tipo: tipoSel,
                sujeto: { calidad: "REPRESENTANTE_LEGAL", hijoId: hijoIdSel },
                clasesSolicitadas,
            };
        }
        return { motivo: "DATOS_PERSONALES", tipo: tipoSel, sujeto: { calidad: "TITULAR_CUENTA" }, clasesSolicitadas };
    }

    async function enviar() {
        const envio = construirEnvio();
        if (!envio || enviando) return;
        setEnviando(true);
        setError(null);
        try {
            const { numeroSeguimiento } = await onEnviar(envio);
            setResultado({ numeroSeguimiento, tituloMotivo: tituloDeMotivo(envio.motivo) });
        } catch {
            // Neutral: nunca el mensaje del servidor (no filtramos detalle al padre).
            setError("No pudimos enviar tu solicitud. Inténtalo de nuevo.");
        } finally {
            setEnviando(false);
        }
    }

    if (resultado) {
        return (
            <div className="glass rounded-2xl p-5 mt-6">
                <p className="text-sm text-body">{confirmacionSoporte(resultado.tituloMotivo)}</p>
                <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                    {COPY_PUERTA_SOPORTE.numeroSeguimientoLabel}
                    <code className="rounded bg-tinta/10 px-2 py-0.5 font-mono text-body">{resultado.numeroSeguimiento}</code>
                </p>
            </div>
        );
    }

    const sinHijos = hijos.length === 0;

    return (
        <div className="glass rounded-2xl p-5 mt-6">
            <fieldset>
                <legend className="text-sm font-semibold text-body">{COPY_PUERTA_SOPORTE.titulo}</legend>
                <p className="mt-1 text-xs text-muted">{COPY_PUERTA_SOPORTE.subtitulo}</p>

                <div className="mt-4 grid gap-2">
                    {MOTIVOS_SOPORTE.map((m) => (
                        <label
                            key={m.valor}
                            className="flex cursor-pointer items-start gap-3 rounded-[var(--radio-card)] bg-tinta/5 p-3 transition hover:bg-tinta/10"
                        >
                            <input
                                type="radio"
                                name="motivo-soporte"
                                value={m.valor}
                                checked={seleccion === m.valor}
                                onChange={() => elegirMotivo(m.valor)}
                                className="mt-0.5"
                            />
                            <span>
                                <span className="block text-sm font-medium text-body">{m.titulo}</span>
                                {m.subtitulo && <span className="block text-xs text-muted">{m.subtitulo}</span>}
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>

            {/* SPEC-819 · la pregunta de habeas data: solo cuando el motivo es «Mis datos personales». */}
            {esDatos && (
                <div className="mt-4 grid gap-4 border-t border-tinta/10 pt-4">
                    {/* EJE A · ¿Qué quieres hacer? [NORMA] discriminador de TIPO. */}
                    <fieldset>
                        <legend className="text-sm font-semibold text-body">{COPY_HABEAS_PREGUNTA.ejeATitulo}</legend>
                        <div className="mt-2 grid gap-2">
                            {TIPOS_HABEAS_DATA.map((t) => (
                                <div key={t.valor}>
                                    <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radio-card)] bg-tinta/5 p-3 transition hover:bg-tinta/10">
                                        <input
                                            type="radio"
                                            name="habeas-tipo"
                                            value={t.valor}
                                            checked={tipoSel === t.valor}
                                            onChange={() => elegirTipo(t.valor)}
                                            className="mt-0.5"
                                        />
                                        <span>
                                            <span className="block text-sm font-medium text-body">{t.titulo}</span>
                                            <span className="block text-xs text-muted">{t.aclaracion}</span>
                                        </span>
                                    </label>
                                    {/* [NORMA] verdad de la promesa: FIJO bajo «Pedir que borren los datos». */}
                                    {t.valor === "SUPRESION" && (
                                        <p className="mt-1 px-3 text-xs text-muted">{COPY_SUPRESION_LIMITE}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </fieldset>

                    {/* EJE B · ¿De quién son los datos? [NORMA] discriminador de SUJETO (obligatorio por CHECK). */}
                    <fieldset>
                        <legend className="text-sm font-semibold text-body">{COPY_HABEAS_PREGUNTA.ejeBTitulo}</legend>
                        <div className="mt-2 grid gap-2">
                            {SUJETOS_HABEAS_DATA.map((s) => {
                                const deshabilitada = s.calidad === "REPRESENTANTE_LEGAL" && sinHijos;
                                return (
                                    <label
                                        key={s.calidad}
                                        className={`flex items-start gap-3 rounded-[var(--radio-card)] bg-tinta/5 p-3 transition ${
                                            deshabilitada ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-tinta/10"
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="habeas-sujeto"
                                            value={s.calidad}
                                            checked={calidadSel === s.calidad}
                                            disabled={deshabilitada}
                                            onChange={() => elegirCalidad(s.calidad)}
                                            className="mt-0.5"
                                        />
                                        <span className="block text-sm font-medium text-body">{s.titulo}</span>
                                    </label>
                                );
                            })}
                        </div>

                        {/* Borde (FORMA §2): sin hijos registrados, «De mi hijo» no tiene de dónde elegir.
                            La SALIDA accionable del pie queda PENDIENTE de Diseño — no se inventa (orden del CEO). */}
                        {sinHijos && <p className="mt-1 px-3 text-xs text-muted">{COPY_HABEAS_PREGUNTA.sinHijos}</p>}

                        {/* Selector del hijo: lista CERRADA (nunca texto libre); el registro exige el id. */}
                        {calidadSel === "REPRESENTANTE_LEGAL" && !sinHijos && (
                            <div className="mt-2 pl-3">
                                <p className="text-xs font-medium text-body">{COPY_HABEAS_PREGUNTA.elegirHijo}</p>
                                <div className="mt-1 grid gap-1">
                                    {hijos.map((h) => (
                                        <label key={h.id} className="flex cursor-pointer items-center gap-2 text-sm text-body">
                                            <input
                                                type="radio"
                                                name="habeas-hijo"
                                                value={h.id}
                                                checked={hijoIdSel === h.id}
                                                onChange={() => setHijoIdSel(h.id)}
                                            />
                                            {h.nombre}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </fieldset>

                    {/* SPEC-827 · EJE C · ¿sobre QUÉ dato recae? El OBJETO: clases CERRADAS (nunca texto libre),
                        ≥1. Solo RECTIFICACION/SUPRESION (CONSULTA no lleva). Multi-select — el derecho es general,
                        se ofrecen las SEIS clases. Los límites del relato aparecen al elegirlo en una corrección. */}
                    {requiereObjeto && (
                        <fieldset>
                            <legend className="text-sm font-semibold text-body">{COPY_HABEAS_PREGUNTA.ejeCTitulo}</legend>
                            <p className="mt-1 text-xs text-muted">{COPY_HABEAS_PREGUNTA.ejeCAyuda}</p>
                            <div className="mt-2 grid gap-2">
                                {CLASES_DATO_HABEAS.map((c) => (
                                    <div key={c.valor}>
                                        <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radio-card)] bg-tinta/5 p-3 transition hover:bg-tinta/10">
                                            <input
                                                type="checkbox"
                                                name="habeas-clase"
                                                value={c.valor}
                                                checked={clasesSel.includes(c.valor)}
                                                onChange={() => alternarClase(c.valor)}
                                                className="mt-0.5"
                                            />
                                            <span>
                                                <span className="block text-sm font-medium text-body">{c.etiqueta}</span>
                                                {c.ayuda && <span className="block text-xs text-muted">{c.ayuda}</span>}
                                            </span>
                                        </label>
                                        {/* SPEC-780/827 · los dos límites de corregir el relato, FIJOS al elegir esa clase
                                            en una RECTIFICACION (no aplican a SUPRESION ni a otras clases). §3 no se cablea. */}
                                        {c.valor === "RELATO_CITA" &&
                                            tipoSel === "RECTIFICACION" &&
                                            clasesSel.includes("RELATO_CITA") && (
                                            <div className="mt-1 space-y-1 px-3 text-xs text-muted">
                                                <p>{COPY_CORRECCION_RELATO.limiteVersiones}</p>
                                                <p>{COPY_CORRECCION_RELATO.limiteProfesional}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </fieldset>
                    )}
                </div>
            )}

            {error && <p className="mt-3 text-xs text-estado-rubi">{error}</p>}

            <Button
                type="button"
                variant="primary"
                onClick={enviar}
                disabled={!puedeEnviar}
                isLoading={enviando}
                className="mt-4"
            >
                {COPY_PUERTA_SOPORTE.enviar}
            </Button>
        </div>
    );
}
