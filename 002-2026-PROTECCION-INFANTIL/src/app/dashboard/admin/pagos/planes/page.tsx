import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { PlanesPagosTabs } from "@/components/modules/PlanesPagosTabs";

export default async function PlanesPage() {
    const admin = await verifyAuth("ADMIN").catch(() => null);
    if (!admin) return <SinAccesoModulo />;
    await assertModulo(admin, "pagos_admin");

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-body">Planes y configuración de pagos</h2>
            </div>
            <PlanesPagosTabs />
        </div>
    );
}
