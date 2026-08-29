import { describe, it, expect } from "vitest";
import { posicionesEnCirculo, combinarPosiciones } from "./grafoPosiciones";

describe("posicionesEnCirculo (spec 009, T-b)", () => {
  it("da una posición por identificador", () => {
    const posiciones = posicionesEnCirculo(["a", "b", "c"]);

    expect(Object.keys(posiciones)).toEqual(["a", "b", "c"]);
  });

  it("es pura: mismos identificadores, mismas posiciones", () => {
    expect(posicionesEnCirculo(["a", "b"])).toEqual(posicionesEnCirculo(["a", "b"]));
  });

  it("coloca el primero a la derecha del centro, sobre el radio", () => {
    const { a } = posicionesEnCirculo(["a"], { x: 400, y: 250 }, 180);

    expect(a.x).toBeCloseTo(580);
    expect(a.y).toBeCloseTo(250);
  });

  it("reparte en círculo: con 4 nodos, uno por cuadrante", () => {
    const p = posicionesEnCirculo(["a", "b", "c", "d"], { x: 0, y: 0 }, 100);

    expect(p.a.x).toBeCloseTo(100);
    expect(p.b.y).toBeCloseTo(100);
    expect(p.c.x).toBeCloseTo(-100);
    expect(p.d.y).toBeCloseTo(-100);
  });

  it("sin documentos no lanza y devuelve vacío", () => {
    expect(posicionesEnCirculo([])).toEqual({});
  });
});

describe("combinarPosiciones — el arrastre manda (spec 009, T-b)", () => {
  const iniciales = { a: { x: 0, y: 0 }, b: { x: 10, y: 10 } };

  it("sin nada movido, la disposición inicial se respeta", () => {
    expect(combinarPosiciones(iniciales, {})).toEqual(iniciales);
  });

  it("lo que el usuario movió gana sobre la posición inicial", () => {
    const combinadas = combinarPosiciones(iniciales, { a: { x: 999, y: 999 } });

    expect(combinadas.a).toEqual({ x: 999, y: 999 });
    expect(combinadas.b).toEqual({ x: 10, y: 10 });
  });

  it("al llegar un documento nuevo, lo que el usuario movió SIGUE donde lo dejó", () => {
    // Éste es el caso que el efecto anterior perdía: cambiaba el número de
    // documentos y se reseteaban todas las posiciones arrastradas.
    const movidas = { a: { x: 999, y: 999 } };
    const conNuevo = posicionesEnCirculo(["a", "b", "c"]);

    const combinadas = combinarPosiciones(conNuevo, movidas);

    expect(combinadas.a).toEqual({ x: 999, y: 999 });
    expect(combinadas.c).toEqual(conNuevo.c);
  });

  it("descarta la posición de un documento que ya no está: nada de nodos fantasma", () => {
    const combinadas = combinarPosiciones(iniciales, { borrado: { x: 5, y: 5 } });

    expect(combinadas).not.toHaveProperty("borrado");
    expect(Object.keys(combinadas)).toEqual(["a", "b"]);
  });

  it("no muta lo que recibe", () => {
    const copia = { ...iniciales };
    combinarPosiciones(iniciales, { a: { x: 1, y: 1 } });

    expect(iniciales).toEqual(copia);
  });
});
