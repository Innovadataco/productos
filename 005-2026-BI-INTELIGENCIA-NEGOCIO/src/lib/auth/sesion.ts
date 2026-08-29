import { verifyToken } from "./jwt";

export interface Sesion {
    id: string;
    rol: string;
}

function extraerToken(req: Request): string | null {
    const auth = req.headers.get("authorization");
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
        const t = auth.slice(7).trim();
        if (t.length > 0) return t;
    }
    const cookie = req.headers.get("cookie") || "";
    for (const parte of cookie.split(";")) {
        const [k, ...rest] = parte.trim().split("=");
        if (k === "session" && rest.length > 0) return rest.join("=").trim();
    }
    return null;
}

export async function sesionDeRequest(req: Request): Promise<Sesion | null> {
    const token = extraerToken(req);
    if (!token) return null;
    const payload = await verifyToken(token);
    if (!payload) return null;
    const rol = typeof payload.role === "string" ? payload.role : null;
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!rol || !sub) return null;
    return { id: sub, rol };
}
