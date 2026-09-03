/**
 * SPEC-126 (T009): aserciones A y B en local (mismo código que el gate CI). Sin BD:
 * ejecutan `proxy()` y `esDestinoPermitidoPorRol` con NextRequest en memoria.
 * Si alguna sale ROJA sobre el código actual es un fallo REAL escondido: se reporta
 * a ZEUS y se para — NO se silencia tocando las fuentes (condición vinculante).
 */
import { describe, it, expect } from "vitest";
import { ejecutarAsercionA } from "./asercion-puerta-predicado";
import { ejecutarAsercionB } from "./asercion-menu-no-miente";
import { ejecutarAsercionBBis } from "./asercion-menu-no-redirige-a-otro-item";

describe("aserción A: puerta ≡ predicado (SPEC-126)", { timeout: 120_000 }, () => {
    it("sin desalineos reales en la sesión canónica; divergencias anónimas solo como nota", async () => {
        const resultado = await ejecutarAsercionA();
        expect(resultado.rutasEvaluadas).toBeGreaterThan(100);
        expect(
            resultado.desalineos,
            resultado.desalineos.map((d) => `${d.rol} · ${d.ruta} · proxy=${d.proxy} · predicado=${d.predicadoPermite}`).join("\n")
        ).toEqual([]);
        // La nota del eje anónimo existe y se documenta (condición ZEUS 1: nunca es rojo)
        expect(resultado.notasAnonimo.length).toBeGreaterThan(0);
    });
});

describe("aserción B: el menú no miente (SPEC-126, regla de pintado D-41)", { timeout: 120_000 }, () => {
    it("todo href pintado es alcanzable según el proxy (I-39 cerrado por la D-41)", async () => {
        const resultado = await ejecutarAsercionB();
        expect(resultado.evaluados).toBeGreaterThan(50);
        expect(
            resultado.muertos,
            resultado.muertos.map((m) => `${m.rol} · ${m.href} · ${m.origen} · proxy=${m.veredicto}`).join("\n")
        ).toEqual([]);
    });
});

describe("aserción B-bis: el ítem del menú no redirige a otro ítem (SPEC-404 · I-290)", () => {
    it("ningún page.tsx de un href del menú contiene redirect() con literal de otro href del mismo menú", () => {
        const resultado = ejecutarAsercionBBis();
        expect(resultado.evaluados).toBeGreaterThan(10);
        expect(
            resultado.muertos,
            resultado.muertos.map((m) => `${m.menu} · ${m.origen} → ${m.destino} · ${m.archivo}`).join("\n"),
        ).toEqual([]);
    });
});
