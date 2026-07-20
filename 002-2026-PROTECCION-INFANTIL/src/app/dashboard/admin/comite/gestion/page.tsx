import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { ComiteSubNav } from "../components/ComiteSubNav";
import GestionPageClient from "./GestionPageClient";
import type { RolUsuario } from "@prisma/client";

export default async function AdminComiteGestionPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    const rol = (payload?.rol as RolUsuario) ?? "COMITE_VALIDACION";

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <ComiteSubNav rol={rol} />
            <GestionPageClient />
        </div>
    );
}
