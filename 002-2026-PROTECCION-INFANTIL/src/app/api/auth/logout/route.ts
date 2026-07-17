import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
    const cookieStore = await cookies();
    cookieStore.delete("__Host-token");
    cookieStore.delete("token");
    return NextResponse.json({ message: "Sesión cerrada exitosamente" });
}
