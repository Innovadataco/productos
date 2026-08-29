import { SignJWT, jwtVerify } from "jose";
import { requireEnv } from "@/lib/env";

/**
 * SPEC-132 (S-4): el token de confirmación firma SOLO el id de la sesión de
 * carga (+ colegioId para la guarda de aislamiento). El roster de alumnos
 * (PII de menores) NUNCA viaja en el JWT: vive server-side en CargaRosterSesion.
 */
type CargaTokenPayload = {
    sesionId: string;
    colegioId: string;
};

const TTL_CARGA = "15m";

function getSecret(): Uint8Array {
    return new TextEncoder().encode(requireEnv("JWT_SECRET", 32));
}

export async function generarTokenCarga(payload: CargaTokenPayload): Promise<string> {
    return new SignJWT({ sesionId: payload.sesionId, colegioId: payload.colegioId })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(TTL_CARGA)
        .sign(getSecret());
}

export async function verificarTokenCarga(token: string): Promise<CargaTokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getSecret(), { clockTolerance: 60 });
        if (!payload || typeof payload !== "object") return null;
        const { sesionId, colegioId } = payload as Record<string, unknown>;
        if (typeof sesionId !== "string" || typeof colegioId !== "string") return null;
        return { sesionId, colegioId };
    } catch {
        return null;
    }
}
