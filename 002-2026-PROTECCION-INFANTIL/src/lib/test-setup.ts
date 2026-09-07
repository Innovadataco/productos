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
process.env.RESEND_WEBHOOK_SECRET = "dGVzdHNlY3JldA==";
process.env.ENCRYPTION_KEY = "test-encryption-32-chars-key!!";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://proteccion:proteccion_dev@localhost:5433/proteccion_infantil_test";
process.env.WORKER_SECRET = "worker-secret-test";
// S-D · KEK de test para la capa DEK-por-denuncia (ContenidoReporte/LlaveReporte). Se siembra
// GLOBAL una vez para que cualquier fixture que cree un Reporte vía `crearReporteConTexto`
// pueda sellar/descifrar (si falta, la capa es fail-loud y revienta). `??=` respeta una KEK
// provista por el entorno; valor fijo de 32 bytes → base64 canónica, determinista.
process.env.REPORTE_TEXTO_KEY_V1 ??= Buffer.from(new Uint8Array(32).fill(7)).toString("base64");
process.env.REPORTE_TEXTO_KEY_ACTIVA ??= "1";

// Higiene intra-archivo: un test que espía métodos del singleton de Prisma y no
// restaura rompería a sus vecinos del MISMO archivo. Entre archivos ya no hace
// falta: SPEC-174 corre un fork por archivo, así que el estado de módulos no
// cruza. Mantenemos un snapshot de los métodos reales y los restauramos
// incondicionalmente en cada hook (la guarda "solo si dejó de ser función"
// dejaba vivos los spies, I-54).
const globalStore = globalThis as unknown as {
    __prismaMethodSnapshot?: Map<string, Record<string, unknown>>;
    __testPrismaClient?: unknown;
};

function looksLikeRealPrisma(client: unknown): boolean {
    if (!client || typeof client !== "object") return false;
    const delegate = (client as Record<string, unknown>).parametroSistema;
    if (!delegate || typeof delegate !== "object") return false;
    return typeof (delegate as Record<string, unknown>).findUnique === "function";
}

function snapshotPrismaMethods(client: unknown): Map<string, Record<string, unknown>> {
    const snapshot = new Map<string, Record<string, unknown>>();
    for (const key of Object.keys(client as Record<string, unknown>)) {
        const delegate = (client as Record<string, unknown>)[key];
        if (!delegate || typeof delegate !== "object") continue;
        const methods: Record<string, unknown> = {};
        for (const method of Object.keys(delegate as Record<string, unknown>)) {
            const fn = (delegate as Record<string, unknown>)[method];
            if (typeof fn === "function") methods[method] = fn;
        }
        if (Object.keys(methods).length > 0) snapshot.set(key, methods);
    }
    return snapshot;
}

async function ensureRealPrismaClient() {
    if (looksLikeRealPrisma(globalStore.__testPrismaClient)) {
        return globalStore.__testPrismaClient;
    }
    if (looksLikeRealPrisma(globalThis.prisma)) {
        globalStore.__testPrismaClient = globalThis.prisma;
        return globalThis.prisma;
    }
    // Último recurso: instanciar un cliente real. Esto solo pasa si el primer
    // archivo de test fue un mocker y globalThis.prisma nunca se pobló.
    const { PrismaClient } = await import("@prisma/client");
    const fresh = new PrismaClient();
    globalStore.__testPrismaClient = fresh;
    if (process.env.NODE_ENV !== "production") globalThis.prisma = fresh;
    return fresh;
}

async function getPrismaMethodSnapshot() {
    if (!globalStore.__prismaMethodSnapshot) {
        const realClient = await ensureRealPrismaClient();
        globalStore.__prismaMethodSnapshot = snapshotPrismaMethods(realClient);
    }
    return globalStore.__prismaMethodSnapshot;
}

async function restorePrismaMethods() {
    const snapshot = await getPrismaMethodSnapshot();
    for (const [key, methods] of snapshot) {
        const delegate = (prisma as Record<string, unknown>)[key];
        if (!delegate || typeof delegate !== "object") continue;
        for (const [method, originalFn] of Object.entries(methods)) {
            try {
                Object.defineProperty(delegate, method, {
                    value: originalFn,
                    writable: true,
                    enumerable: true,
                    configurable: true,
                });
            } catch {
                // Ignorar propiedades de solo lectura (no debería pasar).
            }
        }
    }
}

// Aislamiento de BD: vitest 3.2.x ejecuta hooks/tests concurrentemente a
// pesar de fileParallelism:false + sequence.concurrent:false. Serializamos
// cada test con un mutex en PostgreSQL (tabla TestMutex) usando el reloj de
// la BD para detectar locks huérfanos. Si no se adquiere en el tiempo
// configurado, liberamos forzosamente cualquier lock antiguo y reintentamos.
// Usamos el cliente real global para no depender del singleton posiblemente
// envenenado por un mock parcial.
const MUTEX_ID = "singleton";
const POLL_MS = 50;
const LOCK_TIMEOUT_MS = 30_000; // un test legítimo nunca debería durar más
const ACQUIRE_TIMEOUT_MS = 60_000;

async function getMutexClient() {
    return ensureRealPrismaClient();
}

async function ensureTestMutexTable() {
    const client = await getMutexClient();
    await client.$executeRaw`
        CREATE TABLE IF NOT EXISTS "TestMutex" (
            id TEXT PRIMARY KEY,
            locked BOOLEAN NOT NULL DEFAULT false,
            "lockedAt" TIMESTAMPTZ
        )
    `;
    await client.$executeRaw`
        ALTER TABLE "TestMutex" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMPTZ
    `;
    await client.$executeRaw`
        INSERT INTO "TestMutex" (id, locked)
        VALUES (${MUTEX_ID}, false)
        ON CONFLICT (id) DO NOTHING
    `;
}

async function tryAcquireTestLock() {
    const client = await getMutexClient();
    const result = await client.$queryRaw<{ id: string }[]>`
        UPDATE "TestMutex"
        SET locked = true, "lockedAt" = NOW()
        WHERE id = ${MUTEX_ID} AND locked = false
        RETURNING id
    `;
    return result.length > 0;
}

async function isLockOrphaned() {
    const client = await getMutexClient();
    const rows = await client.$queryRaw<{ segundos: number }[]>`
        SELECT EXTRACT(EPOCH FROM (NOW() - "lockedAt"))::int AS segundos
        FROM "TestMutex"
        WHERE id = ${MUTEX_ID}
    `;
    const segundos = rows[0]?.segundos;
    if (segundos == null) return true;
    return segundos > LOCK_TIMEOUT_MS / 1000;
}

async function forceReleaseTestLock() {
    const client = await getMutexClient();
    await client.$executeRaw`
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
    const client = await getMutexClient();
    await client.$executeRaw`
        UPDATE "TestMutex" SET locked = false, "lockedAt" = NULL WHERE id = ${MUTEX_ID}
    `;
}

beforeAll(async () => {
    await restorePrismaMethods();
});

beforeEach(async () => {
    await restorePrismaMethods();
    await ensureTestMutexTable();
    await acquireTestLock();
});

afterEach(async () => {
    // Restaurar estado global de JS antes de soltar el lock de BD. Un test que
    // deje fake timers, mocks o globals stubs (fetch, etc.) contamina a los
    // siguientes del MISMO archivo (los archivos ya no comparten fork, SPEC-174).
    //
    // Nota: NO usamos vi.restoreAllMocks() porque Vitest lo aplica también a
    // los mocks creados con vi.mock(), reseteándolos a vi.fn() sin
    // implementación y rompiendo tests que dependen de la factory del módulo.
    // Limpiamos calls con clearAllMocks() y dejamos que cada test restaure sus
    // propios spyOn si es necesario.
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    await restorePrismaMethods();

    try {
        cleanup();
    } catch (e) {
        console.warn("[TEST SETUP] cleanup() falló:", e);
    }
    await releaseTestLock();
});

// SPEC-375 · cerrar recursos al final de cada fork.
//
// Cuando un fork de vitest termina sus tests, cualquier handle activo (pool
// de pg-boss, timer sin `.unref()`, cliente pg con reintentos) mantiene vivo
// el proceso Node y el shard queda colgado en CI hasta el timeout general
// (40+ min, cancelación manual). Cada módulo que crea un recurso persistente
// se registra en `globalThis.__pi_test_disposers` al ser importado; acá los
// invocamos en orden. Silencioso e idempotente: si un fork no tocó ningún
// módulo con recursos, el `Set` está vacío y no hace nada.
afterAll(async () => {
    const registro = (globalThis as unknown as { __pi_test_disposers?: Set<() => Promise<void>> });
    if (registro.__pi_test_disposers) {
        for (const dispose of registro.__pi_test_disposers) {
            try {
                await dispose();
            } catch {
                // El error de shutdown NO debe reventar un fork que ya pasó los tests.
            }
        }
        registro.__pi_test_disposers.clear();
    }

    // SPEC-407 (I-282) · medición de handles vivos.
    //
    // Se activa solo con `VITEST_DEBUG_HANDLES=1`. Sin la flag, el afterAll
    // se comporta exactamente igual que antes (candado: no afecta a las
    // suites que hoy pasan). Con la flag: dumps EN DOS momentos:
    //   1. Al final del afterAll global — línea base.
    //   2. En `beforeExit` de Node — cuando Node está a punto de salir; si
    //      NO se dispara, hay handles que impiden que llegue ahí (esos son
    //      los que dejan el fork colgado en CI y GHA mata como orphan).
    // También lista `process._getActiveHandles()`/`Requests()` en crudo,
    // porque wtfnode a veces filtra su output.
    if (process.env.VITEST_DEBUG_HANDLES === "1") {
        const label = process.env.VITEST_DEBUG_LABEL ?? "SPEC-407";
        const dumpActive = (etapa: string) => {
            const anyProcess = process as unknown as {
                _getActiveHandles?: () => unknown[];
                _getActiveRequests?: () => unknown[];
            };
            const handles = anyProcess._getActiveHandles?.() ?? [];
            const requests = anyProcess._getActiveRequests?.() ?? [];
            const tipo = (h: unknown) =>
                h && typeof h === "object"
                    ? (h.constructor?.name ?? "Object") + (typeof (h as { fd?: unknown }).fd === "number" ? `(fd:${(h as { fd: number }).fd})` : "")
                    : String(h);
            console.error(`\n[${label}] ${etapa} · handles=${handles.length} requests=${requests.length}`);
            console.error(`[${label}] ${etapa} · handles: ${handles.map(tipo).join(", ")}`);
            console.error(`[${label}] ${etapa} · requests: ${requests.map(tipo).join(", ")}`);
        };
        try {
            const wtf = await import("wtfnode");
            (wtf as unknown as { dump: () => void }).dump();
        } catch (e) {
            console.warn(`[${label}] wtfnode no disponible:`, e);
        }
        dumpActive("afterAll");
        process.once("beforeExit", () => dumpActive("beforeExit"));
    }
});

