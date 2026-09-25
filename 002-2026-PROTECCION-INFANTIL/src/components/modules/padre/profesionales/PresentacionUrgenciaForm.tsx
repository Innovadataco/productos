"use client";
/**
 * SPEC-392 (L3) · pantalla previa al directorio. Los canales oficiales (141, CAI
 * Virtual, Te Protejo) están a la vista aquí mismo por si el momento pide una
 * respuesta ya (brief §7).
 *
 * SPEC-729 (§2 + §4 · Jelkin probando 24-09):
 *  · La presentación del padre YA NO se escribe acá — vive en «Mi perfil»
 *    (`PerfilPadreForm`) y la solicitud de cita la toma de ahí. Este panel deja de
 *    ser donde se redacta (antes: textarea + persistencia en `presentacionEstandar`).
 *  · La «urgencia» se retira: era un control inerte (no ordenaba la cola del
 *    profesional ni filtraba nada). Un control que no hace nada miente — fuera.
 *
 * Queda la antesala honesta al directorio: los canales de emergencia a la vista y
 * el paso a los profesionales verificados. Los IDs opacos (`expedienteId`,
 * `heredarDe`) sí pueden ir por query — no son PII.
 */
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CanalesOficiales } from "@/components/modules/CanalesOficiales";

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

    function verProfesionales() {
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
                    Si es una emergencia, estos canales oficiales responden de inmediato. Cuando quieras, mira
                    los profesionales verificados.
                </p>
            </header>

            <CanalesOficiales />

            <Button type="button" onClick={verProfesionales} className="w-full">
                Ver profesionales verificados
            </Button>
        </div>
    );
}
