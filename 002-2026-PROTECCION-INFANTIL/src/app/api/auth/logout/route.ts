import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieAttributes } from "@/lib/auth";

export async function POST() {
    const cookieStore = await cookies();
    // Spec 106 (I-32): el borrado debe llevar los MISMOS atributos con que se creó la
    // cookie; sin ellos el navegador rechaza el Set-Cookie y la sesión sobrevive.
    // __Host-token SIEMPRE con secure+path (el prefijo __Host- lo exige, sin consultar
    // el esquema detectado — corrección ZEUS); la legacy token con su esquema no-seguro.
    cookieStore.set("__Host-token", "", { ...sessionCookieAttributes(true), maxAge: 0 });
    cookieStore.set("token", "", { ...sessionCookieAttributes(false), maxAge: 0 });
    return NextResponse.json({ message: "Sesión cerrada exitosamente" });
}
