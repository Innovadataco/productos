import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { DocsCapaPage } from "@/components/modules/docs/DocsCapaPage";

/**
 * /docs/operar — Capa 2 del módulo de documentación (SPEC-017): solo usuarios
 * autenticados (cualquier rol). Sin sesión → /login.
 */
export default async function DocsOperarPage({
    searchParams,
}: {
    searchParams: Promise<{ doc?: string }>;
}) {
    const { doc } = await searchParams;
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    if (!token) {
        redirect("/login");
    }
    const payload = await verifyToken(token);
    if (!payload?.rol) {
        redirect("/login");
    }

    return <DocsCapaPage capa={2} rol={payload.rol as string} docRuta={doc} />;
}
