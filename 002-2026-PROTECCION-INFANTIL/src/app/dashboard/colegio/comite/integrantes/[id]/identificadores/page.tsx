import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { IdentificadoresIntegranteClient } from "@/components/modules/colegio/comite/IdentificadoresIntegranteClient";

/**
 * SPEC-380 (PR B · C4/D-100) — gestión de identificadores del integrante del
 * comité. Acceso: SCHOOL_ADMIN o COMITE_CONVIVENCIA. El tenant se resuelve en
 * el endpoint por la cuenta.
 */
const ROLES_PERMITIDOS = new Set(["SCHOOL_ADMIN", "COMITE_CONVIVENCIA"]);

export default async function IdentificadoresIntegrantePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    if (!token) redirect("/login");
    const payload = await verifyToken(token);
    const rol = payload?.rol as string | undefined;
    if (!payload?.sub || !rol || !ROLES_PERMITIDOS.has(rol)) redirect("/login");
    return <IdentificadoresIntegranteClient integranteId={id} />;
}
