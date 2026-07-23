import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { ComiteSubNav } from "../components/ComiteSubNav";
import GestionPageClient from "./GestionPageClient";
import type { RolUsuario } from "@prisma/client";
import { modulosPermitidosParaRol } from "@/lib/permisos-modulos";
import { puedeAccederAModulo } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";

export default async function AdminComiteGestionPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    const rol = (payload?.rol as RolUsuario) ?? "COMITE_VALIDACION";

    if (!(await puedeAccederAModulo(rol, "comite"))) {
        return <SinAccesoModulo />;
    }
    const permitidos = await modulosPermitidosParaRol(rol);

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <ComiteSubNav modulosPermitidos={[...permitidos]} />
            <GestionPageClient />
        </div>
    );
}
