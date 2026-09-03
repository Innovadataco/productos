import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import GestionPageClient from "./GestionPageClient";
import type { RolUsuario } from "@prisma/client";
import { puedeAccederAModulo } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";

// SPEC-381 (I-276): el subnav lo monta ../layout.tsx.
export default async function AdminComiteGestionPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    const rol = (payload?.rol as RolUsuario) ?? "COMITE_VALIDACION";

    if (!(await puedeAccederAModulo(rol, "comite"))) {
        return <SinAccesoModulo />;
    }

    return (
        <div className="mx-auto max-w-6xl">
            <GestionPageClient />
        </div>
    );
}
