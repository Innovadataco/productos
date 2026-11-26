// La página /conciliacion REAL contra la base de PRUEBAS (PR-C, GATE 1 aprobada), con la sesión simulada: una
// certificación ficticia importada con su importador y conciliada. El HTML muestra el corte, las especies y el
// porqué, y nunca el encargo (ni en claro ni cifrado), el titular, la cuenta ni las referencias a filas del PDF.
// Miércoles de junio de 2025 (otro archivo usa febrero y marzo de 2025). Datos inventados.
import { PrismaClient } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { conciliarCertificacion } from "@/conciliacion/conciliar";
import { importarCertificacion } from "@/importacion/av/importar";
import { importarArchivoTrii } from "@/importacion/trii/importar";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf, type EspecCertificacion } from "../fixtures/av/certificacion.ficticio";

const exigirSesion = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirSesion }));
// El tablero trae el botón «Analizar con IA» si el interruptor de config_ia está encendido: su useRouter pide el router de Next.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import Pagina from "@/app/conciliacion/page";
import Inicio from "@/app/page";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const digitos = corrida.replace(/\D/g, "").padEnd(3, "0").slice(0, 3);
const DIA = 86_400_000;
const FECHA = new Date(Date.UTC(2025, 5, 4));
const ISO = FECHA.toISOString().slice(0, 10);
const ENCARGO = "000881234";
const TITULAR = "Titular Ficticio de Pantalla";
const CUENTA = "4417723";
const NEMOS = ["A", "B"].map((l) => `P${corrida}${l}`);
const ENCABEZADO = "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado";
let fondoId = "";

/** Como escapa React el texto en el HTML: el sobre cifrado (JSON) aparecería con «&quot;», no con comillas. */
const escapado = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
/** El texto tal cual, escapado, y cada cadena larga del sobre por separado (el cifrado, el nonce, la etiqueta). */
function formasDe(t: string): string[] {
  let partes: string[] = [];
  try {
    partes = Object.values(JSON.parse(t) as Record<string, unknown>).filter((v): v is string => typeof v === "string" && v.length >= 12);
  } catch {
    partes = [];
  }
  return [t, escapado(t), ...partes];
}

const orden = (nemo: string, cantidad: number, precio: number) =>
  `"21 may 2025, 10:00 a. m.",${nemo},Compra,Aprobado,${cantidad}/${cantidad},0,${precio}.0,${cantidad * precio}.0,0,${cantidad * precio}.0`;

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  const dueno = await db.usuario.create({ data: { email: `dueno-pagina-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } });
  exigirSesion.mockResolvedValue({ id: dueno.id, email: dueno.email, rol: "DUENO" });
  const csv = `${ENCABEZADO}\n${orden(NEMOS[0]!, 150, 1000)}\n${orden(NEMOS[1]!, 2000, 20)}\n`;
  expect((await importarArchivoTrii(db, { nombreArchivo: "ordenes-pagina.ficticio.csv", contenido: new TextEncoder().encode(csv), usuarioId: dueno.id })).estado).toBe("CARGADO");
  const fic = await db.instrumento.create({ data: { tipo: "FIC", codigoFic: `2001${digitos}`, nombre: "Fondo ficticio de pantalla" } });
  fondoId = fic.id;
  const rv = CERTIFICACION_FICTICIA.rentaVariable;
  const espec: EspecCertificacion = {
    fondos: [{ ...CERTIFICACION_FICTICIA.fondos[0]!, nit: `99500${digitos}1-0`, encargo: ENCARGO }],
    rentaVariable: [{ ...rv[0]!, nemo: NEMOS[0]! }, { ...rv[1]!, nemo: NEMOS[0]! }, { ...rv[2]!, nemo: NEMOS[1]! }],
    efectivo: [{ nombre: TITULAR, cuenta: CUENTA, saldo: "COP 1.000,00" }],
    creadoEn: `D:${new Date(FECHA.getTime() + DIA).toISOString().slice(0, 10).replace(/-/g, "")}101500-05'00'`,
  };
  const c = await importarCertificacion(db, { contenido: generarCertificacionPdf(espec), usuarioId: dueno.id, fechaCorte: FECHA, fondoCodigo: fic.codigoFic!, hoy: new Date(FECHA.getTime() + 2 * DIA) });
  expect(c.errores).toEqual([]);
  await conciliarCertificacion(db, { fechaCorte: FECHA });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("página /conciliacion contra la base", () => {
  it("muestra el corte, las especies, el fondo por su nombre y el porqué; nunca encargo, titular, cuenta ni referencias del PDF", async () => {
    const html = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve({ corte: ISO }) }));
    expect(html).toContain("Corte del 4-jun-2025:");
    for (const nemo of NEMOS) expect(html).toContain(`<th scope="row">${nemo}</th>`);
    expect(html).toContain("Fondo ficticio de pantalla");
    expect(html).toContain("falta registrar las unidades del fondo");
    expect(html).toContain('aria-current="page"');

    const cifrado = (await db.certificacionFondo.findFirstOrThrow({ where: { instrumentoId: fondoId }, select: { encargo: true } })).encargo;
    expect(cifrado).not.toBe(ENCARGO);
    expect(formasDe(cifrado).length).toBeGreaterThanOrEqual(3);
    for (const prohibido of [ENCARGO, ...formasDe(cifrado), TITULAR, CUENTA]) expect(html).not.toContain(prohibido);
    const referencias = await db.certificacionPosicion.findMany({ where: { certificacion: { fechaCorte: FECHA } }, select: { referenciaPdf: true } });
    expect(referencias.length).toBeGreaterThan(0);
    for (const r of referencias) expect(html).not.toContain(r.referenciaPdf!);
    expect(html).not.toMatch(/p\d+:f\d+/);
  });

  it("el tablero real trae la línea que enlaza a /conciliacion", async () => {
    const html = renderToStaticMarkup(await Inicio());
    expect(html).toMatch(/<p class="nota"><a href="\/conciliacion">Conciliación con A&amp;V al \d{1,2}-[a-z]{3}-\d{4}: [^<]+<\/a><\/p>/);
  });
});
