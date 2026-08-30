import type { ResumenCirculoHome } from "@/lib/padre/home";

interface ResumenCirculoProps {
    resumen: ResumenCirculoHome;
}

export function ResumenCirculo({ resumen }: ResumenCirculoProps) {
    const { totalContactos, sinReportes, enRevision, clasificados } = resumen;

    if (totalContactos === 0) {
        return (
            <div className="glass rounded-3xl p-6 text-center">
                <h2 className="text-lg font-semibold text-body">Círculo de confianza</h2>
                <p className="mt-2 text-sm text-muted">
                    Aún no tienes contactos. Agrega uno para empezar a monitorear.
                </p>
            </div>
        );
    }

    return (
        <section aria-labelledby="resumen-circulo-titulo" className="glass rounded-3xl p-6">
            <h2 id="resumen-circulo-titulo" className="text-lg font-semibold text-body">
                Círculo de confianza
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-2xl bg-tinta/5 p-4 text-center">
                    <p className="text-2xl font-bold text-body">{totalContactos}</p>
                    <p className="text-xs text-muted">Total contactos</p>
                </div>
                <div className="rounded-2xl bg-green-500/10 p-4 text-center">
                    <p className="text-2xl font-bold text-green-700">{sinReportes}</p>
                    <p className="text-xs text-muted">Sin reportes</p>
                </div>
                <div className="rounded-2xl bg-amber-500/10 p-4 text-center">
                    <p className="text-2xl font-bold text-amber-700">{enRevision}</p>
                    <p className="text-xs text-muted">En revisión</p>
                </div>
                <div className="rounded-2xl bg-red-500/10 p-4 text-center">
                    <p className="text-2xl font-bold text-red-700">{clasificados}</p>
                    <p className="text-xs text-muted">Clasificados</p>
                </div>
            </div>
        </section>
    );
}
