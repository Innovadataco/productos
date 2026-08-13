// @ts-nocheck
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from "util";
import { webcrypto } from "node:crypto";

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
// Worktrees paralelos: respeta DATABASE_URL si ya viene cargada (--env-file=.env.test);
// el fallback es la BD de test del repo principal.
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://proteccion:proteccion_dev@localhost:5433/proteccion_infantil_test";
process.env.WORKER_SECRET = "worker-secret-test";

// Aislamiento de BD: vitest 3.2.x ejecuta hooks/tests concurrentemente a
// pesar de fileParallelism:false + sequence.concurrent:false. Serializamos
// cada test con un mutex en PostgreSQL (tabla TestMutex), que funciona
// independientemente del pool/hilos/procesos de vitest.
import { prisma } from "./prisma";
import { cleanup } from "@testing-library/react";

const MUTEX_ID = "singleton";
const POLL_MS = 50;
const LOCK_TIMEOUT_MS = 30_000;

async function ensureTestMutexTable() {
    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "TestMutex" (
            id TEXT PRIMARY KEY,
            locked BOOLEAN NOT NULL DEFAULT false,
            "lockedAt" TIMESTAMPTZ
        )
    `;
    // Migración aditiva para entornos que ya tienen la tabla sin lockedAt.
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
    const rows = await prisma.$queryRaw<{ lockedAt: Date | null }[]>`
        SELECT "lockedAt" FROM "TestMutex" WHERE id = ${MUTEX_ID}
    `;
    const lockedAt = rows[0]?.lockedAt;
    if (!lockedAt) return true;
    return Date.now() - new Date(lockedAt).getTime() > LOCK_TIMEOUT_MS;
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
        // Si el lock lleva mucho tiempo, asumimos que el test anterior no lo
        // liberó (crash / hook abortado) y lo liberamos forzosamente.
        if (Date.now() - startedAt > LOCK_TIMEOUT_MS && (await isLockOrphaned())) {
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
    try {
        cleanup();
    } catch (e) {
        console.warn("[TEST SETUP] cleanup() falló:", e);
    } finally {
        await releaseTestLock();
    }
});
