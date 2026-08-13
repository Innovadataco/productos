// @ts-nocheck
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from "util";
import { webcrypto } from "node:crypto";
import { cleanup } from "@testing-library/react";
import { prisma } from "./prisma";

// Wrapper que garantiza que encode() devuelva una Uint8Array pura,
// evitando problemas con jose/webapi en entornos de test.
class FixedTextEncoder extends NodeTextEncoder {
    encode(input?: string) {
        const buffer = super.encode(input);
        return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
}

Object.assign(globalThis, { TextEncoder: FixedTextEncoder, TextDecoder: NodeTextDecoder });
Object.defineProperty(globalThis, "crypto", { value: webcrypto });

process.env.JWT_SECRET = "test-secret-key-32-chars-long-12345678";
process.env.RESEND_API_KEY = "re_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx";
process.env.ENCRYPTION_KEY = "test-encryption-32-chars-key!!";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://proteccion:proteccion_dev@localhost:5433/proteccion_infantil_test";
process.env.WORKER_SECRET = "worker-secret-test";

// Aislamiento de BD: vitest 3.2.x ejecuta hooks/tests concurrentemente a
// pesar de fileParallelism:false + sequence.concurrent:false. Serializamos
// cada test con un mutex en PostgreSQL (tabla TestMutex) usando el reloj de
// la BD para detectar locks huérfanos. Si no se adquiere en el tiempo
// configurado, liberamos forzosamente cualquier lock antiguo y reintentamos.
const MUTEX_ID = "singleton";
const POLL_MS = 50;
const LOCK_TIMEOUT_MS = 30_000; // un test legítimo nunca debería durar más
const ACQUIRE_TIMEOUT_MS = 60_000;

async function ensureTestMutexTable() {
    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "TestMutex" (
            id TEXT PRIMARY KEY,
            locked BOOLEAN NOT NULL DEFAULT false,
            "lockedAt" TIMESTAMPTZ
        )
    `;
    await prisma.$executeRaw`
        ALTER TABLE "TestMutex" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMPTZ
    `;
    await prisma.$executeRaw`
        INSERT INTO "TestMutex" (id, locked)
        VALUES (${MUTEX_ID}, false)
        ON CONFLICT (id) DO NOTHING
    `;
}

async function tryAcquireTestLock() {
    const result = await prisma.$queryRaw<{ id: string }[]>`
        UPDATE "TestMutex"
        SET locked = true, "lockedAt" = NOW()
        WHERE id = ${MUTEX_ID} AND locked = false
        RETURNING id
    `;
    return result.length > 0;
}

async function isLockOrphaned() {
    // Usamos el reloj de la BD para evitar desincronización entre el reloj del
    // cliente (runner de CI) y el reloj del servidor Postgres (contenedor).
    const rows = await prisma.$queryRaw<{ segundos: number }[]>`
        SELECT EXTRACT(EPOCH FROM (NOW() - "lockedAt"))::int AS segundos
        FROM "TestMutex"
        WHERE id = ${MUTEX_ID}
    `;
    const segundos = rows[0]?.segundos;
    if (segundos == null) return true;
    return segundos > LOCK_TIMEOUT_MS / 1000;
}

async function forceReleaseTestLock() {
    await prisma.$executeRaw`
        UPDATE "TestMutex" SET locked = false, "lockedAt" = NULL WHERE id = ${MUTEX_ID}
    `;
}

async function acquireTestLock() {
    const startedAt = Date.now();
    while (true) {
        if (await tryAcquireTestLock()) return;
        const elapsed = Date.now() - startedAt;
        if (elapsed > ACQUIRE_TIMEOUT_MS) {
            throw new Error(`[TEST SETUP] No se pudo adquirir el mutex de test en ${ACQUIRE_TIMEOUT_MS}ms`);
        }
        // Si el lock lleva mucho tiempo, asumimos que el test anterior no lo
        // liberó (crash / hook abortado) y lo liberamos forzosamente.
        if (elapsed > LOCK_TIMEOUT_MS && (await isLockOrphaned())) {
            console.warn("[TEST SETUP] Liberando lock huérfano de TestMutex");
            await forceReleaseTestLock();
            if (await tryAcquireTestLock()) return;
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
}

async function releaseTestLock() {
    await prisma.$executeRaw`
        UPDATE "TestMutex" SET locked = false, "lockedAt" = NULL WHERE id = ${MUTEX_ID}
    `;
}

beforeEach(async () => {
    await ensureTestMutexTable();
    await acquireTestLock();
});

afterEach(async () => {
    // Restaurar estado global de JS antes de soltar el lock de BD. Un test que
    // deje fake timers, mocks o globals stubs (fetch, etc.) contamina a todos
    // los siguientes en el mismo fork (singleFork:true). Esto causa flakes
    // order-dependent, especialmente en librerías con WASM como
    // @react-pdf/renderer/yoga-layout (HALLAZGO 002-PI-062).
    //
    // Nota: NO usamos vi.restoreAllMocks() porque Vitest lo aplica también a
    // los mocks creados con vi.mock(), reseteándolos a vi.fn() sin
    // implementación y rompiendo tests que dependen de la factory del módulo.
    // Limpiamos calls con clearAllMocks() y dejamos que cada test restaure sus
    // propios spyOn si es necesario.
    vi.useRealTimers();
    vi.unstubAllGlobals();

    try {
        cleanup();
    } catch (e) {
        console.warn("[TEST SETUP] cleanup() falló:", e);
    }
    await releaseTestLock();
});
