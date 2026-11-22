// Candado del esquema (INV-SPEC-5): reglas del modelo de datos que no deben aflojarse.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const esquema = readFileSync(fileURLToPath(new URL("../../prisma/schema.prisma", import.meta.url)), "utf8");
// Sin comentarios, para que una palabra en un comentario no engañe a las reglas.
const codigo = esquema.replace(/\/\/.*$/gm, "");

function campos(modelo: string): Map<string, string> {
  const bloque = new RegExp(`model ${modelo} \\{([\\s\\S]*?)\\n\\}`).exec(codigo);
  if (!bloque?.[1]) throw new Error(`No existe el modelo ${modelo}`);
  const mapa = new Map<string, string>();
  for (const linea of bloque[1].split("\n")) {
    const m = /^\s+(\w+)\s+(\S+)(.*)$/.exec(linea);
    if (m?.[1] && m[2] && !m[1].startsWith("@@")) mapa.set(m[1], `${m[2]}${m[3] ?? ""}`);
  }
  return mapa;
}

describe("candado del esquema", () => {
  it("no usa Float en ningún campo (el dinero va en Decimal)", () => {
    expect(codigo).not.toMatch(/\sFloat\??(\s|$)/m);
  });

  it.each([
    ["MovimientoCaja", "monto"],
    ["Orden", "precioUnitario"],
    ["Orden", "totalInvertido"],
    ["Orden", "comision"],
    ["Orden", "totalEstimado"],
    ["Dividendo", "montoNeto"],
    ["Dividendo", "montoBruto"],
    ["Dividendo", "retencion"],
    ["AjusteCaja", "monto"],
    ["Lote", "costoUnitario"],
    ["Lote", "costoTotal"],
    ["Lote", "comision"],
    ["AsignacionVenta", "costoBase"],
    ["MovimientoFondo", "unidades"],
    ["ValorUnidadFondo", "valorUnidad"],
    ["PrecioCierre", "precio"],
    ["Certificacion", "saldoEfectivo"],
    ["DividendoDecretado", "valorPorAccion"],
    ["ValorSerieOficial", "valor"],
  ])("%s.%s es Decimal con precisión explícita", (modelo, campo) => {
    expect(campos(modelo).get(campo)).toMatch(/^Decimal\??\s+.*@db\.Decimal\(\d+, \d+\)/);
  });

  it.each([
    ["Orden", "cantidadCompletada"],
    ["Lote", "cantidad"],
    ["AsignacionVenta", "cantidad"],
    ["CertificacionPosicion", "cantidad"],
  ])("%s.%s (acciones) es BigInt", (modelo, campo) => {
    expect(campos(modelo).get(campo)).toMatch(/^BigInt\b/);
  });

  it("la moneda solo admite COP en la Fase 1", () => {
    expect(/enum Moneda \{\s*COP\s*\}/.test(codigo)).toBe(true);
  });

  it("los hechos importados apuntan a su fila de origen (trazabilidad)", () => {
    for (const modelo of ["MovimientoCaja", "Orden", "Dividendo", "FilaLoteAv", "DividendoDecretado"]) {
      expect(campos(modelo).get("filaFuenteId"), modelo).toMatch(/^String\s+@unique/);
    }
  });

  it("no guarda el archivo original de las cargas (decisión del CEO)", () => {
    const carga = campos("CargaArchivo");
    for (const [nombre, tipo] of carga) {
      expect(`${nombre} ${tipo}`, nombre).not.toMatch(/Bytes|contenido|archivoOriginal/i);
    }
  });
});
