import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import GuiasPendientesClient from "./GuiasPendientesClient";
import type { RolUsuario } from "@prisma/client";
import { puedeAccederAModulo } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";

// SPEC-381 (I-276): el subnav lo monta ../layout.tsx. El h1 propio de la
// pantalla queda debajo de la barra, en la misma posición para las 5.
export default async function AdminComiteGuiasPendientesPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    const rol = (payload?.rol as RolUsuario) ?? "COMITE_VALIDACION";

    if (!(await puedeAccederAModulo(rol, "comite_guias_accion"))) {
        return <SinAccesoModulo />;
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-body">Guías de acción pendientes</h1>
                <p className="text-sm text-muted">Revise, apruebe o rechace las guías enviadas por el administrador.</p>
            </div>
            <GuiasPendientesClient />
        </div>
    );
}
