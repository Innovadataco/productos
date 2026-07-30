import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { DocsCapaPage } from "@/components/modules/docs/DocsCapaPage";

const ROLES_CAPA_TECNICA = new Set(["ADMIN", "SCHOOL_ADMIN"]);

/**
 * /docs/tecnico — Capa 3 del módulo de documentación (SPEC-017): solo
 * ADMIN/SCHOOL_ADMIN y equipo técnico. Sin sesión → /login; otro rol → /docs.
 */
export default async function DocsTecnicoPage({
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
    const rol = payload?.rol as string | undefined;
    if (!rol || !ROLES_CAPA_TECNICA.has(rol)) {
        redirect("/docs");
    }

    return <DocsCapaPage capa={3} rol={rol} docRuta={doc} />;
}
