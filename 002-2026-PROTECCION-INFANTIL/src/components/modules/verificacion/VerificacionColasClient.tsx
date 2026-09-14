"use client";

/**
 * SPEC-693 (I-416) · Las DOS colas del Verificador, en pestañas (FORMA de Diseño, 13-09).
 *
 * «Solicitudes nuevas» (por defecto — ahí hay alguien esperando para poder trabajar) y
 * «Documentos nuevos» (de profesionales que YA atienden — nadie está detenido). Pestañas
 * separadas a propósito: son dos preguntas distintas y mezclarlas haría abrir una con el
 * modelo mental de la otra. El contador va EN la pestaña.
 *
 * Las dos listas se montan a la vez (cada una se auto-carga y reporta su conteo) y se
 * ocultan con `hidden`, así el contador de ambas está listo sin re-fetch al cambiar.
 */
import { useCallback, useState } from "react";
import { VerificacionColaClient } from "./VerificacionColaClient";
import { RenovacionesColaClient } from "./RenovacionesColaClient";

type Pestana = "solicitudes" | "documentos";

function Contador({ n }: { n: number | null }) {
    if (n === null) return null;
    return (
        <span className="ml-2 rounded-full bg-tinta/10 px-2 py-0.5 text-xs font-medium text-body">{n}</span>
    );
}

export function VerificacionColasClient() {
    const [pestana, setPestana] = useState<Pestana>("solicitudes");
    const [conteoSolicitudes, setConteoSolicitudes] = useState<number | null>(null);
    const [conteoDocumentos, setConteoDocumentos] = useState<number | null>(null);

    // Referencias estables: el efecto de cada lista depende de `onLoaded`.
    const onSolicitudes = useCallback((n: number) => setConteoSolicitudes(n), []);
    const onDocumentos = useCallback((n: number) => setConteoDocumentos(n), []);

    return (
        <div className="space-y-5">
            <div role="tablist" aria-label="Colas del Verificador" className="flex flex-wrap gap-2">
                <button
                    type="button"
                    role="tab"
                    aria-selected={pestana === "solicitudes"}
                    onClick={() => setPestana("solicitudes")}
                    className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition ${
                        pestana === "solicitudes"
                            ? "bg-tinta/10 text-body ring-2 ring-cielo/30"
                            : "bg-tinta/5 text-subtle hover:bg-tinta/10 hover:text-body"
                    }`}
                >
                    Solicitudes nuevas
                    <Contador n={conteoSolicitudes} />
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={pestana === "documentos"}
                    onClick={() => setPestana("documentos")}
                    className={`inline-flex flex-col items-start rounded-2xl px-4 py-2 text-sm font-medium transition ${
                        pestana === "documentos"
                            ? "bg-tinta/10 text-body ring-2 ring-cielo/30"
                            : "bg-tinta/5 text-subtle hover:bg-tinta/10 hover:text-body"
                    }`}
                >
                    <span className="inline-flex items-center">
                        Documentos nuevos
                        <Contador n={conteoDocumentos} />
                    </span>
                    {/* El subtítulo es lo que evita que se lea como una solicitud más (FORMA §1). */}
                    <span className="text-xs font-normal text-subtle">De profesionales que ya están atendiendo</span>
                </button>
            </div>

            <div role="tabpanel" hidden={pestana !== "solicitudes"}>
                <VerificacionColaClient onLoaded={onSolicitudes} />
            </div>
            <div role="tabpanel" hidden={pestana !== "documentos"}>
                <RenovacionesColaClient onLoaded={onDocumentos} />
            </div>
        </div>
    );
}
