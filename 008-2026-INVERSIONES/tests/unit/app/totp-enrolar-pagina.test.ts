// /totp/enrolar (O3) con la lectura del enrolamiento simulada: un ErrorCifrado (cualquier código) se muestra
// como el aviso fijo y se registra solo su código; todo lo demás (las redirecciones de Next, un error de la
// base o de cálculo) se propaga, para que lo atienda Next o src/app/error.tsx. La prueba con la clave
// retirada de verdad está en tests/integracion/auth-totp-enrolar-pagina.test.ts. Datos inventados.
import { Prisma } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCifrado, type CodigoCifrado } from "@/cifrado/errores";

const datosDeEnrolamiento = vi.hoisted(() => vi.fn());
const exigirPresesion = vi.hoisted(() => vi.fn());
vi.mock("@/auth/enrolamiento", () => ({ datosDeEnrolamiento }));
vi.mock("@/auth/presesion-servidor", () => ({ exigirPresesion }));
vi.mock("@/lib/db", () => ({ db: {} }));

import Enrolar from "@/app/totp/enrolar/page";

const AVISO =
  "No se pudo preparar el segundo factor. Corra crear-acceso-inicial --reiniciar-totp (o pida un enlace nuevo con crear-acceso-inicial) y vuelva a entrar con su clave antes de 30 minutos. Si se repite, revise el registro del servidor.";
/** Los dos avisos ofrecen volver a ingresar (revisión react, MEDIO): la pre-sesión sigue viva y no hay otra salida. */
const VOLVER = '<a class="acceso-boton" href="/ingresar">Volver a ingresar</a>';
let registro: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  exigirPresesion.mockResolvedValue({ sub: "u-ficticio", sesionVersion: 1, jti: "jti-ficticio" });
  registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  registro.mockRestore();
  datosDeEnrolamiento.mockReset();
  exigirPresesion.mockReset();
});

describe("src/app/totp/enrolar/page.tsx · errores (O3)", () => {
  it.each<CodigoCifrado>(["CLAVE_NO_DISPONIBLE", "AUTENTICACION_FALLIDA", "SOBRE_INVALIDO", "CONTENIDO_INVALIDO", "CLAVE_AUSENTE"])(
    "un ErrorCifrado %s muestra el aviso fijo en su caja (role=alert), sin QR ni formulario, y registra solo el código",
    async (codigo) => {
      datosDeEnrolamiento.mockRejectedValueOnce(new ErrorCifrado(codigo, "v9"));
      const html = renderToStaticMarkup(await Enrolar());
      expect(html).toContain(`<p class="acceso-aviso" role="alert">${AVISO}</p>`);
      expect(html).toContain('<h1 id="titulo-enrolar">Segundo factor</h1>');
      expect(html).toContain(VOLVER);
      for (const ausente of ["acceso-qr", "data-clave-totp", "Activar", codigo, "v9", "CIFRADO_CLAVE"]) expect(html, ausente).not.toContain(ausente);
      expect(registro).toHaveBeenCalledTimes(1);
      expect(registro).toHaveBeenCalledWith(`[sesion] no se pudo mostrar el enrolamiento (código: ${codigo})`);
      expect(JSON.stringify(registro.mock.calls)).not.toContain("v9");
    },
  );

  it("un error que no es de cifrado se propaga (lo atiende error.tsx) y no se registra aquí", async () => {
    const base = new Prisma.PrismaClientInitializationError("Can't reach postgresql://ficticio@host-ficticio", "5.22.0", "P1001");
    datosDeEnrolamiento.mockRejectedValueOnce(base);
    await expect(Enrolar()).rejects.toBe(base);
    datosDeEnrolamiento.mockRejectedValueOnce(new Error("fallo de cálculo ficticio"));
    await expect(Enrolar()).rejects.toThrow("fallo de cálculo ficticio");
    expect(registro).not.toHaveBeenCalled();
  });

  it("las redirecciones de Next se propagan: sin pre-sesión no se lee nada, y VENCIDA o ACTIVO redirigen", async () => {
    const sinPresesion = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/ingresar;307;" });
    exigirPresesion.mockRejectedValueOnce(sinPresesion);
    await expect(Enrolar()).rejects.toBe(sinPresesion);
    expect(datosDeEnrolamiento).not.toHaveBeenCalled();
    for (const [estado, destino] of [["VENCIDA", "/ingresar"], ["ACTIVO", "/totp"]] as const) {
      datosDeEnrolamiento.mockResolvedValueOnce({ estado });
      await expect(Enrolar(), estado).rejects.toMatchObject({ digest: expect.stringContaining(`NEXT_REDIRECT;replace;${destino};`) });
    }
    expect(registro).not.toHaveBeenCalled();
  });

  it("FUERA_DE_PLAZO sigue con su propio aviso (no el de cifrado)", async () => {
    datosDeEnrolamiento.mockResolvedValueOnce({ estado: "FUERA_DE_PLAZO" });
    const html = renderToStaticMarkup(await Enrolar());
    expect(html).toContain("Pasaron más de 30 minutos");
    expect(html).toContain(VOLVER);
    expect(html).not.toContain(AVISO);
  });

  it("LISTO pinta el QR, la clave base32 y el formulario, sin avisos (sin base)", async () => {
    datosDeEnrolamiento.mockResolvedValueOnce({
      estado: "LISTO",
      email: "dueno@ejemplo.invalid",
      secreto: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
      uri: "otpauth://totp/Inversiones:dueno%40ejemplo.invalid?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Inversiones",
    });
    const html = renderToStaticMarkup(await Enrolar());
    expect(html).toContain('aria-label="Código QR para la app autenticadora"');
    expect(html).toContain("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP");
    expect(html).toContain("Activar");
    // El formulario trae su propio aviso vacío (role="alert"); aquí se afirma que no hay ninguno de los dos avisos.
    for (const ausente of ["No se pudo preparar el segundo factor", "Pasaron más de 30 minutos", VOLVER]) expect(html, ausente).not.toContain(ausente);
    expect(registro).not.toHaveBeenCalled();
  });
});
