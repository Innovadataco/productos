import { redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";

/**
 * SPEC-218 (002-PI-118): el dashboard de analítica dinero-vs-valor vive como
 * tab del área Estadísticas (D-72 reutilizar, sin ruta paralela). Esta ruta —
 * el stub dejado por SPEC-212 — redirige a su ubicación definitiva.
 */
export default async function AnaliticaPage() {
    const admin = await verifyAuth("ADMIN").catch(() => null);
    if (!admin) return <SinAccesoModulo />;
    await assertModulo(admin, "pagos_admin");

    redirect("/dashboard/admin/estadisticas/dinero-vs-valor");
}
