import type { HitoCaso } from "@/lib/colegio/seguimiento";

/**
 * SPEC-159 (US1, FR-003/FR-005) — Línea de tiempo del caso: solo verdades.
 * Cada hito cumplido muestra su fecha real (trazable a su fuente: alerta,
 * AuditLog, RegistroAvisoColegio, EventoMatch); el hito que no ocurrió aparece
 * como pendiente con su estado honesto — nunca un check falso.
 */

interface TimelineCasoProps {
    hitos: HitoCaso[];
}

function fechaLegible(iso: string): string {
    return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export function TimelineCaso({ hitos }: TimelineCasoProps) {
    return (
        <section aria-label="Línea de tiempo del caso" className="glass rounded-[var(--radio-card)] p-6 sm:p-8">
            <h2 className="titular-seccion text-body">Línea de tiempo</h2>
            <ol className="mt-4 space-y-4">
                {hitos.map((hito) => (
                    <li key={hito.tipo} className="flex items-start gap-3">
                        <span
                            aria-hidden="true"
                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                hito.estado === "cumplido"
                                    ? "bg-pino/15 text-estado-pino ring-1 ring-pino/30"
                                    : "bg-tinta/5 text-subtle ring-1 ring-tinta/10"
                            }`}
                        >
                            {hito.estado === "cumplido" ? "✓" : "○"}
                        </span>
                        <div className="min-w-0">
                            <p className={`text-sm ${hito.estado === "cumplido" ? "text-body" : "text-subtle"}`}>
                                {hito.detalle}
                            </p>
                            <p className="microetiqueta mt-0.5">
                                {hito.fecha ? fechaLegible(hito.fecha) : "Pendiente"}
                            </p>
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}
