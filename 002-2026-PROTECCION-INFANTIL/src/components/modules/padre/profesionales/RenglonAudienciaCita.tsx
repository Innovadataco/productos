import Link from "next/link";

/**
 * SPEC-751 T010 · §2 de la forma (FORMA-SPEC751-T010, d485493) · renglón informativo en el flujo de
 * pedir cita. HEADS-UP, NO muro: informa que «escuchar al menor es parte de cuidarlo» y acompaña a ese
 * paso; NUNCA dice «no puedes pedir la cita hasta…» (sería mentira con el gate apagado, y sigue siendo
 * un acompañamiento —no un bloqueo— cuando Jelkin lo encienda). Honesto en los dos estados.
 *
 * Hallazgo (Dev 2): la cita NO es por-hijo — no hay selector de hijo en `SolicitarCitaPanel` (la forma
 * lo asumió con checkout atrasado, I-440). Por eso el renglón se enmarca por «tu hijo/tus hijos», SIN
 * nombre, y solo aparece cuando el titular tiene audiencia(s) pendiente(s). «¿Qué es esto?» lleva a la
 * pantalla §1 (`/audiencia-menor`). Voz tú (padre).
 */
export function RenglonAudienciaCita({ count }: { count: number }) {
    if (count <= 0) return null;
    const plural = count > 1;
    return (
        <p className="mt-2 rounded-xl bg-ambar/10 p-3 text-xs text-body" role="note">
            <span className="font-semibold">
                {plural
                    ? "Escuchar a tus hijos es parte de cuidarlos aquí:"
                    : "Escuchar a tu hijo es parte de cuidarlo aquí:"}
            </span>{" "}
            la ley pide que, según su edad, {plural ? "sepan y estén" : "sepa y esté"} de acuerdo. Te vamos a acompañar
            en ese paso.{" "}
            <Link href="/audiencia-menor" className="font-semibold text-accent underline">
                ¿Qué es esto?
            </Link>
        </p>
    );
}
