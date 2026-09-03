import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { ComiteBandeja } from "@/components/modules/ComiteBandeja";
import type { RolUsuario } from "@prisma/client";
import { puedeAccederAModulo } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";

// SPEC-381 (I-276): la barra de pestañas la monta ./layout.tsx (misma posición
// vertical en las 5 pantallas). Esta pantalla solo pinta su título y contenido.
export default async function ComitePage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    const rol = (payload?.rol as RolUsuario) ?? "COMITE_VALIDACION";

    if (!(await puedeAccederAModulo(rol, "comite_bandeja"))) {
        return <SinAccesoModulo />;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-body">Comité de Validación</h1>
                <p className="text-sm text-muted">Casos escalados por los operadores para revisión especializada.</p>
            </div>
            <ComiteBandeja />
        </div>
    );
}
