import Topbar from "@/components/bi/Topbar";
import OperacionBI from "@/components/bi/OperacionBI";
import { getMinutosBadgeNuevo, getOperacion } from "@/lib/bi/operacion";

// Datos en vivo de la réplica: nunca prerender estático.
export const dynamic = "force-dynamic";

export default async function OperacionPage() {
    const [{ filas, resumen }, minutosBadgeNuevo] = await Promise.all([
        getOperacion(),
        getMinutosBadgeNuevo(),
    ]);

    return (
        <main className="relative z-10 max-w-[1180px] mx-auto px-6 pt-8 pb-20">
            <Topbar titulo="Operación" acento="en vivo" activo="operacion" />
            <OperacionBI
                filas={filas}
                resumen={resumen}
                minutosBadgeNuevo={minutosBadgeNuevo}
            />
        </main>
    );
}
