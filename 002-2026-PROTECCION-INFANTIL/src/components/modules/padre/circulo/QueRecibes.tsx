"use client";

/**
 * A-73 (SPEC-367) · "Qué recibes cuando pasa algo".
 * Le muestra al padre, con un ejemplo, cómo le avisamos — y deja claro que a la
 * persona vigilada NUNCA le llega nada. El interruptor es la preferencia real
 * (`notificacionesCirculo`), con su tope de un correo al día.
 */
export function QueRecibes({ avisoCorreo, onCambiar }: { avisoCorreo: boolean; onCambiar: () => void }) {
    return (
        <section className="mt-8 rounded-2xl border border-tinta/10 bg-white p-5 dark:bg-tinta/20">
            <h2 className="text-xl font-semibold text-body">Qué recibes cuando pasa algo</h2>
            <p className="mt-1 text-sm text-muted">
                Así te avisamos, con un ejemplo. Nunca le llega nada a la persona que vigilas.
            </p>

            <div className="mt-4 grid gap-3.5 md:grid-cols-2">
                <div className="rounded-xl bg-papel p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted">Al correo</p>
                    <p className="mt-2 text-sm text-body">
                        <b className="font-semibold">Asunto:</b> Alerta relacionada con Carlos
                    </p>
                    <p className="mt-1.5 text-sm text-muted">
                        Detectamos una alerta relacionada con <b className="font-semibold text-body">Carlos</b> en
                        Instagram. Categoría: contacto insistente · 1 reporte registrado.
                    </p>
                </div>
                <div className="rounded-xl bg-papel p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted">En la app</p>
                    <p className="mt-2 text-sm text-body">
                        <b className="font-semibold">Alerta sobre Carlos</b>
                    </p>
                    <p className="mt-1.5 text-sm text-muted">
                        1 reporte registrado en Instagram. Toca para ver el expediente.
                    </p>
                </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-papel p-4">
                <input
                    type="checkbox"
                    checked={avisoCorreo}
                    onChange={onCambiar}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-pino"
                />
                <span className="text-sm text-body">
                    Avisarme al correo cuando alguien reporte a una persona de mi círculo
                    <span className="mt-0.5 block text-muted">
                        Como máximo un correo al día. En la app lo ves siempre.
                    </span>
                </span>
            </label>
        </section>
    );
}
