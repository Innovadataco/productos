import Link from "next/link";
import { GraficoProteccion, type HijoGrafico } from "./GraficoProteccion";
import { LineaEstadoProteccion, type EstadoClasificador } from "./LineaEstadoProteccion";
import { BloqueHuecoCobertura } from "./BloqueHuecoCobertura";

/**
 * SPEC-660 · «A quién protejo» — vista de ENTERARSE (Proceso 2, ola-1).
 *
 * CERO formularios acá: el CRUD (registrar/editar menores) vive en Mi perfil ›
 * «Menores de edad» (Fase C, Dev 3). Esta pantalla contesta «¿cómo están?» — el
 * gráfico, la línea de estado (con la asimetría del motor, I-396), el hueco de
 * cobertura, y un enlace a configurar. Presentacional: la pantalla (server) deriva
 * y le pasa datos ya limpios.
 */
const RUTA_PERFIL_MENORES = "/dashboard/padre/perfil#menores";

export interface AQuienProtejoData {
    hijos: HijoGrafico[];
    estadoClasificador: EstadoClasificador;
    circulo: { personas: number; todasTranquilas: boolean };
}

function Titulo() {
    return (
        <h1 className="text-3xl font-bold text-body md:text-4xl">
            A quién <span className="text-estado-pino">protejo</span>
        </h1>
    );
}

export function AQuienProtejoView({ hijos, estadoClasificador, circulo }: AQuienProtejoData) {
    if (hijos.length === 0) {
        return (
            <div className="mx-auto w-full max-w-xl space-y-4 p-4 text-center">
                <Titulo />
                <div className="rounded-2xl border border-tinta/10 bg-tinta/[0.02] p-8">
                    <p className="text-body">Todavía no registraste a ningún menor.</p>
                    <p className="mt-1 text-sm text-muted">Registra a tus hijos y sus cuentas para poder cuidarlos.</p>
                    <Link
                        href={RUTA_PERFIL_MENORES}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-pino px-4 py-2.5 text-sm font-semibold text-white"
                    >
                        Agregar un menor
                    </Link>
                </div>
            </div>
        );
    }

    const huecos = hijos.filter((h) => h.activo && !h.tieneCuentasActivas).map((h) => ({ id: h.id, nombre: h.nombre }));

    return (
        <div className="mx-auto w-full max-w-xl space-y-4 p-4">
            <Titulo />
            <GraficoProteccion hijos={hijos} motorVivo={estadoClasificador.motorVivo} circuloPersonas={circulo.personas} />
            <LineaEstadoProteccion estado={estadoClasificador} />
            {circulo.personas > 0 && (
                <p className="flex items-center gap-2 rounded-xl bg-tinta/[0.035] px-3 py-2 text-sm text-muted">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-pino" aria-hidden />
                    <span>
                        Tu círculo: <b className="text-body">{circulo.personas} {circulo.personas === 1 ? "persona cercana" : "personas cercanas"}</b>
                        {circulo.todasTranquilas ? " · todas tranquilas" : ""}
                    </span>
                </p>
            )}
            <BloqueHuecoCobertura hijos={huecos} />
            <Link href={RUTA_PERFIL_MENORES} className="inline-flex items-center gap-1.5 text-sm font-semibold text-estado-cielo hover:underline">
                Gestionar en tu perfil →
            </Link>
        </div>
    );
}
