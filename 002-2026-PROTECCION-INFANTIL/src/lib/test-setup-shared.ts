// @ts-nocheck
/**
 * Utilidades compartidas de setup para tests unitarios e integración.
 * No contiene lógica de base de datos ni mutex — eso vive en test-setup.ts.
 */
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
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://proteccion:proteccion_dev@localhost:5433/proteccion_infantil_test";
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
