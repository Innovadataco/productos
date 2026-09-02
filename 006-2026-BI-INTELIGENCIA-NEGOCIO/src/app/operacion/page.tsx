import Topbar from "@/components/bi/Topbar";
import OperacionBI from "@/components/bi/OperacionBI";
import { getMinutosBadgeNuevo, getOperacion } from "@/lib/bi/operacion";
import { alertasSinAsignarPorColegio, getCapacidad } from "@/lib/bi/capacidad";

// Datos en vivo de la réplica: nunca prerender estático.
export const dynamic = "force-dynamic";

export default async function OperacionPage() {
    const [{ filas, resumen }, minutosBadgeNuevo, capacidad, sinAsignar] = await Promise.all([
        getOperacion(),
        getMinutosBadgeNuevo(),
        getCapacidad(),
        alertasSinAsignarPorColegio(),
    ]);

    return (
        <main className="relative z-10 max-w-[1180px] mx-auto px-6 pt-8 pb-20">
            <Topbar titulo="Operación" acento="en vivo" activo="operacion" />
            <OperacionBI
                filas={filas}
                resumen={resumen}
                minutosBadgeNuevo={minutosBadgeNuevo}
                capacidad={capacidad}
                // Un Map no cruza la frontera server→client: objeto plano.
                sinAsignarPorColegio={Object.fromEntries(sinAsignar)}
            />
        </main>
    );
}
