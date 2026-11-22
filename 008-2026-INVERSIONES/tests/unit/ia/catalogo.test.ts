/**
 * Candado del catálogo cerrado de hechos-v1: las claves exactas por tipo, sin dígitos; las etiquetas genéricas, sin
 * dígitos, sin cifras en palabras, sin nombres de especie (ninguna palabra en mayúsculas salvo las siglas) y sin
 * recomendaciones ni predicciones; el nombre de la especie como hecho propio en los tres tipos.
 */
import { describe, expect, it } from "vitest";
import { CATALOGO, CLAVE_NOMBRE_ESPECIE, clavesDe, entradaDeCatalogo } from "@/ia/catalogo";
import { TIPOS_RESUMEN, UNIDADES } from "@/ia/contrato";

const ESPERADAS = {
  DIARIO: [
    "ESPECIE_NOMBRE", "VALOR_ACCIONES", "GANANCIA_SIN_VENDER", "GANANCIA_POR_VENTAS", "DIVIDENDOS_RECIBIDOS", "COMISIONES_PAGADAS",
    "GANANCIA_TOTAL", "VARIACION_DIA_VALOR", "VARIACION_DIA_PORCENTAJE", "ESPECIES_SIN_PRECIO", "ESPECIES_ATRASADAS",
    "FECHA_CIERRE_RECIENTE", "FECHA_CIERRE_MAS_ANTIGUO", "CONCILIACION_CUADRA", "CONCILIACION_PARCIAL", "CONCILIACION_NO_CUADRA",
    "TASA_TRM", "TASA_TPM", "TASA_IBR", "VARIACION_ANUAL_IPC", "FONDO_VALOR", "FONDO_VALOR_UNIDAD", "FONDO_FECHA_VALOR",
    "VALOR_ESPECIE", "PESO_ESPECIE", "RENTABILIDAD_ESPECIE", "CIERRE_ESPECIE", "FECHA_CIERRE_ESPECIE", "VARIACION_DIA_ESPECIE",
  ],
  REGLAS: [
    "ESPECIE_NOMBRE", "CIERRE_ESPECIE", "FECHA_CIERRE_ESPECIE", "REGLA_NIVEL", "REGLA_TOCADA", "REGLA_EN_EL_NIVEL", "REGLA_DISTANCIA",
    "REGLA_SIN_CIERRE_AL_DIA", "REGLA_PLAZO", "REGLA_DIAS_AL_PLAZO", "PROXIMO_EX_DIVIDENDO", "DIAS_A_EX_DIVIDENDO",
    "DIVIDENDO_POR_ACCION", "DIVIDENDO_FECHA_PAGO", "DIVIDENDO_BRUTO_ESTIMADO",
  ],
  ESCENARIOS: [
    "ESPECIE_NOMBRE", "VALOR_INICIAL", "HORIZONTE_CORTO", "HORIZONTE_MEDIO", "HORIZONTE_LARGO",
    "ESCENARIO_BAJO_CORTO", "ESCENARIO_BAJO_MEDIO", "ESCENARIO_BAJO_LARGO", "ESCENARIO_CENTRAL_CORTO", "ESCENARIO_CENTRAL_MEDIO",
    "ESCENARIO_CENTRAL_LARGO", "ESCENARIO_ALTO_CORTO", "ESCENARIO_ALTO_MEDIO", "ESCENARIO_ALTO_LARGO",
    "APORTADO_CORTO", "APORTADO_MEDIO", "APORTADO_LARGO", "PROBABILIDAD_BAJO_APORTADO", "CAIDA_MAXIMA_MEDIANA", "VOLATILIDAD_ANUAL",
    "RENDIMIENTO_ANUAL_HISTORICO", "FRACCION_PROYECTADA", "VENTANA_DESDE", "VENTANA_HASTA", "DIAS_HISTORIA_ESPECIE",
  ],
} as const;

const SIGLAS = new Set(["TRM", "TPM", "IBR", "IPC"]);
/** Cifras en palabras (palabra completa). «medio» queda permitida: el brief pide corto, medio y largo para los horizontes. */
const CIFRAS = new Set([
  "cero", "un", "uno", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece",
  "catorce", "quince", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa", "cien", "ciento", "mil",
  "millón", "millones", "billón", "billones", "primer", "primero", "primera", "segundo", "segunda", "tercer", "tercero", "tercera",
  "cuarto", "cuarta", "quinto", "quinta", "sexto", "sexta", "séptimo", "séptima", "octavo", "octava", "noveno", "novena", "décimo",
  "décima", "mitad", "media", "tercio", "doble", "triple", "decena", "docena", "centena", "centenar", "par", "ambos", "ambas",
]);
const PREFIJOS_CIFRA = ["dieci", "veint", "doscient", "trescient", "cuatrocient", "quinient", "seiscient", "setecient", "ochocient", "novecient"];
/** Palabras de recomendación o predicción («sin vender» es un hecho, no una recomendación: no se prohíbe la raíz). */
const RECOMENDACION_O_PREDICCION = new Set([
  "compre", "compren", "comprar", "venda", "vendan", "mantenga", "mantener", "recomiendo", "recomendamos", "recomendable", "recomendación",
  "debería", "deberían", "conviene", "oportunidad", "aproveche", "objetivo", "subirá", "bajará", "pronóstico", "garantiza", "garantizado",
]);
const FRASES_RECOMENDACION = ["se espera", "sin riesgo", "buen momento", "tome ganancias"];

const entradas = () => TIPOS_RESUMEN.flatMap((tipo) => Object.entries(CATALOGO[tipo]).map(([clave, entrada]) => ({ tipo, clave, entrada })));

describe("catálogo cerrado de claves", () => {
  it.each(TIPOS_RESUMEN)("las claves de %s son exactamente las del contrato, en orden", (tipo) => {
    expect(Object.keys(CATALOGO[tipo])).toEqual(ESPERADAS[tipo]);
    expect([...clavesDe(tipo)]).toEqual(ESPERADAS[tipo]);
    expect(Object.isFrozen(clavesDe(tipo))).toBe(true);
  });

  it("el catálogo y cada entrada están congelados", () => {
    expect(Object.isFrozen(CATALOGO)).toBe(true);
    for (const tipo of TIPOS_RESUMEN) expect(Object.isFrozen(CATALOGO[tipo])).toBe(true);
    for (const { entrada } of entradas()) expect(Object.isFrozen(entrada)).toBe(true);
  });

  it("las claves son identificadores en mayúsculas, sin dígitos", () => {
    for (const { clave } of entradas()) expect(clave).toMatch(/^[A-Z]+(?:_[A-Z]+)*$/);
  });

  it("ninguna etiqueta lleva dígitos de ningún sistema de numeración", () => {
    for (const { clave, entrada } of entradas()) expect(entrada.etiqueta, clave).not.toMatch(/\p{N}/u);
  });

  it("ninguna etiqueta lleva cifras en palabras", () => {
    for (const { clave, entrada } of entradas()) {
      const palabras = entrada.etiqueta.toLowerCase().match(/\p{L}+/gu) ?? [];
      expect(palabras.filter((p) => CIFRAS.has(p)), clave).toEqual([]);
      expect(palabras.filter((p) => PREFIJOS_CIFRA.some((prefijo) => p.startsWith(prefijo))), clave).toEqual([]);
    }
  });

  it("ninguna etiqueta lleva palabras en mayúsculas (un nombre de especie), salvo las siglas TRM, TPM, IBR e IPC", () => {
    for (const { clave, entrada } of entradas()) {
      const conMayuscula = (entrada.etiqueta.match(/\p{L}+/gu) ?? []).filter((p) => /\p{Lu}/u.test(p));
      expect(conMayuscula.filter((p) => !SIGLAS.has(p)), clave).toEqual([]);
    }
  });

  it("ninguna etiqueta recomienda ni predice", () => {
    for (const { clave, entrada } of entradas()) {
      const etiqueta = entrada.etiqueta.toLowerCase();
      expect((etiqueta.match(/\p{L}+/gu) ?? []).filter((p) => RECOMENDACION_O_PREDICCION.has(p)), clave).toEqual([]);
      expect(FRASES_RECOMENDACION.filter((f) => etiqueta.includes(f)), clave).toEqual([]);
    }
  });

  it("las etiquetas no son vacías, no tienen espacios al borde y no se repiten dentro de un tipo", () => {
    for (const tipo of TIPOS_RESUMEN) {
      const etiquetas = Object.values(CATALOGO[tipo]).map((e) => e.etiqueta);
      for (const etiqueta of etiquetas) expect(etiqueta.trim()).toBe(etiqueta);
      expect(etiquetas.every((e) => e.length > 0)).toBe(true);
      expect(new Set(etiquetas).size).toBe(etiquetas.length);
    }
  });

  it("los horizontes son corto, medio y largo, sin el número de meses", () => {
    expect(CATALOGO.ESCENARIOS.HORIZONTE_CORTO.etiqueta).toBe("horizonte corto");
    expect(CATALOGO.ESCENARIOS.HORIZONTE_MEDIO.etiqueta).toBe("horizonte medio");
    expect(CATALOGO.ESCENARIOS.HORIZONTE_LARGO.etiqueta).toBe("horizonte largo");
    expect(CATALOGO.ESCENARIOS.HORIZONTE_CORTO.unidad).toBe("MESES");
  });

  it("el nombre de la especie es un hecho propio de los tres tipos, el único con unidad NOMBRE y sin sujeto", () => {
    expect(CLAVE_NOMBRE_ESPECIE).toBe("ESPECIE_NOMBRE");
    for (const tipo of TIPOS_RESUMEN) {
      const entrada = CATALOGO[tipo].ESPECIE_NOMBRE;
      expect(entrada).toMatchObject({ unidad: "NOMBRE", politicaSujeto: "NINGUNO", admiteDireccion: false, admiteCercania: false });
    }
    for (const { clave, entrada } of entradas()) if (clave !== CLAVE_NOMBRE_ESPECIE) expect(entrada.unidad, clave).not.toBe("NOMBRE");
  });

  it("cada entrada tiene una unidad del contrato y un modo de sujeto cerrado; hay claves de especie en los tres tipos", () => {
    for (const { clave, entrada } of entradas()) {
      expect(UNIDADES, clave).toContain(entrada.unidad);
      expect(["EXIGIDO", "OPCIONAL", "NINGUNO"], clave).toContain(entrada.politicaSujeto);
      expect(typeof entrada.admiteDireccion === "boolean" && typeof entrada.admiteCercania === "boolean").toBe(true);
    }
    for (const tipo of TIPOS_RESUMEN) expect(Object.values(CATALOGO[tipo]).some((e) => e.politicaSujeto === "EXIGIDO"), tipo).toBe(true);
  });

  it("las claves por especie exigen sujeto; las del portafolio no lo admiten", () => {
    expect(CATALOGO.DIARIO.VALOR_ESPECIE.politicaSujeto).toBe("EXIGIDO");
    expect(CATALOGO.DIARIO.VALOR_ACCIONES.politicaSujeto).toBe("NINGUNO");
    expect(CATALOGO.REGLAS.REGLA_DISTANCIA).toMatchObject({ politicaSujeto: "EXIGIDO", admiteDireccion: true, admiteCercania: true });
    expect(CATALOGO.REGLAS.REGLA_PLAZO.politicaSujeto).toBe("OPCIONAL");
    expect(CATALOGO.ESCENARIOS.DIAS_HISTORIA_ESPECIE.politicaSujeto).toBe("EXIGIDO");
  });

  it("entradaDeCatalogo solo encuentra claves propias del tipo (ni del prototipo ni de otro tipo)", () => {
    expect(entradaDeCatalogo("DIARIO", "VALOR_ACCIONES")).toBe(CATALOGO.DIARIO.VALOR_ACCIONES);
    expect(entradaDeCatalogo("REGLAS", "VALOR_ACCIONES")).toBeNull();
    for (const rara of ["constructor", "__proto__", "toString", "hasOwnProperty", "", "valor_acciones"]) expect(entradaDeCatalogo("DIARIO", rara)).toBeNull();
    expect(entradaDeCatalogo("OTRO" as never, "VALOR_ACCIONES")).toBeNull();
    expect(entradaDeCatalogo("constructor" as never, "VALOR_ACCIONES")).toBeNull();
  });
});
