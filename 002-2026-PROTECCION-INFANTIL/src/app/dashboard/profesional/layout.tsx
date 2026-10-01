import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { NavLateral } from "@/components/modules/nav/NavLateral";
import { BarraInferior } from "@/components/modules/nav/BarraInferior";
import { modulosPermitidosParaRol } from "@/lib/permisos-modulos";
import { obtenerHabilitacionProfesional } from "@/lib/profesionales/habilitacion";

/**
 * SPEC-437 (A-75) · el área de trabajo del profesional, con barra lateral.
 *
 * Jelkin, textual: *«debe aparecer sus módulos, debemos utilizar la misma
 * lógica de operador»*. Por eso reusa `NavLateral` y `modulosPermitidosParaRol`
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

    // SPEC-802: `habilitado` se resuelve EN EL SERVIDOR (la MISMA fuente que GET /api/me) y se pasa como
    // prop a la nav. Así el SSR ya pinta el menú correcto por estado y la barra no AFIRMA «portero»
    // durante la ventana del `fetch` del cliente (el defecto medido). La compuerta de ruta la hace el
    // middleware y sigue fail-closed: esto es solo el display.
    const userId = payload?.sub as string | undefined;
    const habilitacion = userId ? await obtenerHabilitacionProfesional(userId) : null;
    const profesionalInicial = { habilitado: habilitacion?.habilitado ?? false };

    return (
        // SPEC-460: el profesional comparte el acento cielo del padre (theme-profesional).
        <div className="theme-profesional flex min-h-screen">
            <NavLateral rol="PROFESIONAL" modulosPermitidos={[...permitidos]} profesionalInicial={profesionalInicial} />
            <BarraInferior rol="PROFESIONAL" modulosPermitidos={[...permitidos]} profesionalInicial={profesionalInicial} />
            <main className="flex-1 overflow-auto pb-16 sm:pb-0">{children}</main>
        </div>
    );
}
