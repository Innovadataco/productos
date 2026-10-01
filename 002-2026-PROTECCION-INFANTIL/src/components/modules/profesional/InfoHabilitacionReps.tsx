/**
 * SPEC-813 (FORMA-SPEC790-AVISO v4.1) · Explicación de la habilitación REPS en el perfil del profesional —
 * destino del enlace «Ver qué significa y cómo renovar» del banner «fuera de la oferta». Eje SEPARADO de la
 * verificación interna. Tono NEUTRO (referencia, no alerta); voz usted; sin prometer un trámite/plazo que no
 * controlamos. Extraído de `MiPerfilProfesionalClient` (max-lines) — presentacional, sin estado.
 */
export function InfoHabilitacionReps() {
    return (
        <section aria-label="Habilitación en el registro de salud (REPS)" className="mt-6 rounded-2xl border border-tinta/15 p-5">
            <h2 className="text-base font-semibold text-body">Habilitación en el registro de salud (REPS)</h2>
            <div className="mt-2 space-y-2 text-sm text-muted">
                <p>
                    Para aparecer en la oferta a las familias, su inscripción en el registro de salud (REPS) debe estar
                    vigente. Es un eje aparte de su verificación interna: usted puede entrar a su área aunque su inscripción
                    no esté vigente, pero no se le ofrece a las familias mientras no lo esté.
                </p>
                <p>
                    Cuando su inscripción figura como <strong>no vigente</strong>, suele deberse a una renovación pendiente —
                    no es una sanción ni un juicio sobre su trabajo. Cuando vuelva a estar vigente, usted vuelve a la oferta
                    por sí solo, sin inscribirse de nuevo.
                </p>
                <p>La renovación se tramita ante el registro oficial de prestadores de salud (REPS).</p>
            </div>
        </section>
    );
}
