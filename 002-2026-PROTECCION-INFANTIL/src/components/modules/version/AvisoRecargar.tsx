"use client";

/**
 * SPEC-548 (I-337) · Caso (b): la navegación falló porque el código que se pidió
 * ya no está en el servidor (se cruzó un despliegue). La pantalla quedó a
 * medias — Calidad vio que hasta el pie desaparece. La salida es RECARGAR.
 *
 * Forma cerrada por Diseño: aviso EN EL LUGAR del hueco (no un cartel global),
 * panel `surface` con borde neutro y, para señalar, ámbar suave (atención
 * calmada) — NUNCA rojo. Botón cielo para la acción. No descartable (sin
 * recargar la sección no funciona), pero NO tapa lo que sí cargó: el error.tsx
 * lo pinta en el lugar del contenido, dejando header y pie intactos.
 *
 * `variante="chunk"` = el caso del despliegue (copia exacta que tranquiliza: no
 * perdiste nada). `variante="generico"` = cualquier otro fallo de render: mismo
 * tono calmo, sin rubi ni «Error»/«Sesión expirada», con la opción de reintentar
 * antes de recargar. El pie perdido es un síntoma de (b): lo resuelve la
 * recarga, no se arregla aparte.
 */
type Props = {
    variante?: "chunk" | "generico";
    onReintentar?: () => void;
};

export function AvisoRecargar({ variante = "chunk", onReintentar }: Props) {
    const esChunk = variante === "chunk";

    return (
        <div className="mx-auto my-8 w-full max-w-md px-4">
            <div
                role="alert"
                aria-live="polite"
                className="glass rounded-[var(--radio-card)] border border-ambar/30 p-6 text-center sm:p-8"
            >
                <div
                    className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ambar/10 text-estado-ambar"
                    aria-hidden="true"
                >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                </div>
                <h2 className="mt-4 text-base font-semibold text-body">
                    {esChunk
                        ? "Esta parte no se pudo cargar porque la app se actualizó."
                        : "No pudimos mostrar esta parte."}
                </h2>
                <p className="mt-2 text-sm text-muted">
                    {esChunk
                        ? "Recarga para verla — lo que ya estabas viendo sigue aquí."
                        : "Puedes intentarlo de nuevo; si sigue igual, recarga la página."}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    {!esChunk && onReintentar && (
                        <button
                            type="button"
                            onClick={onReintentar}
                            className="rounded-xl border border-cielo/40 px-4 py-2 text-sm font-semibold text-cielo transition hover:bg-cielo/10 dark:border-cielo/30"
                        >
                            Reintentar
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="rounded-xl bg-cielo px-4 py-2 text-sm font-semibold text-white transition hover:bg-cielo/90"
                    >
                        Recargar la página
                    </button>
                </div>
            </div>
        </div>
    );
}
