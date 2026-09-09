"use client";

import { useEffect, useState } from "react";
import { ReporteStepPlataforma } from "./ReporteStepPlataforma";
import { ReporteStepDetalle } from "./ReporteStepDetalle";
import { ReporteStepConfirmar } from "./ReporteStepConfirmar";
import { ReporteStepHijo, type HijoParaElegir } from "./ReporteStepHijo";
import { ConfirmacionReporte } from "./ConfirmacionReporte";
import { ReporteBloqueoRol } from "./ReporteBloqueoRol";
import { Button } from "@/components/ui/Button";
import { SkeletonContainer, SkeletonText } from "@/components/ui/Skeleton";
import { useMinTextoReporte } from "./use-min-texto-reporte";
import { tomarHandoffReportar, guardarBorradorReporte, leerBorradorReporte, borrarBorradorReporte } from "@/lib/reportar-handoff";

type WizardData = {
    // SPEC-591: ficha «A quién protego» a la que va dirigido (modo autenticado).
    hijoId: string;
    /** SPEC-604: nombre para crear la ficha inline («Nuevo hijo · solo nombre»). */
    hijoNuevoNombre: string;
    identificador: string;
    plataforma: string;
    otraPlataforma: string;
    ciudad: string;
    pais: string;
    paisId: string;
    ciudadId: string;
    fechaIncidente: string;
    /** SPEC-438: la hora la estimó el reportante (eligió franja). */
    horaAproximada: boolean;
    edadVictima: string;
    texto: string;
    esAnonimo: boolean;
};

type SessionUser = {
    id: string;
    email: string;
    nombre: string | null;
    rol: string;
} | null;

// SPEC-314 (002-PI-214): guard preventivo simétrico al backend (route.ts:41).
// Los 5 roles internos no pueden generar reportes desde su cuenta institucional
// (anti-fraude · esos roles revisan/validan · no reportan).
const ROLES_BLOQUEADOS = ["ADMIN", "OPERADOR", "SCHOOL_ADMIN", "COMITE_VALIDACION", "COMITE_CONVIVENCIA"];

// SPEC-295 (002-PI-196 · I-146): destino post-envío cuando el padre reporta
// desde su panel autenticado. La ruta pública sigue mostrando ConfirmacionReporte.
const REDIRECT_PADRE_POST_ENVIO = "/mis-reportes"; // SPEC-317: ruta real; /dashboard/padre/mis-reportes no existe

export function ReporteWizard({
    modoAutenticado = false,
}: {
    modoAutenticado?: boolean;
} = {}) {
    const [step, setStep] = useState(1);
    // SPEC-591: en modo autenticado el paso 1 es «¿A quién va dirigido?» y los
    // demás se corren un lugar. En anónimo el flujo queda exactamente como era.
    const STEP_PLATAFORMA = modoAutenticado ? 2 : 1;
    const STEP_DETALLE = modoAutenticado ? 3 : 2;
    const STEP_CONFIRMAR = modoAutenticado ? 4 : 3;
    const TOTAL_PASOS = modoAutenticado ? 4 : 3;
    // SPEC-591: fichas «A quién protego» activas del padre (modo autenticado).
    const [hijos, setHijos] = useState<HijoParaElegir[]>([]);
    const [cargandoHijos, setCargandoHijos] = useState(modoAutenticado);
    // SPEC-604: el padre puede crear la ficha inline con solo el nombre. Cuando
    // no tiene fichas activas, ese modo queda forzado (es su única vía).
    const [modoNuevoHijoElegido, setModoNuevoHijoElegido] = useState(false);
    const modoNuevoHijo = modoAutenticado && (modoNuevoHijoElegido || (!cargandoHijos && hijos.length === 0));
    const [user, setUser] = useState<SessionUser>(null);
    const [checkingSession, setCheckingSession] = useState(true);
    // Las dos pantallas que mandan al padre acá con un identificador ya escrito
    // (/seguimiento en SPEC-324 y la consulta vacía en F3 N-5) lo entregan por
    // sessionStorage — el identificador NUNCA viaja en la URL (spec 091-US2 /
    // 093-US4). Llave de un solo uso: se lee y se borra al montar. Solo
    // /seguimiento pide `fijar`, porque ahí el padre viene a agregar un evento
    // sobre ESE identificador; el prellenado de la consulta vacía es editable.
    const [handoff] = useState(() => tomarHandoffReportar());
    const identificadorFijado = handoff?.fijar ? handoff.identificador : null;
    const [data, setData] = useState<WizardData>(() => {
        const vacio: WizardData = {
            hijoId: "",
            hijoNuevoNombre: "",
            identificador: handoff?.identificador ?? "",
            plataforma: "",
            otraPlataforma: "",
            ciudad: "",
            pais: "",
            paisId: "",
            ciudadId: "",
            fechaIncidente: "",
            horaAproximada: false,
            edadVictima: "",
            texto: "",
            // SPEC-295: en modo autenticado el default es NO anónimo — el padre
            // reporta con su identidad. Checkbox opcional para volver a anónimo.
            esAnonimo: !modoAutenticado,
        };
        // A-70 · B1(d): el relato NO se pierde. Jelkin escribió el reporte
        // completo, el envío falló con 400 y al recargar quedó la pantalla en
        // blanco. El borrador vive en sessionStorage (misma pestaña, se borra
        // al enviar bien) y el handoff manda sobre lo guardado si viene uno.
        const guardado = leerBorradorReporte();
        if (!guardado) return vacio;
        return {
            ...vacio,
            ...guardado,
            ...(handoff?.identificador ? { identificador: handoff.identificador } : {}),
            esAnonimo: vacio.esAnonimo,
        };
    });
    // A-70 · B1(d): autoguardado del borrador en cada cambio. Solo los campos
    // del formulario — nunca `esAnonimo` (lo decide el modo de la pantalla).
    useEffect(() => {
        const { esAnonimo: _descartado, ...campos } = data;
        void _descartado;
        guardarBorradorReporte(campos);
    }, [data]);

    const [resultado, setResultado] = useState<{ numeroSeguimiento: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    // SPEC-323 (T007/US1): oferta de vinculación cuando el padre duplica un reporte reciente.
    const [oferta, setOferta] = useState<{ reporteExistenteId: string; identificador: string } | null>(null);
    const [reportePrevioId, setReportePrevioId] = useState<string | null>(null);
    // SPEC-314 (002-PI-214): fallback reactivo · si el backend rechaza con 403 FORBIDDEN
    // (rol nuevo agregado al backend sin actualizar ROLES_BLOQUEADOS del frontend), se
    // muestra el mismo card de bloqueo con 2 CTAs.
    const [bloqueadoPorBackend, setBloqueadoPorBackend] = useState(false);
    // I-14: la longitud mínima del texto es un parámetro (reportes.spam.min_text_length),
    // no un literal — el botón Siguiente obedece el mismo valor que el backend.
    const minTexto = useMinTextoReporte();

    const update = (partial: Partial<WizardData>) => setData((d) => ({ ...d, ...partial }));

    // SPEC-604: al elegir ficha, la edad del reporte se DERIVA del año de
    // nacimiento registrado — el paso 2 ya no la pide en modo autenticado
    // (el anónimo conserva el campo). Ficha «sin edad» → el reporte va sin edad.
    const elegirHijo = (hijoId: string) => {
        setModoNuevoHijoElegido(false);
        const ficha = hijos.find((h) => h.id === hijoId);
        const edad = ficha?.anioNacimiento
            ? String(Math.max(0, new Date().getFullYear() - ficha.anioNacimiento))
            : "";
        update({ hijoId, edadVictima: edad });
    };

    const elegirNuevoHijo = () => {
        setModoNuevoHijoElegido(true);
        // La ficha nueva nace con solo nombre: sin año → sin edad derivada.
        update({ hijoId: "", edadVictima: "" });
    };

    useEffect(() => {
        fetch("/api/me", { credentials: "include" })
            .then(async (res) => {
                if (res.ok) {
                    const data = await res.json().catch(() => null);
                    if (data && !data.error) {
                        setUser({ id: data.id, email: data.email, nombre: data.nombre, rol: data.rol });
                    }
                }
            })
            .catch(() => {
                // Sin sesión: flujo anónimo normal
            })
            .finally(() => setCheckingSession(false));
    }, []);

    // SPEC-591: en modo autenticado, la lista de fichas para «¿A quién va
    // dirigido?». Solo ACTIVOS entran al select (el backend además lo exige).
    useEffect(() => {
        if (!modoAutenticado) return;
        fetch("/api/padre/hijos", { credentials: "include" })
            .then(async (res) => {
                if (!res.ok) return [];
                const json = await res.json().catch(() => []);
                return Array.isArray(json) ? (json as HijoParaElegir[]) : [];
            })
            .then((lista) => setHijos(lista.filter((h) => h.estado === "activo")))
            .catch(() => setHijos([]))
            .finally(() => setCargandoHijos(false));
    }, [modoAutenticado]);

    async function handleLogout() {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        window.location.reload();
    }

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError("");
        try {
            // SPEC-604: «Nuevo hijo (solo nombre)» — la ficha se crea AHORA, al
            // enviar el reporte (no al teclear en el paso 0): un wizard abandonado
            // no deja fichas huérfanas en «A quién protego».
            let hijoId = data.hijoId;
            if (modoAutenticado && !hijoId && data.hijoNuevoNombre.trim()) {
                const resHijo = await fetch("/api/padre/hijos", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nombre: data.hijoNuevoNombre.trim() }),
                });
                const jsonHijo = await resHijo.json().catch(() => null);
                if (!resHijo.ok || !jsonHijo?.hijoId) {
                    setError(jsonHijo?.error?.message || "No pudimos registrar la ficha del menor. Intenta de nuevo.");
                    setIsSubmitting(false);
                    return;
                }
                hijoId = jsonHijo.hijoId as string;
            }

            const res = await fetch("/api/reportes", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    identificador: data.identificador,
                    plataforma: data.plataforma,
                    otraPlataforma: data.otraPlataforma,
                    texto: data.texto,
                    // SPEC-438 (I-305): acá estaba el defecto. Si el campo venía
                    // vacío se mandaba `new Date()`, y el instante del ENVÍO
                    // quedaba guardado como la hora del HECHO. No es un dato
                    // faltante: es un dato falso, indistinguible de uno
                    // verdadero, que alimentaba la franja horaria del modelo y
                    // un informe con valor probatorio. Ahora la fecha es
                    // obligatoria y el sistema no rellena nada.
                    fechaIncidente: new Date(data.fechaIncidente).toISOString(),
                    horaAproximada: data.horaAproximada,
                    ciudad: data.ciudad,
                    pais: data.pais,
                    paisId: data.paisId || null,
                    ciudadId: data.ciudadId === "otra" ? null : (data.ciudadId || null),
                    edadVictima: data.edadVictima ? Number(data.edadVictima) : undefined,
                    // SPEC-323 (US1): señal de vinculación intencional (presente solo en el 2º reporte).
                    ...(reportePrevioId ? { reportePrevioId } : {}),
                    // SPEC-591: vínculo obligatorio del padre autenticado.
                    // SPEC-604: puede venir de la ficha recién creada (solo nombre).
                    ...(modoAutenticado && hijoId ? { hijoId } : {}),
                }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                // SPEC-314 (002-PI-214): 403 FORBIDDEN del backend por rol interno → mostrar
                // card de bloqueo reactivo con las 2 CTAs de escape (defense-in-depth).
                if (res.status === 403 && json?.error?.code === "FORBIDDEN") {
                    setBloqueadoPorBackend(true);
                    setIsSubmitting(false);
                    return;
                }
                setError(json?.error?.message || "Error al enviar el reporte");
                setIsSubmitting(false);
                return;
            }
            // SPEC-323 (US1): el backend detecta duplicado reciente del padre → ofrece vinculación.
            if (json?.oferta === true) {
                setOferta({ reporteExistenteId: json.reporteExistenteId, identificador: json.identificador });
                setIsSubmitting(false);
                return;
            }
            // SPEC-295 (002-PI-196 · I-146): en modo autenticado, redirect al
            // listado del padre en vez de mostrar ConfirmacionReporte inline.
            // A-70 · B1(d): enviado con éxito → el borrador ya no hace falta.
            borrarBorradorReporte();
            if (modoAutenticado) {
                window.location.href = REDIRECT_PADRE_POST_ENVIO;
                return;
            }
            setResultado({ numeroSeguimiento: json.reporte.numeroSeguimiento });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error de conexión");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (checkingSession) {
        return (
            <SkeletonContainer
                label="Verificando sesión…"
                className="mx-auto max-w-xl rounded-2xl border border-tinta/10 bg-papel/70 p-8 backdrop-blur-xl"
            >
                <SkeletonText lines={4} />
            </SkeletonContainer>
        );
    }

    // SPEC-314 (002-PI-214): guard preventivo (rol conocido) o fallback reactivo (403 backend).
    if ((user && ROLES_BLOQUEADOS.includes(user.rol)) || bloqueadoPorBackend) {
        return <ReporteBloqueoRol onLogoutAndRetry={handleLogout} />;
    }

    if (resultado) {
        return <ConfirmacionReporte numeroSeguimiento={resultado.numeroSeguimiento} />;
    }

    // SPEC-323 (T007/US1): tarjeta de oferta de vinculación.
    if (oferta) {
        return (
            <div className="mx-auto max-w-xl rounded-2xl border border-ambar/30 bg-ambar/10 p-8 text-center">
                <p className="text-lg font-semibold text-tinta">
                    Ya reportaste este identificador recientemente
                </p>
                <p className="mt-2 text-sm text-tinta/80">
                    <span className="font-mono font-bold">{oferta.identificador}</span> ya tiene un reporte tuyo en el sistema.
                    ¿Quieres agregar otro evento al mismo caso?
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Button
                        onClick={() => {
                            setReportePrevioId(oferta.reporteExistenteId);
                            update({ identificador: oferta.identificador });
                            setStep(STEP_PLATAFORMA);
                            setOferta(null);
                        }}
                    >
                        Sí, agregar otro evento
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setOferta(null);
                            setError("");
                        }}
                    >
                        Cancelar
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-xl">
            {/* SPEC-340 (A-68 §2.1): el banner "Reportando como <nombre> <correo>"
                de SPEC-295 se retiró — Jelkin: no es necesario. La identidad sigue
                derivándose de la sesión en el backend; nada cambia en los datos. */}
            <div className="mb-6 flex items-center justify-between">
                {Array.from({ length: TOTAL_PASOS }, (_, i) => i + 1).map((s) => (
                    <div key={s} className="flex flex-1 items-center">
                        <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${s <= step
                                ? "bg-primary-600 text-white"
                                : "bg-tinta/10 text-muted"
                            }`}
                        >
                            {s}
                        </div>
                        {s < TOTAL_PASOS && (
                            <div
                                className={`mx-2 h-1 flex-1 rounded transition ${s < step ? "bg-primary-600" : "bg-tinta/10"
                                }`}
                            />
                        )}
                    </div>
                ))}
            </div>

            {step === 1 && modoAutenticado && (
                <ReporteStepHijo
                    hijos={hijos}
                    cargando={cargandoHijos}
                    seleccionado={data.hijoId}
                    onChange={elegirHijo}
                    modoNuevo={modoNuevoHijo}
                    nuevoNombre={data.hijoNuevoNombre}
                    onElegirNuevo={elegirNuevoHijo}
                    onNuevoNombre={(hijoNuevoNombre) => update({ hijoNuevoNombre })}
                />
            )}
            {step === STEP_PLATAFORMA && (
                <ReporteStepPlataforma
                    identificador={data.identificador}
                    plataforma={data.plataforma}
                    otraPlataforma={data.otraPlataforma}
                    identificadorBloqueado={reportePrevioId !== null || identificadorFijado !== null}
                    onChange={(v: { identificador: string; plataforma: string; otraPlataforma: string }) => update(v)}
                />
            )}
            {step === STEP_DETALLE && (
                <ReporteStepDetalle
                    ciudad={data.ciudad}
                    pais={data.pais}
                    fechaIncidente={data.fechaIncidente}
                    horaAproximada={data.horaAproximada}
                    paisId={data.paisId}
                    ciudadId={data.ciudadId}
                    edadVictima={data.edadVictima}
                    texto={data.texto}
                    onChange={(v) => update(v)}
                    // SPEC-604: con ficha elegida la edad se deriva del año de
                    // nacimiento — el campo se OCULTA en modo autenticado (el
                    // anónimo, que no tiene fichas, lo conserva).
                    ocultarEdad={modoAutenticado}
                />
            )}
            {step === STEP_CONFIRMAR && (
                <ReporteStepConfirmar
                    data={data}
                    onSubmit={handleSubmit}
                    isSubmitting={isSubmitting}
                    error={error}
                    hijoNombre={
                        modoAutenticado
                            ? modoNuevoHijo
                                ? data.hijoNuevoNombre.trim() || null
                                : (() => {
                                    const ficha = hijos.find((h) => h.id === data.hijoId);
                                    return ficha ? `${ficha.nombre} ${ficha.apellidos}`.trim() : null;
                                })()
                            : null
                    }
                />
            )}

            <div className="mt-6 flex justify-between">
                {step > 1 && (
                    <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                        Atrás
                    </Button>
                )}
                {step < STEP_CONFIRMAR && (
                    <Button
                        className="ml-auto"
                        onClick={() => setStep((s) => s + 1)}
                        disabled={
                            (step === 1 &&
                                modoAutenticado &&
                                !data.hijoId &&
                                !(modoNuevoHijo && data.hijoNuevoNombre.trim())) ||
                            (step === STEP_PLATAFORMA && (!data.identificador.trim() || !data.plataforma)) ||
                            (step === STEP_DETALLE &&
                                (!data.paisId ||
                                    !data.ciudadId ||
                                    (data.ciudadId === "otra" && !data.ciudad) ||
                                    // SPEC-438 (I-305): la fecha y hora del hecho son
                                    // OBLIGATORIAS. Sin esto se podía avanzar sin ellas
                                    // y el sistema guardaba la hora del envío.
                                    !data.fechaIncidente ||
                                    data.texto.length < minTexto))
                        }
                    >
                        Siguiente
                    </Button>
                )}
            </div>
        </div>
    );
}
