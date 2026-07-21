// Setup global de Vitest. En jsdom, TextEncoder produce Uint8Array de otro realm que jose
// (webapi) no reconoce; se fuerzan los de Node. Además crypto y env mínimo de test.
import { TextEncoder, TextDecoder } from "node:util";
import { webcrypto } from "node:crypto";

Object.assign(globalThis, { TextEncoder, TextDecoder });

if (!globalThis.crypto) {
  // @ts-expect-error jsdom no expone webcrypto por defecto
  globalThis.crypto = webcrypto;
}

process.env.JWT_SECRET ??= "test-secret-de-al-menos-32-caracteres-000";
process.env.INTEGRACIONES_MODO ??= "stub";
process.env.SUPERTRANSPORTE_HABILITADO ??= "false";
process.env.TZ ??= "America/Bogota";
