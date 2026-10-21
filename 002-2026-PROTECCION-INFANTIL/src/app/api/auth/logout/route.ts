import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieAttributes, verifyToken } from "@/lib/auth";
import { SessionLogService } from "@/lib/dal/services/session-log";
import { NOMBRE_COOKIE } from "@/lib/routing/vigencia-cookie";

export async function POST() {
    const cookieStore = await cookies();

    // SPEC-896: cerrar la SesionLog del JWT ANTES de borrar la cookie — sin esto, un token robado sobrevivía
    // al logout hasta su `exp` (24h) y se mantenía vivo con /api/session/ping (`estaSesionActiva`/`pingSesion`
    // ya rechazan `cerradaEn!=null`; faltaba CERRARLA). Best-effort: si el token falta o es inválido, igual se
    // limpian las cookies y se responde 200.
    try {
        const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
        if (token) {
            const payload = await verifyToken(token);
            const sesionLogId = payload && typeof payload.sesionLogId === "string" ? payload.sesionLogId : null;
            const usuarioId = payload && typeof payload.sub === "string" ? payload.sub : null;
            if (sesionLogId && usuarioId) {
                await new SessionLogService().cerrarPropia(sesionLogId, usuarioId);
            }
        }
    } catch {
        // best-effort: el cierre del SesionLog no debe impedir el logout ni filtrar errores.
    }

    // Spec 106 (I-32): el borrado debe llevar los MISMOS atributos con que se creó la
    // cookie; sin ellos el navegador rechaza el Set-Cookie y la sesión sobrevive.
    // __Host-token SIEMPRE con secure+path (el prefijo __Host- lo exige, sin consultar
    // el esquema detectado — corrección ZEUS); la legacy token con su esquema no-seguro.
    cookieStore.set("__Host-token", "", { ...sessionCookieAttributes(true), maxAge: 0 });
    cookieStore.set("token", "", { ...sessionCookieAttributes(false), maxAge: 0 });
    // SPEC-344 (FR-044): también expirar `sesion_estado`. Hasta hoy sobrevivía
    // hasta 5 min tras logout — inocuo mientras el JWT gobierne (siempre se
    // valida antes de leer la cookie de estado), pero el brief exige el borrado
    // explícito. Sin este delete, un nuevo login con otro rol veía un estado
    // huérfano hasta el próximo re-sellado.
    cookieStore.set(NOMBRE_COOKIE, "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.COOKIE_SECURE !== "false",
    });
    return NextResponse.json({ message: "Sesión cerrada exitosamente" });
}
