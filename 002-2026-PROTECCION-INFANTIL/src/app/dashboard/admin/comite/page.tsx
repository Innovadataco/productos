import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { ComiteBandeja } from "@/components/modules/ComiteBandeja";
import { ComiteSubNav } from "./components/ComiteSubNav";
import type { RolUsuario } from "@prisma/client";

export default async function ComitePage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    const rol = (payload?.rol as RolUsuario) ?? "COMITE_VALIDACION";

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-body">Comité de Validación</h1>
                <p className="text-sm text-muted">Casos escalados por los operadores para revisión especializada.</p>
            </div>
            <ComiteSubNav rol={rol} />
            <ComiteBandeja />
        </div>
    );
}
