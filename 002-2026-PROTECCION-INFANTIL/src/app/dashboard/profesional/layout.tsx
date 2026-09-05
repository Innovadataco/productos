import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { AdminNav } from "@/components/modules/AdminNav";
import { modulosPermitidosParaRol } from "@/lib/permisos-modulos";

/**
 * SPEC-437 (A-75) · el área de trabajo del profesional, con barra lateral.
 *
 * Jelkin, textual: *«debe aparecer sus módulos, debemos utilizar la misma
 * lógica de operador»*. Por eso reusa `AdminNav` y `modulosPermitidosParaRol`
 * — mismo componente, mismo filtrado por módulo — y no un menú paralelo.
 *
 * Layout de UI pura, como el del admin (SPEC-287): **no ejecuta `redirect`**.
 * Los guardianes de sesión y de rol viven en `middleware.ts`.
 */
export default async function ProfesionalLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    const rol = (payload?.rol as string | undefined) ?? "PROFESIONAL";
    const permitidos = await modulosPermitidosParaRol(rol);

    return (
        // SPEC-460: el profesional comparte el acento cielo del padre (theme-profesional).
        <div className="theme-profesional flex min-h-screen">
            <AdminNav rol="PROFESIONAL" modulosPermitidos={[...permitidos]} />
            <main className="flex-1 overflow-auto">{children}</main>
        </div>
    );
}
