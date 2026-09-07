import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { AdminNav } from "@/components/modules/AdminNav";
import { AdminVersionBadge } from "@/components/modules/AdminVersionBadge";
import { modulosPermitidosParaRol } from "@/lib/permisos-modulos";

type AdminRol = "ADMIN" | "OPERADOR" | "COMITE_VALIDACION";

/**
 * SPEC-287 (002-PI-187): layout UI puro. La sesión, el consentimiento, la
 * vigencia y el cambio-de-contraseña se guardan en `middleware.ts`; este layout
 * NO ejecuta `redirect(...)` — el ratchet estático lo bloquea.
 *
 * SPEC-571 (I-353): la autorización POR ROL NO se aplica en runtime — ni el
 * middleware ni este layout la imponen (el comentario anterior decía que los
 * «permisos de rol» vivían en el middleware; era FALSO y por eso nadie miró).
 * La guardia de rol vive EN CADA PÁGINA (`verifyAuth(<rol>)`); las páginas que
 * aún no la tienen son deuda vigilada por `guardia-rol-pagina.candado.test.ts`.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    const rol = (payload?.rol as string | undefined) ?? "ADMIN";
    const permitidos = await modulosPermitidosParaRol(rol);

    return (
        // SPEC-460: el acento del territorio IDC es ámbar-ink (theme-admin).
        <div className="theme-admin flex min-h-screen">
            <AdminNav rol={rol as AdminRol} modulosPermitidos={[...permitidos]} />
            <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                {children}
                <AdminVersionBadge />
            </main>
        </div>
    );
}
