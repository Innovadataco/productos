"use client";
/**
 * SPEC-392 (L3) · pantalla previa al directorio — «el padre se presenta y
 * marca urgencia». Los canales oficiales (141, CAI Virtual, Te Protejo) están
 * a la vista aquí mismo por si el momento pide una respuesta ya (brief §7).
 *
 * SPEC-440 (I-306 · Jelkin vivo 04-09): `presentacion` y `urgencia`
 * **NO viajan en la URL**. Antes iban como `?u=&pres=` — nombre completo y
 * edades de los menores en la barra de direcciones, historial e ID logs.
 * Ahora se guardan en `sessionStorage` (helper `borrador-consulta`); el
 * directorio y el perfil los leen del cliente. Los IDs opacos (`expedienteId`,
 * `heredarDe`) sí pueden ir por query — no son PII y no arrastran narrativa.
 *
 * SPEC-440 P5 (Jelkin vivo 04-09): «que no le vuelva a pedir la presentación
 * en cada ingreso». Ahora persistimos también en `Usuario.presentacionEstandar`
 * y `Usuario.urgenciaEstandar` — el form arranca prellenado con lo del perfil
 * (o del sessionStorage si está más fresco), y al enviar guarda en ambos
 * lugares (sessionStorage como caché rápida + perfil como memoria duradera).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CanalesOficiales } from "@/components/modules/CanalesOficiales";
import { guardarBorradorConsulta, leerBorradorConsulta } from "@/lib/padre/borrador-consulta";

const URGENCIA_MIN = 0;
const URGENCIA_MAX = 500;
const PRESENTACION_MIN = 10;
const PRESENTACION_MAX = 500;

type Urgencia = "ESTA_SEMANA" | "SIN_APURO";

export function PresentacionUrgenciaForm({
    hrefDirectorio,
    // SPEC-428 (M4): si el padre entró desde su expediente, propagamos el
    // `expedienteId` hasta el perfil del profesional para poder ofrecer
    // «compartir mi expediente» al momento del pago.
    expedienteIdInicial,
    // SPEC-428 (M7): si viene con `heredarDe`, esta franja del flujo es la
    // reasignación de una cita vencida — el pago se hereda al hacer POST
    // a `/citas/[id]/reasignar` en el último paso.
    heredarDeInicial,
}: {
    hrefDirectorio: string;
    expedienteIdInicial?: string;
    heredarDeInicial?: string;
}) {
    const router = useRouter();
    const [presentacion, setPresentacion] = useState("");
    const [urgencia, setUrgencia] = useState<Urgencia>("SIN_APURO");

    // SPEC-440: si el padre ya empezó a escribir y navegó atrás, recupera lo
    // suyo del sessionStorage. No hacerle contar dos veces la misma historia.
    // SPEC-440 P5: si no hay borrador fresco, cae al perfil (persistencia
    // duradera). El borrador GANA sobre el perfil — es lo más reciente.
    useEffect(() => {
        const borrador = leerBorradorConsulta();
        if (borrador) {
            setPresentacion(borrador.presentacion);
            setUrgencia(borrador.urgencia);
            return;
        }
        let cancelado = false;
        void (async () => {
            try {
                const res = await fetch("/api/padre/perfil", { credentials: "include" });
                if (!res.ok || cancelado) return;
                const { perfil } = (await res.json()) as {
                    perfil?: { presentacionEstandar?: string | null; urgenciaEstandar?: string | null };
                };
                if (!perfil || cancelado) return;
                if (perfil.presentacionEstandar) setPresentacion(perfil.presentacionEstandar);
                if (perfil.urgenciaEstandar === "ESTA_SEMANA" || perfil.urgenciaEstandar === "SIN_APURO") {
                    setUrgencia(perfil.urgenciaEstandar);
                }
            } catch {
                // Sin perfil o sin red: el form arranca vacío. No es bloqueante.
            }
        })();
        return () => {
            cancelado = true;
        };
    }, []);

    const largo = presentacion.trim().length;
    const listo = largo >= PRESENTACION_MIN && largo <= PRESENTACION_MAX;

    function continuar(e: React.FormEvent) {
        e.preventDefault();
        if (!listo) return;
        const presentacionLimpia = presentacion.trim();
        // SPEC-440 (I-306): el borrador va a sessionStorage, no a la URL.
        guardarBorradorConsulta({ presentacion: presentacionLimpia, urgencia });
        // SPEC-440 P5: fire-and-forget al perfil — «no le vuelva a pedir la
        // presentación en cada ingreso». Si el POST falla (offline, servidor
        // caído) el sessionStorage cubre esta sesión igual. No bloqueamos la
        // navegación por esto.
        void fetch("/api/padre/perfil", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                presentacionEstandar: presentacionLimpia,
                urgenciaEstandar: urgencia,
            }),
        }).catch(() => {
            // Silencioso a propósito: la caché en sessionStorage cubre esta sesión.
        });
        // Solo los IDs opacos (no PII) viajan por query.
        const q = new URLSearchParams();
        if (expedienteIdInicial) q.set("expedienteId", expedienteIdInicial);
        if (heredarDeInicial) q.set("heredarDe", heredarDeInicial);
        const qs = q.toString();
        router.push(qs ? `${hrefDirectorio}?${qs}` : hrefDirectorio);
    }

    return (
        <div className="mx-auto max-w-2xl p-4 space-y-6">
            <header>
                <h1 className="text-2xl font-serif text-body">Antes de conocer a alguien</h1>
                <p className="mt-1 text-sm text-muted">
                    Cuéntanos por qué buscas un psicólogo. El profesional lo verá cuando le solicites cita.
                </p>
            </header>

            <form onSubmit={continuar} className="space-y-4 glass rounded-2xl p-5">
                <label className="block">
                    <span className="text-sm font-medium text-body">Tu presentación</span>
                    <textarea
                        value={presentacion}
                        onChange={(e) => setPresentacion(e.target.value.slice(0, URGENCIA_MAX))}
                        rows={5}
                        minLength={PRESENTACION_MIN}
                        maxLength={PRESENTACION_MAX}
                        required
                        placeholder="Ej.: Soy mamá de un niño de 12 años. Hemos recibido mensajes que nos preocupan..."
                        className="mt-1 w-full rounded-xl border border-cielo/40 bg-white px-3 py-2 text-sm text-body focus:border-cielo focus:outline-none dark:border-cielo/30 dark:bg-cielo/10"
                    />
                    <span className="text-xs text-subtle">
                        {largo}/{PRESENTACION_MAX} caracteres · mínimo {PRESENTACION_MIN}
                    </span>
                </label>

                <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-body">¿Qué tan urgente es?</legend>
                    <label className="flex items-start gap-2 rounded-xl border border-cielo/40 dark:border-cielo/30 p-3 cursor-pointer hover:bg-cielo/10 dark:hover:bg-cielo/10">
                        <input
                            type="radio"
                            name="urgencia"
                            value="ESTA_SEMANA"
                            checked={urgencia === "ESTA_SEMANA"}
                            onChange={() => setUrgencia("ESTA_SEMANA")}
                            className="mt-1"
                        />
                        <span>
                            <span className="font-medium text-body">Esta semana</span>
                            <span className="block text-xs text-muted">
                                Preferimos hablar con alguien pronto.
                            </span>
                        </span>
                    </label>
                    <label className="flex items-start gap-2 rounded-xl border border-cielo/40 dark:border-cielo/30 p-3 cursor-pointer hover:bg-cielo/10 dark:hover:bg-cielo/10">
                        <input
                            type="radio"
                            name="urgencia"
                            value="SIN_APURO"
                            checked={urgencia === "SIN_APURO"}
                            onChange={() => setUrgencia("SIN_APURO")}
                            className="mt-1"
                        />
                        <span>
                            <span className="font-medium text-body">Sin apuro</span>
                            <span className="block text-xs text-muted">
                                Podemos esperar para elegir con calma.
                            </span>
                        </span>
                    </label>
                </fieldset>

                <button
                    type="submit"
                    disabled={!listo}
                    className="w-full rounded-xl bg-cielo px-4 py-3 text-sm font-semibold text-white shadow-lg  disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cielo/90 transition"
                >
                    Ver profesionales verificados
                </button>
            </form>

            <CanalesOficiales />
        </div>
    );
}
