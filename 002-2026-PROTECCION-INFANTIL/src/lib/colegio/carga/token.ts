import { SignJWT, jwtVerify } from "jose";
import { requireEnv } from "@/lib/env";
import type { FilaCargaAlumno } from "./parser";

type CargaTokenPayload = {
    filas: FilaCargaAlumno[];
    colegioId: string;
};

const TTL_CARGA = "15m";

function getSecret(): Uint8Array {
    return new TextEncoder().encode(requireEnv("JWT_SECRET", 32));
}

export async function generarTokenCarga(payload: CargaTokenPayload): Promise<string> {
    return new SignJWT({ filas: payload.filas, colegioId: payload.colegioId })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(TTL_CARGA)
        .sign(getSecret());
}

export async function verificarTokenCarga(token: string): Promise<CargaTokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getSecret(), { clockTolerance: 60 });
        if (!payload || typeof payload !== "object") return null;
        const { filas, colegioId } = payload as Record<string, unknown>;
        if (!Array.isArray(filas) || typeof colegioId !== "string") return null;
        return { filas: filas as FilaCargaAlumno[], colegioId };
    } catch {
        return null;
    }
}
