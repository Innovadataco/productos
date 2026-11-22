// De la lectura de los decretos (C5b: Decimal, bigint y Date) a la vista de la sección de /datos-oficiales (texto)
// (frente datos-oficiales-decretos-pantalla, C6b). Puro:
// - los montos, exactos desde el Decimal (sin notación exponencial ni redondeo); las tenencias, del bigint (también más
//   allá de 2^53 y negativas); las fechas, el día UTC de la columna DATE;
// - la especie sale del instrumento (nemotécnico o, si no tiene, el nombre); la referencia y la versión de cada decreto
//   del cruce, de su fila; si falta alguna en la lectura (no pasa en una misma foto) es un defecto: lanza, no se inventa;
// - el cruce, lo más reciente primero; los próximos, en el orden de C5b; los grupos que no esperaban pago, contados por
//   decreto. Cifras inventadas; fechas de 2021.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { FilaCruce } from "@/datos-oficiales/decretos/cruce";
import type { Proximo } from "@/datos-oficiales/decretos/proximos";
import { aDecretosVista, type LecturaDecretosPantalla } from "@/app/datos-oficiales/serializar-decretos";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const D = (v: string) => new Prisma.Decimal(v);

const proximoLeido = (c: Partial<Proximo> = {}): Proximo => ({
  id: "dec-p1", instrumentoId: "ins-a", nemotecnico: "FICTA", tipo: "ORDINARIO", cuota: 2, valorPorAccion: D("41.37"), fechaAnuncio: dia("2021-02-24"),
  fechaEx: dia("2021-03-17"), fechaPago: dia("2021-03-24"), referenciaOficial: "https://www.superfinanciera.gov.co/ficticio/c6b-p1", version: 2,
  tenencia: 1237n, brutoEstimado: D("51174.69"), ...c,
});

const filaLeida = (c: Partial<FilaCruce> = {}): FilaCruce => ({
  estado: "RECIBIDO", instrumentoId: "ins-a", fechaPago: dia("2021-02-17"),
  decretos: [{ decretoId: "dec-1", tipo: "ORDINARIO", cuota: 1, fechaEx: dia("2021-02-10"), valorPorAccion: D("4.291731"), tenenciaAntesDeLaEx: 1237n, bruto: D("5308.871247") }],
  pagos: [{ id: "pag-1", instrumentoId: "ins-a", fechaPago: dia("2021-02-19"), montoNeto: D("4613.27"), tipo: "ORDINARIO" }],
  brutoEsperado: D("5308.871247"), netoRecibido: D("4613.27"), diferenciaBrutoNeto: D("695.601247"), motivos: [], ...c,
});

const sinDecreto = filaLeida({
  estado: "SIN_DECRETO", instrumentoId: "ins-c", fechaPago: dia("2020-11-18"), decretos: [],
  pagos: [{ id: "pag-4", instrumentoId: "ins-c", fechaPago: dia("2020-11-18"), montoNeto: D("37.91"), tipo: "ORDINARIO" }],
  brutoEsperado: null, netoRecibido: D("37.91"), diferenciaBrutoNeto: null,
});

const lectura = (c: Partial<LecturaDecretosPantalla> = {}): LecturaDecretosPantalla => ({
  desde: dia("2020-03-17"),
  lectura: { cruce: { filas: [sinDecreto, filaLeida()], sinTenencia: [{ instrumentoId: "ins-b", fechaPago: dia("2020-06-10"), decretoIds: ["dec-8", "dec-9"] }] }, proximos: [proximoLeido()] },
  especies: new Map([["ins-a", { nemotecnico: "FICTA", nombre: "Ficticia A" }], ["ins-c", { nemotecnico: null, nombre: "Ficticia C sin nemotécnico" }]]),
  referencias: new Map([["dec-1", { referenciaOficial: "https://www.bvc.com.co/ficticio/c6b-1", version: 3 }]]),
  ...c,
});

describe("aDecretosVista", () => {
  it("desde, próximos, cruce (lo más reciente primero) y los que no esperaban pago, contados por decreto", () => {
    expect(aDecretosVista(lectura())).toEqual({
      desde: "2020-03-17",
      proximos: [{
        clave: "dec-p1", especie: "FICTA", tipo: "ORDINARIO", cuota: 2, valorPorAccion: "41.37", fechaEx: "2021-03-17", fechaPago: "2021-03-24",
        referencia: "https://www.superfinanciera.gov.co/ficticio/c6b-p1", version: 2, tenencia: "1237", brutoEstimado: "51174.69",
      }],
      cruce: [
        {
          clave: "dec-1", estado: "RECIBIDO", especie: "FICTA", fechaPago: "2021-02-17",
          decretos: [{
            clave: "dec-1", tipo: "ORDINARIO", cuota: 1, fechaEx: "2021-02-10", valorPorAccion: "4.291731", tenenciaAntesDeLaEx: "1237", bruto: "5308.871247",
            referencia: "https://www.bvc.com.co/ficticio/c6b-1", version: 3,
          }],
          pagos: [{ clave: "pag-1", fechaPago: "2021-02-19", montoNeto: "4613.27" }],
          brutoEsperado: "5308.871247", netoRecibido: "4613.27", diferenciaBrutoNeto: "695.601247", motivos: [],
        },
        {
          clave: "pag-4", estado: "SIN_DECRETO", especie: "Ficticia C sin nemotécnico", fechaPago: "2020-11-18", decretos: [],
          pagos: [{ clave: "pag-4", fechaPago: "2020-11-18", montoNeto: "37.91" }], brutoEsperado: null, netoRecibido: "37.91", diferenciaBrutoNeto: null, motivos: [],
        },
      ],
      sinTenencia: 2,
    });
  });

  it("los montos, exactos y sin notación exponencial; las tenencias, del bigint (más allá de 2^53 y negativas)", () => {
    const grande = 2n ** 60n + 7n;
    const v = aDecretosVista(lectura({
      lectura: {
        cruce: { filas: [filaLeida({ estado: "REVISAR", motivos: ["TENENCIA_NEGATIVA"], decretos: [{ ...filaLeida().decretos[0]!, tenenciaAntesDeLaEx: -10n, bruto: D("-42.91731") }], brutoEsperado: D("-42.91731"), diferenciaBrutoNeto: D("0") })], sinTenencia: [] },
        proximos: [proximoLeido({ tenencia: grande, valorPorAccion: D("0.000001"), brutoEstimado: D("1152921504606.846983") }), proximoLeido({ id: "dec-p2", tenencia: -10n, brutoEstimado: null })],
      },
    }));
    expect(v.proximos.map((p) => [p.tenencia, p.valorPorAccion, p.brutoEstimado])).toEqual([[grande.toString(), "0.000001", "1152921504606.846983"], ["-10", "41.37", null]]);
    expect(v.cruce[0]).toMatchObject({ estado: "REVISAR", motivos: ["TENENCIA_NEGATIVA"], brutoEsperado: "-42.91731", diferenciaBrutoNeto: "0" });
    expect(v.cruce[0]!.decretos[0]).toMatchObject({ tenenciaAntesDeLaEx: "-10", bruto: "-42.91731" });
  });

  it("un próximo sin nemotécnico lleva el nombre de su instrumento", () => {
    const v = aDecretosVista(lectura({
      lectura: { cruce: { filas: [], sinTenencia: [] }, proximos: [proximoLeido({ instrumentoId: "ins-c", nemotecnico: null })] },
    }));
    expect(v.proximos[0]!.especie).toBe("Ficticia C sin nemotécnico");
  });

  it("los motivos van tal cual (una copia, en el orden de C5b)", () => {
    const motivos = ["PAGO_EN_DISPUTA", "CARGA_NO_CUBRE_LA_EX"] as const;
    const v = aDecretosVista(lectura({ lectura: { cruce: { filas: [filaLeida({ estado: "REVISAR", motivos })], sinTenencia: [] }, proximos: [] } }));
    expect(v.cruce[0]!.motivos).toEqual(motivos);
    expect(v.cruce[0]!.motivos).not.toBe(motivos);
  });

  it("si falta la especie o la referencia en la lectura, es un defecto: lanza (no se inventa «—»)", () => {
    expect(() => aDecretosVista(lectura({ especies: new Map() }))).toThrow(/especie/);
    expect(() => aDecretosVista(lectura({ referencias: new Map() }))).toThrow(/referencia/);
    const huerfano = lectura({ lectura: { cruce: { filas: [], sinTenencia: [] }, proximos: [proximoLeido({ instrumentoId: "ins-x", nemotecnico: null })] } });
    expect(() => aDecretosVista(huerfano)).toThrow(/especie/);
  });

  it("no cambia la lectura que recibe", () => {
    const l = lectura();
    const antes = l.lectura.cruce.filas.map((f) => f.fechaPago.getTime());
    aDecretosVista(l);
    expect(l.lectura.cruce.filas.map((f) => f.fechaPago.getTime())).toEqual(antes);
  });
});
