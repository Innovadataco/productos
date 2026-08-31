import { NextResponse } from "next/server";
import { biBase } from "@/lib/auth/return-to";

// SPEC-036 · cierra la sesión de BI: borra la cookie `session` y vuelve al
// login. Una vez sin cookie, el guard vuelve a exigir credencial en toda la app.
export async function POST(): Promise<NextResponse> {
    const res = NextResponse.redirect(new URL("/login", biBase()), 302);
    res.cookies.set({
        name: "session",
        value: "",
        path: "/",
        httpOnly: true,
        maxAge: 0,
    });
    return res;
}
