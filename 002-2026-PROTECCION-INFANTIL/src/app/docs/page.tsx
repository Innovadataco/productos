import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { DocsCapaPage } from "@/components/modules/docs/DocsCapaPage";

/**
 * /docs — Capa 1 del módulo de documentación (SPEC-017): pública, sin login.
 * La sesión solo se usa para ofrecer en la nav las capas a las que el usuario
 * tiene acceso.
 */
export default async function DocsPage({
    searchParams,
}: {
    searchParams: Promise<{ doc?: string }>;
}) {
    const { doc } = await searchParams;
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;

    return <DocsCapaPage capa={1} rol={(payload?.rol as string) ?? null} docRuta={doc} />;
}
