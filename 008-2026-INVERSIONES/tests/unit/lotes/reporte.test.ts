// Reporte del comando lotes:construir: solo conteos, códigos e ids internos; nunca cantidades ni costos.
import { describe, expect, it } from "vitest";
import type { ResultadoConstruccion } from "@/lotes/construir";
import { reporteConstruccion } from "@/lotes/reporte";

const base: ResultadoConstruccion = {
  ensayo: false, lotesCreados: 2, especiesConVentas: 3, asignacionesRecalculadas: 4, especiesSinLotes: [], especiesRechazadas: [],
};

describe("reporteConstruccion", () => {
  it("sin avisos: una línea de conteos y salida 0", () => {
    const r = reporteConstruccion(base);
    expect(r.codigoSalida).toBe(0);
    expect(r.lineas).toEqual(["✅ Lotes nuevos: 2 · especies con ventas: 3 · asignaciones FIFO: 4"]);
  });

  it("en ensayo lo dice en la primera línea", () => {
    expect(reporteConstruccion({ ...base, ensayo: true }).lineas[0]).toMatch(/^🧪 Ensayo: no se guardó nada · Lotes nuevos: 2/);
  });

  it("ventas sin lotes: aviso y salida 3", () => {
    const r = reporteConstruccion({ ...base, especiesSinLotes: ["i1"] });
    expect(r.codigoSalida).toBe(3);
    expect(r.lineas.join("\n")).toContain("VENTA_SIN_LOTES");
  });

  it("especies rechazadas: una línea por especie con código, qué significa e ids internos; salida 3", () => {
    const r = reporteConstruccion({
      ...base, ensayo: true,
      especiesRechazadas: [
        { instrumentoId: "i1", codigo: "BLOQUEADA_EXCEDE_LOTE", ventaId: null, loteId: "l1" },
        { instrumentoId: "i2", codigo: "BLOQUEADA_INCOMPLETA", ventaId: "v2", loteId: null },
      ],
    });
    expect(r.codigoSalida).toBe(3);
    const texto = r.lineas.join("\n");
    expect(texto).toContain("2 especie(s) rechazada(s)");
    expect(texto).toMatch(/BLOQUEADA_EXCEDE_LOTE · especie i1 · lote l1 · .+/);
    expect(texto).toMatch(/BLOQUEADA_INCOMPLETA · especie i2 · venta v2 · .+/);
  });
});
