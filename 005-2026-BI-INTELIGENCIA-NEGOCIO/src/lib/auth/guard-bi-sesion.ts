import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { sesionDeRequest, type Sesion } from "@/lib/auth/sesion";

// SPEC-035 · guard de sesión BI reutilizable. Extraído para NO duplicar la
// lógica entre /dashboard y /operacion: la duplicación fue la causa de I-33
// (/operacion nació sin guard y quedó público). Proteger una ruta nueva es
// ahora `await exigirSesionBi("/x")` en su layout, no un copy-paste olvidable.
//
// `rutaBi` es la ruta propia de BI a la que volver tras autenticarse (p.ej.
// "/dashboard" o "/operacion"). Como el llamador conoce su ruta, se hardcodea
// y NO se depende de x-invoke-path (limitación D-029.6, que solo afectaba a
// la preservación de sub-rutas dinámicas).
//
// SPEC-036 (login propio de BI) cambiará únicamente el interior de este
// helper (a qué guard redirige); la estructura layout→exigirSesionBi se queda.
export async function exigirSesionBi(rutaBi: string): Promise<Sesion> {
    const h = await headers();
    // Request sintético para reutilizar sesionDeRequest sin duplicar la
    // extracción de token (candado 22 · SOLO LECTURA de src/lib/auth).
    const req = new Request("http://internal/", {
        headers: {
            authorization: h.get("authorization") ?? "",
            cookie: h.get("cookie") ?? "",
        },
    });
    const sesion = await sesionDeRequest(req);
    if (!sesion) {
        // SPEC-029 · puente de sesión en PI. Con el patrón BI_BASE_URL que hoy
        // vive en main (SPEC-030/resolveBiBaseUrl está congelado en PR #168).
        const pi = process.env.PI_BASE_URL ?? "https://pi.innovadataco.com";
        const bi = process.env.BI_BASE_URL ?? "http://localhost:3001";
        const returnTo = `${bi}${rutaBi}`;
        redirect(
            `${pi}/api/auth/link-bi?returnTo=${encodeURIComponent(returnTo)}`,
        );
    }
    return sesion;
}
