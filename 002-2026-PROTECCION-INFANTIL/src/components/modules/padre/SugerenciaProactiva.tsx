import type { SugerenciaHome } from "@/lib/padre/home";

interface SugerenciaProactivaProps {
    sugerencia: SugerenciaHome;
}

const prioridadClase = {
    baja: "border-l-4 border-pino",
    media: "border-l-4 border-ambar",
    alta: "border-l-4 border-rubi",
} as const;

export function SugerenciaProactiva({ sugerencia }: SugerenciaProactivaProps) {
    return (
        <section aria-labelledby="sugerencia-titulo" className={`glass rounded-3xl p-6 ${prioridadClase[sugerencia.prioridad]}`}>
            <h2 id="sugerencia-titulo" className="text-lg font-semibold text-body">
                Sugerencia del día
            </h2>
            <p className="mt-2 text-sm text-body">{sugerencia.texto}</p>
            {sugerencia.accionHref && sugerencia.accionTexto && (
                <a
                    href={sugerencia.accionHref}
                    className="mt-4 inline-flex rounded-xl bg-cielo px-4 py-2 text-sm font-semibold text-white hover:bg-cielo/90"
                >
                    {sugerencia.accionTexto}
                </a>
            )}
        </section>
    );
}
