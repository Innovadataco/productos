"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * SPEC-751 T010 · La PANTALLA de declaración «oír al menor» (Decreto 1377/2013 art. 12), forma de
 * Diseño FORMA-SPEC751-T010 (d485493). El titular declara, UNO POR UNO por cada menor activo
 * pendiente, haber oído al menor para la versión vigente del consentimiento. Se persiste por el
 * CAMINO REAL (`POST /api/audiencia-menor/declarar`, firmado SPEC-781); al terminar TODOS,
 * `POST /api/vigencia/refresh` re-sella el flag de la cookie para que el muro deje pasar.
 *
 * 🛑 El CUERPO de la declaración y la FRASE de afirmación son [ABOGADO] — PLACEHOLDER marcado, NO
 * definitivo (es un acto jurídico; lo define el equipo legal de Jelkin). La pantalla NO los presenta
 * como texto final (patrón §3 de 827). Lo MÍO (forma de Diseño) es: el título que nombra al hijo, el
 * encuadre del porqué, la afirmación explícita NO pre-marcada que habilita «Declarar», el estado de
 * éxito cálido y el enlace «¿por qué?». Voz tú (padre).
 */
export interface MenorPendiente {
    hijoId: string;
    nombre: string;
}

export function DeclararAudiencia({
    menores,
    continuarHref,
}: {
    menores: MenorPendiente[];
    /** Destino del «Continuar» del éxito tras declarar el ÚLTIMO pendiente (acción de origen). */
    continuarHref: string;
}) {
    const router = useRouter();
    const [idx, setIdx] = useState(0);
    const [afirmado, setAfirmado] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [declarado, setDeclarado] = useState(false); // éxito del menor actual

    const menor = menores[idx];
    const total = menores.length;
    const esUltimo = idx >= total - 1;

    // Defensivo: la página solo monta esto con lista no vacía (si no, muestra «nada pendiente»).
    if (!menor) return null;

    async function declarar() {
        if (!menor) return;
        setError(null);
        setEnviando(true);
        try {
            const res = await fetch("/api/audiencia-menor/declarar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hijoId: menor.hijoId }),
            });
            if (!res.ok) {
                const cuerpo = await res.json().catch(() => null);
                setError(cuerpo?.error?.message ?? "No se pudo registrar la declaración. Intenta de nuevo.");
                setEnviando(false);
                return;
            }
            setDeclarado(true);
            setEnviando(false);
        } catch {
            setError("No se pudo registrar la declaración. Revisa la conexión e intenta de nuevo.");
            setEnviando(false);
        }
    }

    async function continuar() {
        if (!esUltimo) {
            // Siguiente pendiente: la afirmación arranca EN LIMPIO (nada viene consentido de fábrica).
            setIdx((i) => i + 1);
            setAfirmado(false);
            setDeclarado(false);
            setError(null);
            return;
        }
        // Último: ya no queda audiencia pendiente → re-sella la cookie (best-effort) y vuelve al origen.
        setEnviando(true);
        await fetch("/api/vigencia/refresh", { method: "POST" }).catch(() => {});
        router.push(continuarHref);
    }

    if (declarado) {
        return (
            <section className="mx-auto max-w-xl p-4">
                <h1 className="text-xl font-semibold text-body">Listo — gracias por escuchar a {menor.nombre}</h1>
                <p className="mt-2 text-sm text-body/80">Ya puedes continuar con lo que estabas haciendo.</p>
                <div className="mt-5">
                    <Button type="button" onClick={continuar} isLoading={enviando}>
                        Continuar
                    </Button>
                </div>
            </section>
        );
    }

    return (
        <section className="mx-auto max-w-xl p-4">
            {total > 1 ? <p className="text-xs font-medium text-body/60">Paso {idx + 1} de {total}</p> : null}
            <h1 className="mt-1 text-xl font-semibold text-body">Escuchar a {menor.nombre}</h1>

            <p className="mt-3 text-sm text-body/80">
                Este es el paso por <span className="font-medium">{menor.nombre}</span>. La ley pide que {menor.nombre},
                según su edad, sepa y esté de acuerdo con que lo cuidemos aquí — escucharlo es proteger sus datos, no un
                trámite de más.
            </p>

            {/* 🛑 [ABOGADO] · PLACEHOLDER — el CUERPO de la declaración NO es texto final. Lo define el equipo legal
                de Jelkin (acto jurídico, Decreto 1377/2013 art. 12). La pantalla no lo presenta como definitivo. */}
            <div className="mt-4 rounded-xl border border-tinta/10 bg-tinta/[0.03] p-4">
                <p className="text-sm font-semibold text-body">⚖️ [ABOGADO · cuerpo de la declaración de audiencia]</p>
                <p className="mt-1 text-sm text-body/70">
                    Marcador: el texto exacto que lees y declaras lo define el equipo legal. Es un acto jurídico. Hasta
                    entonces es solo un marcador — no es el texto final.
                </p>
            </div>

            {/* Afirmación: la CONDUCTA la fija la forma (explícita, NO pre-marcada; habilita «Declarar»). La FRASE es
                [ABOGADO] — placeholder, no presentada como definitiva. */}
            <label className="mt-4 flex items-start gap-3 rounded-xl border border-tinta/10 p-4">
                <input
                    type="checkbox"
                    checked={afirmado}
                    onChange={(e) => setAfirmado(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-cielo"
                />
                <span className="text-sm text-body/80">
                    [ABOGADO · frase de afirmación] — marca esta casilla para declarar. (Texto pendiente del equipo
                    legal; no es la frase final.)
                </span>
            </label>

            {error ? (
                <p className="mt-3 text-sm font-medium text-estado-rubi" role="alert">
                    {error}
                </p>
            ) : null}

            <div className="mt-5">
                <Button type="button" onClick={declarar} disabled={!afirmado} isLoading={enviando}>
                    Declarar
                </Button>
            </div>

            <details className="mt-5 text-sm text-body/70">
                <summary className="cursor-pointer font-medium text-body/80">¿Por qué me piden esto?</summary>
                <p className="mt-2">
                    La ley (Decreto 1377 de 2013, art. 12) pide que cada niño, niña o adolescente, según su edad, sepa y
                    esté de acuerdo con que cuidemos sus datos aquí. Escuchar a {menor.nombre} es parte de proteger sus
                    datos, no un trámite de más.
                </p>
            </details>
        </section>
    );
}
