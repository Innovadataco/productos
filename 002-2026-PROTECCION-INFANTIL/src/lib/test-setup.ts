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

(globalThis as unknown as { TextEncoder: typeof TextEncoder }).TextEncoder = FixedTextEncoder;
(globalThis as unknown as { TextDecoder: typeof TextDecoder }).TextDecoder = NodeTextDecoder;
Object.defineProperty(globalThis, "crypto", { value: webcrypto });

process.env.JWT_SECRET = "test-secret-key-32-chars-long-12345678";
process.env.RESEND_API_KEY = "re_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx";
process.env.ENCRYPTION_KEY = "test-encryption-32-chars-key!!";
process.env.DATABASE_URL = "postgresql://proteccion:proteccion_dev@localhost:5433/proteccion_infantil";
process.env.WORKER_SECRET = "worker-secret-test";
