import { describe, it, expect } from "vitest";
import { fusionarRRF, type EntradaRanking } from "./rrf";

const OPC = { pesoFts: 1, pesoVectorial: 1, rrfK: 60, topK: 10 };

describe("fusionarRRF (spec 003, FR-015)", () => {
  it("un documento en ambas ramas puntúa más que uno en una sola", () => {
    const fts: EntradaRanking[] = [{ documentoId: "A", posicion: 0 }, { documentoId: "B", posicion: 1 }];
    const vec: EntradaRanking[] = [{ documentoId: "A", posicion: 0 }, { documentoId: "C", posicion: 1 }];

    const r = fusionarRRF(fts, vec, OPC);

    expect(r[0].documentoId).toBe("A");
    expect(r[0].fuente).toBe("ambas");
    expect(r.find((x) => x.documentoId === "B")?.fuente).toBe("fts");
    expect(r.find((x) => x.documentoId === "C")?.fuente).toBe("vectorial");
  });

  it("cada documento aparece una sola vez aunque esté en las dos ramas (FR-014)", () => {
    const fts: EntradaRanking[] = [{ documentoId: "A", posicion: 0 }];
    const vec: EntradaRanking[] = [{ documentoId: "A", posicion: 0 }];

    const r = fusionarRRF(fts, vec, OPC);

    expect(r).toHaveLength(1);
    expect(r[0].documentoId).toBe("A");
  });

  it("cambiar los pesos cambia el orden sin tocar código (SC-014)", () => {
    const fts: EntradaRanking[] = [{ documentoId: "TEXTUAL", posicion: 0 }];
    const vec: EntradaRanking[] = [{ documentoId: "SEMANTICO", posicion: 0 }];

    const pesaFts = fusionarRRF(fts, vec, { ...OPC, pesoFts: 5, pesoVectorial: 1 });
    const pesaVec = fusionarRRF(fts, vec, { ...OPC, pesoFts: 1, pesoVectorial: 5 });

    expect(pesaFts[0].documentoId).toBe("TEXTUAL");
    expect(pesaVec[0].documentoId).toBe("SEMANTICO");
  });

  it("recorta a topK", () => {
    const fts: EntradaRanking[] = Array.from({ length: 20 }, (_, i) => ({ documentoId: `D${i}`, posicion: i }));

    const r = fusionarRRF(fts, [], { ...OPC, topK: 5 });

    expect(r).toHaveLength(5);
  });

  it("una posición mejor (menor) puntúa más", () => {
    const fts: EntradaRanking[] = [{ documentoId: "PRIMERO", posicion: 0 }, { documentoId: "ULTIMO", posicion: 9 }];

    const r = fusionarRRF(fts, [], OPC);

    expect(r[0].documentoId).toBe("PRIMERO");
  });

  it("empates estables por documentoId", () => {
    const fts: EntradaRanking[] = [{ documentoId: "B", posicion: 0 }, { documentoId: "A", posicion: 0 }];

    const r = fusionarRRF(fts, [], OPC);

    expect(r.map((x) => x.documentoId)).toEqual(["A", "B"]);
  });

  it("solo rama FTS (sin vectorial) devuelve resultados: degradación útil (US4-4)", () => {
    const fts: EntradaRanking[] = [{ documentoId: "A", posicion: 0 }];

    const r = fusionarRRF(fts, [], OPC);

    expect(r).toHaveLength(1);
    expect(r[0].fuente).toBe("fts");
  });
});
