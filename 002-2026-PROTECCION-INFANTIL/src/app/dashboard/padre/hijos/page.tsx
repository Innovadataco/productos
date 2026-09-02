// SPEC-325 (002-PI-225) · "A quién protejo" — módulo de hijos/familiares del padre.
import { MisHijos } from "@/components/modules/padre/MisHijos";
import { getParametroSistemaValor } from "@/lib/parametros";

export default async function PadreHijosPage() {
    // SPEC-361 (F6): el cupo visible sale del parámetro, igual que en el camino.
    const maximo = parseInt((await getParametroSistemaValor("padre.hijos.maximo")) ?? "5", 10);
    return (
        <div className="mx-auto w-full max-w-3xl p-4">
            <MisHijos maximoActivos={maximo} />
        </div>
    );
}
