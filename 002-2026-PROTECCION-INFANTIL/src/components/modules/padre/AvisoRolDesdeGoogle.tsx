"use client";

/**
 * SPEC-631 §3 (Diseño) — aviso «de una vez» cuando alguien entró con Google eligiendo el registro de
 * PROFESIONAL pero el correo YA era una cuenta de FAMILIA: entra a su rol real (gate 5, no promueve) y
 * aterriza acá. Info (no error), voz tú, DESCARTABLE (no bloquea, no es interstitial). Se muestra SOLO
 * con la marca `?aviso=cuenta-familia` que pone el callback; una vez descartado, no vuelve.
 *
 * Sin enlace «cómo trabajar como profesional»: no hay un camino self-serve verificado hoy, y un enlace
 * muerto sería peor que su ausencia — la segunda frase ya orienta ([[dev-funcion-construida-sin-cablear]]).
 */
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alerta } from "@/components/ui/Alerta";

export function AvisoRolDesdeGoogle() {
    const params = useSearchParams();
    const [descartado, setDescartado] = useState(false);
    if (descartado || params.get("aviso") !== "cuenta-familia") return null;

    return (
        <div className="mx-auto mb-4 max-w-5xl px-4">
            <Alerta tono="info" role="status">
                <div className="flex items-start justify-between gap-3">
                    <p>
                        Entraste con Google, y este correo ya tiene una cuenta de familia — por eso te
                        llevamos a tu espacio de familia. ¿Buscabas el acceso para profesionales? Ese es un
                        registro aparte, con verificación.
                    </p>
                    <button
                        type="button"
                        onClick={() => setDescartado(true)}
                        aria-label="Descartar aviso"
                        className="shrink-0 rounded p-1 text-lg leading-none text-muted hover:text-body"
                    >
                        ×
                    </button>
                </div>
            </Alerta>
        </div>
    );
}
