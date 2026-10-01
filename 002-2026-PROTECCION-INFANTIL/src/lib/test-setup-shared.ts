// @ts-nocheck
/**
 * Utilidades compartidas de setup para tests unitarios e integración.
 * No contiene lógica de base de datos ni mutex — eso vive en test-setup.ts.
 */
// SPEC-817 · resuelve DATABASE_URL por worktree (o respeta el del entorno) antes que nada. Los unitarios no
// tocan BD, pero corren con `--env-file=.env.test` (que ya no fija la base): así nunca heredan un default compartido.
import "./test-db-url";
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from "util";
import { webcrypto } from "node:crypto";
import { cleanup } from "@testing-library/react";

// Wrapper que garantiza que encode() devuelva una Uint8Array pura,
// evitando problemas con jose/webapi en entornos de test.
class FixedTextEncoder extends NodeTextEncoder {
    override encode(input?: string) {
        const buffer = super.encode(input);
        return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
}

Object.assign(globalThis, { TextEncoder: FixedTextEncoder, TextDecoder: NodeTextDecoder });
Object.defineProperty(globalThis, "crypto", { value: webcrypto });

process.env.JWT_SECRET = "test-secret-key-32-chars-long-12345678";
process.env.RESEND_API_KEY = "re_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx";
process.env.ENCRYPTION_KEY = "test-encryption-32-chars-key!!";
// SPEC-817 · DATABASE_URL lo resolvió `./test-db-url` arriba (sin default compartido).
process.env.WORKER_SECRET = "worker-secret-test";

afterEach(async () => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    try {
        cleanup();
    } catch (e) {
        console.warn("[TEST SETUP] cleanup() falló:", e);
    }
});
