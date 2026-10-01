import Link from "next/link";

/**
 * SPEC-751 T010 · §2 de la forma (FORMA-SPEC751-T010 v1.1, 9ced530) · renglón informativo en el flujo
 * de pedir cita. HEADS-UP, NO muro: informa que «escuchar al menor es parte de cuidarlo» y acompaña a
 * ese paso; NUNCA dice «no puedes pedir la cita hasta…». Honesto con el gate apagado y al encenderlo.
 *
 * GENÉRICO, sin nombre (hallazgo Dev 2 #852 + v1.1 de Diseño): la cita NO es por-hijo (el POST no lleva
 * `hijoId`), así que en este punto el sistema no sabe de cuál hijo se trata — ni nombre ni GÉNERO. Por
 * eso el copy es plural inclusivo «tus hijos» (verdad general del servicio, honesta para 1 o N), nunca
 * «tu hijo» (masculino, fallaría con una hija). Solo aparece cuando hay audiencia(s) pendiente(s).
 * «¿Qué es esto?» lleva a la pantalla §1 (`/audiencia-menor`), que SÍ nombra al hijo. Voz tú (padre).
 *
 * Tono calmo, NEUTRO y SUBORDINADO a la línea de emergencia del panel: superficie neutra, sin color de
 * alarma (D-120 reserva el rojo a la criticidad de un menor; esto no lo es), para que no compita con la
 * afordancia de emergencia.
 */
export function RenglonAudienciaCita({ count }: { count: number }) {
    if (count <= 0) return null;
    return (
        <p className="mt-2 rounded-xl bg-tinta/[0.03] p-3 text-xs text-body/80" role="note">
            <span className="font-semibold text-body">
                Escuchar a tus hijos, según su edad, es parte de cuidarlos aquí
            </span>{" "}
            — es su derecho. Te acompañamos en ese paso.{" "}
            <Link href="/audiencia-menor" className="font-semibold text-accent underline">
                ¿Qué es esto?
            </Link>
        </p>
    );
}
