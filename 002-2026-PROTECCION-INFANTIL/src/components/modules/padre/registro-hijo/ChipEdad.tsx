"use client";

/**
 * SPEC-599 · Selector de edad como chips (5-17, catálogo real `edadesMenor()`),
 * en reemplazo del <select> del alta. Opcional: `null` = sin especificar; volver
 * a pulsar el chip activo lo desmarca. El año guardado se DERIVA de la edad en
 * el orquestador (anioDesdeEdad) — misma regla de SPEC-361/F8.
 */
import { edadesMenor } from "@/lib/padre/documento-menor";

export function ChipEdad({
    value,
    onChange,
    etiquetaId,
}: {
    value: number | null;
    onChange: (edad: number | null) => void;
    etiquetaId: string;
}) {
    return (
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={etiquetaId}>
            {edadesMenor().map((edad) => {
                const activo = value === edad;
                return (
                    <button
                        key={edad}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => onChange(activo ? null : edad)}
                        className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition ease-barrido ${
                            activo
                                ? "border-pino bg-pino text-papel shadow-[0_3px_10px_rgb(var(--pino-rgb)/0.3)]"
                                : "border-tinta/15 bg-papel/60 text-muted hover:-translate-y-0.5 hover:border-pino/55 hover:text-body"
                        }`}
                    >
                        {edad === 1 ? "1 año" : `${edad} años`}
                    </button>
                );
            })}
        </div>
    );
}
