import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { ComiteSubNav } from "../components/ComiteSubNav";
import GuiasPendientesClient from "./GuiasPendientesClient";
import type { RolUsuario } from "@prisma/client";
import { modulosPermitidosParaRol } from "@/lib/permisos-modulos";
import { puedeAccederAModulo } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";

export default async function AdminComiteGuiasPendientesPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    const rol = (payload?.rol as RolUsuario) ?? "COMITE_VALIDACION";

    if (!(await puedeAccederAModulo(rol, "comite_guias_accion"))) {
        return <SinAccesoModulo />;
    }
    const permitidos = await modulosPermitidosParaRol(rol);

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-body">Guías de acción pendientes</h1>
                <p className="text-sm text-muted">Revisá, aprobá o rechazá las guías enviadas por el administrador.</p>
            </div>
            <ComiteSubNav rol={rol} modulosPermitidos={[...permitidos]} />
            <GuiasPendientesClient />
        </div>
    );
}
