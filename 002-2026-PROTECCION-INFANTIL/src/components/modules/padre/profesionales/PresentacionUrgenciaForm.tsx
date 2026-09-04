"use client";
/**
 * SPEC-392 (L3) · pantalla previa al directorio — «el padre se presenta y
 * marca urgencia». Los canales oficiales (141, CAI Virtual, Te Protejo) están
 * a la vista aquí mismo por si el momento pide una respuesta ya (brief §7).
 *
 * `presentacion` y `urgencia` son estado del cliente — no se persisten en L3.
 * Se llevan al detalle del profesional como query (`?u=ESTA_SEMANA&pres=…`)
 * y de ahí a la solicitud real que se materializará en L4.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CanalesOficiales } from "@/components/modules/CanalesOficiales";

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

    const largo = presentacion.trim().length;
    const listo = largo >= PRESENTACION_MIN && largo <= PRESENTACION_MAX;

    function continuar(e: React.FormEvent) {
        e.preventDefault();
        if (!listo) return;
        const q = new URLSearchParams({ u: urgencia, pres: presentacion.trim() });
        if (expedienteIdInicial) q.set("expedienteId", expedienteIdInicial);
        if (heredarDeInicial) q.set("heredarDe", heredarDeInicial);
        router.push(`${hrefDirectorio}?${q.toString()}`);
    }

    return (
        <div className="mx-auto max-w-2xl p-4 space-y-6">
            <header>
                <h1 className="text-2xl font-serif text-body">Antes de conocer a alguien</h1>
                <p className="mt-1 text-sm text-muted">
                    Contanos por qué buscás un psicólogo. El profesional lo verá cuando le solicites cita.
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
