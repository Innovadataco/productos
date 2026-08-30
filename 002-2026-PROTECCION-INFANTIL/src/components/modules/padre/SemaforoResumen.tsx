import type { SemaforoHomeItem } from "@/lib/padre/home";

interface SemaforoResumenProps {
    contactos: SemaforoHomeItem[];
}

const clasesColor = {
    VERDE: "bg-green-500",
    AMBAR: "bg-amber-500",
    ROJO: "bg-red-500",
} as const;

const textoColor = {
    VERDE: "Sin alertas",
    AMBAR: "Revisar",
    ROJO: "Atención",
} as const;

export function SemaforoResumen({ contactos }: SemaforoResumenProps) {
    if (contactos.length === 0) {
        return (
            <div className="glass rounded-3xl p-6 text-center">
                <h2 className="text-lg font-semibold text-body">Semáforo de atención</h2>
                <p className="mt-2 text-sm text-muted">
                    Agrega contactos para ver su nivel de atención.
                </p>
            </div>
        );
    }

    return (
        <section aria-labelledby="semaforo-resumen-titulo" className="glass rounded-3xl p-6">
            <h2 id="semaforo-resumen-titulo" className="text-lg font-semibold text-body">
                Semáforo de atención
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {contactos.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-tinta/5 p-4">
                        <span
                            className={`h-4 w-4 shrink-0 rounded-full ${clasesColor[c.color]}`}
                            aria-hidden="true"
                        />
                        <div className="min-w-0">
                            <p className="truncate font-medium text-body">{c.etiqueta ?? "Sin nombre"}</p>
                            <p className="text-xs text-muted">
                                {textoColor[c.color]} · {c.totalReportes} reporte{c.totalReportes === 1 ? "" : "s"}
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
