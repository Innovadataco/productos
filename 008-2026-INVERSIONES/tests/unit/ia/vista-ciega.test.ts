/**
 * La vista ciega y su guarda. La vista lleva exactamente los campos permitidos; la guarda prueba la CONDUCTA con
 * control positivo: vistas armadas a mano con un dato plantado (un decimal, una presentación es-CO, un nombre de
 * especie ficticio o una clave prohibida) se rechazan con su código, y la vista limpia pasa.
 */
import { describe, expect, it } from "vitest";
import type { PaqueteCiego, PaqueteHechos } from "@/ia/contrato";
import { construirPaquete } from "@/ia/paquete";
import { CODIGOS_FUGA_VISTA, ErrorVistaCiega, asegurarVistaCiega, fugasDeVistaCiega, vistaCiega } from "@/ia/vista-ciega";
import { CAMPOS_HECHO_CIEGO_PERMITIDOS, camposDeMas, fugasEn, hayDigitosFueraDeIds } from "./apoyo/detectores";
import { ENTRADAS_FICTICIAS, ESPECIE_ALFA, entradaDiario } from "./apoyo/hechos.ficticio";

type Mutable = { tipo: unknown; hechos: Record<string, unknown>[] } & Record<string, unknown>;
const paqueteDiario = (): PaqueteHechos => construirPaquete(entradaDiario());
/** Una copia editable de la vista limpia: aquí se plantan los datos. */
const vistaEditable = (paquete: PaqueteHechos): Mutable => structuredClone(vistaCiega(paquete)) as unknown as Mutable;

describe("vistaCiega", () => {
  it.each(Object.keys(ENTRADAS_FICTICIAS) as (keyof typeof ENTRADAS_FICTICIAS)[])("la vista de %s lleva solo tipo y hechos, y cada hecho solo los campos permitidos", (tipo) => {
    const paquete = construirPaquete(ENTRADAS_FICTICIAS[tipo]());
    const vista = vistaCiega(paquete);
    expect(Object.keys(vista).sort()).toEqual(["hechos", "tipo"]);
    expect(vista.tipo).toBe(tipo);
    vista.hechos.forEach((ciego, i) => {
      const original = paquete.hechos[i];
      const esperados = CAMPOS_HECHO_CIEGO_PERMITIDOS.filter((c) => c !== "sujeto" || original?.sujeto !== undefined);
      expect(Object.keys(ciego).sort()).toEqual([...esperados].sort());
      expect(ciego).toMatchObject({ id: original?.id, clave: original?.clave, etiqueta: original?.etiqueta, calidad: original?.calidad });
    });
    expect(camposDeMas(vista)).toEqual([]);
  });

  it("no lleva ni valor, ni presentación, ni unidad, ni fuente, ni fecha, ni hoy, ni avisos, ni versión, ni hash", () => {
    const paquete = paqueteDiario();
    const json = JSON.stringify(vistaCiega(paquete));
    for (const campo of ["valor", "presentacion", "unidad", "fuente", "fecha", "hoy", "avisos", "versionesCalculo", "version", "hash"]) expect(json).not.toContain(`"${campo}"`);
    expect(hayDigitosFueraDeIds(json)).toBe(false);
    expect(fugasEn(json, paquete)).toEqual([]);
  });

  it("conserva el orden y los sujetos, y está congelada", () => {
    const vista = vistaCiega(paqueteDiario());
    expect(vista.hechos.map((h) => h.id)).toEqual(["H01", "H02", "H03", "H04", "H05", "H06", "H07"]);
    expect(vista.hechos[1]?.sujeto).toBe("H01");
    expect(Object.isFrozen(vista) && Object.isFrozen(vista.hechos) && vista.hechos.every((h) => Object.isFrozen(h))).toBe(true);
  });

  it("una copia alterada del paquete (no salió de construirPaquete) no da vista", () => {
    const paquete = paqueteDiario();
    const alterado = { ...paquete, hechos: paquete.hechos.map((h, i) => (i === 2 ? { ...h, calidad: "ESTIMADO" as const } : h)) };
    expect(() => vistaCiega(alterado)).toThrow(ErrorVistaCiega);
    try {
      vistaCiega(alterado);
    } catch (e) {
      expect((e as ErrorVistaCiega).codigos).toEqual(["PAQUETE_NO_CONSTRUIDO"]);
    }
  });
});

describe("guarda de la vista ciega · control positivo", () => {
  it("la vista limpia pasa: sin códigos y asegurarVistaCiega no lanza", () => {
    const paquete = paqueteDiario();
    expect(fugasDeVistaCiega(vistaCiega(paquete), paquete)).toEqual([]);
    expect(() => asegurarVistaCiega(vistaCiega(paquete), paquete)).not.toThrow();
  });

  /** [caso, cómo se planta, códigos que deben estar] */
  const PLANTADOS: readonly (readonly [string, (v: Mutable) => void, readonly string[]])[] = [
    ["un decimal inventado en una etiqueta", (v) => { v.hechos[2]!.etiqueta = "valor de las acciones 7391.53"; }, ["DIGITO_FUERA_DE_REFERENCIA", "NO_CORRESPONDE"]],
    ["un decimal inventado en un campo de más", (v) => { v.hechos[2]!.monto = "7391.53"; }, ["CAMPO_NO_PERMITIDO", "DIGITO_FUERA_DE_REFERENCIA"]],
    ["el valor del paquete en una etiqueta", (v) => { v.hechos[2]!.etiqueta = "valor de las acciones 37911.47"; }, ["DIGITO_FUERA_DE_REFERENCIA", "VALOR_DEL_PAQUETE", "NO_CORRESPONDE"]],
    ["el valor del paquete como campo valor", (v) => { v.hechos[2]!.valor = "37911.47"; }, ["CAMPO_NO_PERMITIDO", "DIGITO_FUERA_DE_REFERENCIA", "VALOR_DEL_PAQUETE"]],
    ["una presentación es-CO inventada", (v) => { v.hechos[2]!.etiqueta = "valor de las acciones $ 7.391"; }, ["DIGITO_FUERA_DE_REFERENCIA", "NO_CORRESPONDE"]],
    ["la presentación del paquete como campo", (v) => { v.hechos[2]!.presentacion = "$ 37.911"; }, ["CAMPO_NO_PERMITIDO", "DIGITO_FUERA_DE_REFERENCIA", "PRESENTACION_DEL_PAQUETE"]],
    ["un porcentaje es-CO con coma", (v) => { v.hechos[6]!.etiqueta = "peso de la especie en el portafolio 12,4 %"; }, ["DIGITO_FUERA_DE_REFERENCIA", "PRESENTACION_DEL_PAQUETE", "NO_CORRESPONDE"]],
    ["el nombre de la especie en una etiqueta", (v) => { v.hechos[0]!.etiqueta = `nombre de la especie ${ESPECIE_ALFA}`; }, ["NOMBRE_DE_ESPECIE", "NO_CORRESPONDE"]],
    ["el nombre de la especie en minúsculas", (v) => { v.hechos[0]!.etiqueta = `nombre de la especie ${ESPECIE_ALFA.toLowerCase()}`; }, ["NOMBRE_DE_ESPECIE", "NO_CORRESPONDE"]],
    ["el nombre de la especie como campo", (v) => { v.hechos[0]!.especie = ESPECIE_ALFA; }, ["CAMPO_NO_PERMITIDO", "NOMBRE_DE_ESPECIE", "CLAVE_PROHIBIDA"]],
    ["una especie ficticia que no está en el paquete", (v) => { v.hechos[0]!.etiqueta = "nombre de la especie FICTICIA-OMEGA"; }, ["NO_CORRESPONDE"]],
    ["una clave prohibida en un hecho", (v) => { v.hechos[3]!.correo = "persona@ficticia.invalid"; }, ["CAMPO_NO_PERMITIDO", "CLAVE_PROHIBIDA"]],
    ["una clave prohibida anidada en la raíz", (v) => { v.extra = { cuenta: { cantidad: "x" } }; }, ["CAMPO_NO_PERMITIDO", "CLAVE_PROHIBIDA"]],
    ["la versión del contrato (lleva un dígito)", (v) => { v.version = "hechos-v1"; }, ["CAMPO_NO_PERMITIDO", "DIGITO_FUERA_DE_REFERENCIA"]],
    ["un dígito de otro sistema de numeración", (v) => { v.hechos[2]!.etiqueta = "valor de las acciones ٣"; }, ["DIGITO_FUERA_DE_REFERENCIA", "NO_CORRESPONDE"]],
    ["un id inventado dentro de un texto", (v) => { v.hechos[2]!.etiqueta = "valor de las acciones H07"; }, ["DIGITO_FUERA_DE_REFERENCIA", "NO_CORRESPONDE"]],
    ["una marca cambiada", (v) => { v.hechos[2]!.direccion = "BAJA"; }, ["NO_CORRESPONDE"]],
    ["un hecho de menos", (v) => { v.hechos.pop(); }, ["NO_CORRESPONDE"]],
    ["otro tipo", (v) => { v.tipo = "REGLAS"; }, ["NO_CORRESPONDE"]],
  ];

  it.each(PLANTADOS)("rechaza %s, con sus códigos", (_caso, plantar, codigos) => {
    const paquete = paqueteDiario();
    const vista = vistaEditable(paquete);
    plantar(vista);
    const halladas = fugasDeVistaCiega(vista, paquete);
    for (const codigo of codigos) expect(halladas).toContain(codigo);
    expect(() => asegurarVistaCiega(vista, paquete)).toThrow(ErrorVistaCiega);
  });

  it.each([
    ["nula", null],
    ["indefinida", undefined],
    ["una función", () => ({ tipo: "DIARIO", hechos: [] })],
    ["un arreglo", []],
    ["sin hechos", { tipo: "DIARIO" }],
    ["con un hecho que no es objeto", { tipo: "DIARIO", hechos: ["H01"] }],
    ["con un hecho sin campos", { tipo: "DIARIO", hechos: [{}] }],
    ["con un bigint", { tipo: "DIARIO", hechos: [], monto: 7n }],
    ["de una clase", new (class Vista { readonly tipo = "DIARIO"; readonly hechos = []; })()],
  ])("rechaza una vista %s por su forma", (_caso, vista) => {
    expect(fugasDeVistaCiega(vista, paqueteDiario())).toContain("FORMA_INVALIDA");
  });

  it("rechaza una vista demasiado profunda para recorrerla", () => {
    const paquete = paqueteDiario();
    const vista = vistaEditable(paquete);
    let profundo: unknown = "x";
    for (let i = 0; i < 70; i += 1) profundo = { a: profundo };
    vista.extra = profundo;
    expect(fugasDeVistaCiega(vista, paquete)).toEqual(["FORMA_INVALIDA"]);
  });

  it("rechaza un getter que cambiaría lo que sale después de revisado", () => {
    const paquete = paqueteDiario();
    const vista = vistaEditable(paquete);
    Object.defineProperty(vista.hechos[2], "etiqueta", { get: () => "valor de las acciones", enumerable: true });
    expect(fugasDeVistaCiega(vista, paquete)).toContain("FORMA_INVALIDA");
  });

  it("rechaza la vista de otro paquete y un paquete de referencia que es una copia alterada", () => {
    const paquete = paqueteDiario();
    const otro = construirPaquete({ ...entradaDiario(), hechos: entradaDiario().hechos.slice(0, 3) });
    expect(fugasDeVistaCiega(vistaCiega(otro), paquete)).toContain("NO_CORRESPONDE");
    const alterado = { ...paquete, hoy: "2027-03-18" };
    expect(fugasDeVistaCiega(vistaCiega(paquete), alterado)).toEqual(["PAQUETE_NO_CONSTRUIDO"]);
  });

  it("el error lleva solo códigos: ni datos plantados ni del paquete", () => {
    const paquete = paqueteDiario();
    const vista = vistaEditable(paquete);
    vista.hechos[2]!.valor = "37911.47";
    vista.hechos[0]!.etiqueta = ESPECIE_ALFA;
    try {
      asegurarVistaCiega(vista, paquete);
      throw new Error("no lanzó");
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorVistaCiega);
      const { message, codigos } = e as ErrorVistaCiega;
      expect(message).not.toMatch(/\p{N}/u);
      expect(message.toLowerCase()).not.toContain("ficticia");
      for (const codigo of codigos) expect(CODIGOS_FUGA_VISTA).toContain(codigo);
    }
  });

  it("asegurarVistaCiega estrecha el tipo de una vista desconocida", () => {
    const paquete = paqueteDiario();
    const desconocida: unknown = structuredClone(vistaCiega(paquete));
    asegurarVistaCiega(desconocida, paquete);
    const vista: PaqueteCiego = desconocida;
    expect(vista.hechos).toHaveLength(7);
  });
});
