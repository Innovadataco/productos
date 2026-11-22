// La conciliación del EFECTIVO con los rendimientos del fondo (frente fondo-rendimientos, T6), de punta a punta contra la
// base de PRUEBAS: certificación, constitución, carga de rendimientos por el camino único y conciliar otra vez.
// - Antes de registrarlos, con el aporte ya registrado y más dinero en la caja certificada: rendimientos_fic_sin_registrar.
// - Después, la caja esperada sube EXACTAMENTE la suma de los RENDIMIENTO hasta el corte: la RETENCION no la mueve (el
//   pago ya llega neto) y lo posterior al corte no cuenta. La diferencia que queda dice partida_sin_fuente, con cuántos
//   rendimientos se contaron y el último día.
// La caja es de toda la cuenta (en la base de pruebas, también de los otros archivos): se mide la diferencia, y el saldo
// certificado es grande para que la caja certificada quede por encima de la del sistema. Cifras y fechas inventadas.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conciliarCertificacion } from "@/conciliacion/conciliar";
import { registrarRendimientos } from "@/fondo/rendimientos/registrar";
import { importarCertificacion } from "@/importacion/av/importar";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf } from "../fixtures/av/certificacion.ficticio";

const db = new PrismaClient();
const corrida = String(Date.now()).slice(-5);
const dec = (v: string) => new Prisma.Decimal(v);
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const DIA = 86_400_000;
// Jueves hábil de la BVC de 2027 que no usa ningún otro archivo (la certificación es única por corte).
const CORTE = dia("2027-05-27");
const CONSTITUCION = dia("2027-04-14");
const RENDIMIENTO_ABRIL = "48213.3719";
const RENDIMIENTO_MAYO = "47931.0457";
const CSV = [
  `2027-04-21,RENDIMIENTO,${RENDIMIENTO_ABRIL}`,
  "2027-04-21,RETENCION,1748.6233",
  `2027-05-19,RENDIMIENTO,${RENDIMIENTO_MAYO}`,
  "2027-05-19,RETENCION,1738.3811",
  // Posterior al corte: no cuenta en ese corte.
  "2027-06-02,RENDIMIENTO,48107.2263",
];

let email = "";
let duenoId = "";
let fondo = { id: "", codigo: "" };

async function efectivo() {
  const { conciliacionId } = await conciliarCertificacion(db, { fechaCorte: CORTE });
  return db.controlConciliacion.findFirstOrThrow({ where: { conciliacionId, tipo: "EFECTIVO" } });
}

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  email = `dueno-conciliacion-rendimientos-${corrida}@ejemplo.invalid`;
  duenoId = (await db.usuario.create({ data: { email, rol: "DUENO" } })).id;
  const codigo = `73${corrida}`;
  fondo = { id: (await db.instrumento.create({ data: { tipo: "FIC", codigoFic: codigo, nombre: "Fondo ficticio de conciliación" } })).id, codigo };
  const ajuste = await db.ajusteCaja.create({
    data: { fecha: CONSTITUCION, monto: dec("-3713946.2817"), categoria: "APORTE_FIC", fuente: "EXTRACTO", motivo: "aporte ficticio", creadoPorId: duenoId },
  });
  await db.movimientoFondo.create({
    data: { fondoId: fondo.id, fecha: CONSTITUCION, unidades: dec("1237.48215"), monto: dec("3713946.2817"), tipo: "CONSTITUCION", fuente: "EXTRACTO", ajusteCajaId: ajuste.id },
  });
  const espec = {
    ...CERTIFICACION_FICTICIA,
    fondos: [{ ...CERTIFICACION_FICTICIA.fondos[0]!, nit: `99703${corrida}-1` }],
    efectivo: [{ ...CERTIFICACION_FICTICIA.efectivo[0]!, saldo: "COP 9.871.234.567,89" }],
    creadoEn: `D:${new Date(CORTE.getTime() + DIA).toISOString().slice(0, 10).replace(/-/g, "")}101500-05'00'`,
  };
  const r = await importarCertificacion(db, { contenido: generarCertificacionPdf(espec), usuarioId: duenoId, fechaCorte: CORTE, fondoCodigo: codigo, hoy: new Date(CORTE.getTime() + 2 * DIA) });
  expect(r.errores).toEqual([]);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("EFECTIVO con los rendimientos del fondo", () => {
  it("sin rendimientos registrados dice rendimientos_fic_sin_registrar; después la caja esperada sube exactamente lo que entró hasta el corte", async () => {
    const antes = await efectivo();
    expect([antes.resultado, antes.codigoMotivo]).toEqual(["NO_CUADRA", "rendimientos_fic_sin_registrar"]);
    expect(antes.diferencia!.gt(0)).toBe(true);

    const r = await registrarRendimientos(db, { contenido: new TextEncoder().encode(["fecha,tipo,valor", ...CSV].join("\n")), email, codigoFic: fondo.codigo, aplicar: true }, { ahora: new Date("2027-11-19T15:00:00Z") });
    expect(r).toMatchObject({ estado: "APLICADO", conteos: { rendimientos: 3, retenciones: 2 } });

    const despues = await efectivo();
    // Solo los RENDIMIENTO hasta el corte: ni las retenciones (el pago ya llega neto) ni el de junio.
    expect(despues.esperado!.sub(antes.esperado!).toString()).toBe(dec(RENDIMIENTO_ABRIL).add(RENDIMIENTO_MAYO).toString());
    expect([despues.resultado, despues.codigoMotivo]).toEqual(["NO_CUADRA", "partida_sin_fuente"]);
    expect(despues.detalle).toEqual({ sinExplicar: despues.diferencia!.toString(), rendimientosFic: 2, ultimoRendimientoFic: "2027-05-19" });
  });
});
