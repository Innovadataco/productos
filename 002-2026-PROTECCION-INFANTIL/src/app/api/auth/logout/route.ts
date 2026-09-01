import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieAttributes } from "@/lib/auth";
import { NOMBRE_COOKIE } from "@/lib/routing/vigencia-cookie";

export async function POST() {
    const cookieStore = await cookies();
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
