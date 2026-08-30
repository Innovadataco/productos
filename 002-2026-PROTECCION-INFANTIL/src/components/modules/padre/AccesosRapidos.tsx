import type { AccesoRapido } from "@/lib/padre/home";

interface AccesosRapidosProps {
    accesos: AccesoRapido[];
}

export function AccesosRapidos({ accesos }: AccesosRapidosProps) {
    return (
        <section aria-labelledby="accesos-rapidos-titulo">
            <h2 id="accesos-rapidos-titulo" className="text-lg font-semibold text-body">
                Accesos rápidos
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {accesos.map((a) => (
                    <a
                        key={a.href}
                        href={a.href}
                        target={a.externo ? "_blank" : undefined}
                        rel={a.externo ? "noopener noreferrer" : undefined}
                        className="glass rounded-2xl p-4 text-center text-sm font-medium text-body hover:bg-tinta/5"
                    >
                        {a.label}
                    </a>
                ))}
            </div>
        </section>
    );
}
