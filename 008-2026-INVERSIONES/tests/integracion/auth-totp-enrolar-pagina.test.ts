// La página /totp/enrolar con la clave de cifrado RETIRADA (O3): tras rotar a la v2 y sacar la v1 del entorno,
// el secreto pendiente cifrado con la v1 ya no abre. La página no cae en la pantalla de error genérica: muestra
// un aviso fijo (sin la versión, ni la clave, ni el error crudo), sin el QR ni el formulario, y el registro
// lleva solo el código. Con la v1 cargada, la misma cuenta ve su QR. Contra la base de PRUEBAS. Datos
// inventados: correos @ejemplo.invalid, secreto aleatorio y claves aleatorias.
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashClave } from "@/auth/clave";
import { firmarPresesion, generarJti, hashJti } from "@/auth/presesion";
import { cifrarSecretoTotp } from "@/auth/secreto-totp";
import { generarSecretoTotp } from "@/auth/totp";

// La cookie de la pre-sesión que «trae el navegador» en cada prueba (next/headers no existe fuera de Next).
const navegador = vi.hoisted(() => ({ presesion: "" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (nombre: string) => (nombre === "__Host-presesion" && navegador.presesion ? { value: navegador.presesion } : undefined) }),
}));

// Secreto de sesión inventado solo para esta prueba (se restaura el anterior en afterAll).
const AUTH_SECRET_ANTERIOR = process.env.AUTH_SECRET;
process.env.AUTH_SECRET = "secreto-ficticio-de-integracion-enrolar-pagina-0123";
const CLAVE_SESION = new TextEncoder().encode(process.env.AUTH_SECRET);

const db = new PrismaClient();
const corrida = Date.now().toString(36);
const CLAVE_V2 = randomBytes(32).toString("base64");
const CLAVE_V1 = process.env.CIFRADO_CLAVE_V1 ?? "";
const AVISO = "No se pudo preparar el segundo factor.";
let hash = "";
let n = 0;
let Enrolar: () => Promise<ReactElement>;
let registro: ReturnType<typeof vi.spyOn>;

/** Rota a la v2 y RETIRA la v1: lo cifrado con la v1 ya no tiene clave. */
function retirarV1(): void {
  vi.stubEnv("CIFRADO_CLAVE_V2", CLAVE_V2);
  vi.stubEnv("CIFRADO_CLAVE_ACTIVA", "v2");
  vi.stubEnv("CIFRADO_CLAVE_V1", "");
}

/** Un dueño con la ventana de enrolar abierta, su secreto pendiente cifrado con la v1 y una pre-sesión vigente. */
async function cuentaConPendienteEnV1(): Promise<string> {
  const email = `enrolar-pagina-${corrida}-${(n += 1)}@ejemplo.invalid`;
  const { id } = await db.usuario.create({ data: { email, rol: "DUENO", claveHash: hash } });
  await db.intentoIngreso.create({ data: { usuarioId: id, resultado: "CLAVE_DEFINIDA", ocurridoEn: new Date() } });
  const jti = generarJti();
  const { sesionVersion } = await db.usuario.update({
    where: { id },
    data: { totpSecreto: cifrarSecretoTotp(generarSecretoTotp(), id), presesionHash: hashJti(jti) },
  });
  navegador.presesion = await firmarPresesion({ sub: id, sesionVersion, jti }, CLAVE_SESION, Date.now());
  return id;
}

const CAMPOS_FOTO = { totpSecreto: true, totpActivadoEn: true, presesionHash: true, bloqueadoHasta: true, sesionVersion: true } as const;
const foto = async (id: string) => ({
  cuenta: await db.usuario.findUniqueOrThrow({ where: { id }, select: CAMPOS_FOTO }),
  intentos: await db.intentoIngreso.count({ where: { usuarioId: id } }),
});

beforeAll(async () => {
  const nombreBase = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombreBase.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombreBase}»: solo bases *_test`);
  if (CLAVE_V1 === "") throw new Error("Falta CIFRADO_CLAVE_V1 (la fija vitest.integracion.config.ts)");
  hash = await hashClave("clave-ficticia-enrolar-pagina");
  Enrolar = (await import("@/app/totp/enrolar/page")).default;
});

beforeEach(() => {
  registro = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  registro.mockRestore();
  navegador.presesion = "";
});

afterAll(async () => {
  if (AUTH_SECRET_ANTERIOR === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = AUTH_SECRET_ANTERIOR;
  await db.$disconnect();
});

describe("/totp/enrolar con la clave v1 retirada (O3)", () => {
  it("con la v1 cargada, la misma cuenta ve su QR y la clave base32 (control)", async () => {
    await cuentaConPendienteEnV1();
    const html = renderToStaticMarkup(await Enrolar());
    expect(html).toContain("Código QR para la app autenticadora");
    expect(html).toContain("data-clave-totp");
    expect(html).not.toContain(AVISO);
  });

  it("muestra un aviso fijo en su caja, sin QR, sin clave, sin formulario ni detalles del cifrado, y no escribe nada", async () => {
    const id = await cuentaConPendienteEnV1();
    const antes = await foto(id);
    retirarV1();
    const html = renderToStaticMarkup(await Enrolar());
    expect(html).toContain('role="alert"');
    expect(html).toContain(AVISO);
    expect(html).toContain("crear-acceso-inicial --reiniciar-totp");
    expect(html).toContain("Segundo factor");
    expect(html).toContain('href="/ingresar"');
    for (const ausente of ["Código QR", "data-clave-totp", "Activar", "CLAVE_NO_DISPONIBLE", "versión v1", "CIFRADO_CLAVE", "cuya clave no está cargada", CLAVE_V1, CLAVE_V2]) {
      expect(html, ausente).not.toContain(ausente);
    }
    expect(await foto(id)).toEqual(antes);
  });

  it("el registro dice solo el código del error: ni su mensaje, ni la versión, ni las claves", async () => {
    await cuentaConPendienteEnV1();
    retirarV1();
    await Enrolar();
    const registrado = registro.mock.calls.flat().map(String).join("\n");
    expect(registrado).toContain("[sesion] no se pudo mostrar el enrolamiento (código: CLAVE_NO_DISPONIBLE)");
    for (const filtrado of ["cuya clave no está cargada", "CIFRADO_CLAVE", CLAVE_V2, CLAVE_V1]) {
      expect(registrado, filtrado).not.toContain(filtrado);
    }
  });
});
