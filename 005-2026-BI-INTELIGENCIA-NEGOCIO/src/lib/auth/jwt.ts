import { jwtVerify, type JWTPayload } from "jose";

export async function verifyToken(token: string): Promise<JWTPayload | null> {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    try {
        const { payload } = await jwtVerify(
            token,
            new TextEncoder().encode(secret)
        );
        return payload;
    } catch {
        return null;
    }
}
