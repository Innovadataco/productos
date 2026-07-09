import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET no configurada o menor a 32 caracteres.");
}
const SECRET = new TextEncoder().encode(secret);

export async function verifyAuth() {
    const token = (await cookies()).get("token")?.value;
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, SECRET, { clockTolerance: 60 });
        return payload as { sub: string; username: string; role: string };
    } catch {
        return null;
    }
}

export async function signToken(payload: { sub: string; username: string; role: string }): Promise<string> {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("7d")
        .sign(SECRET);
}