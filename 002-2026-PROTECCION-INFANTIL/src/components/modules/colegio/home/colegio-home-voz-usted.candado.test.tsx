/**
 * SPEC-568 · CANDADO de VOZ: la home del colegio le habla al rector de USTED.
 *
 * SPEC-551 ya fijó el registro (rector = usted) pero la conversión quedó a
 * medias: sobrevivían tuteos VISIBLES en el árbol de render de la home
 * ("Creamos los cursos por ti", "Entra a cada curso", "Subirla … por ti",
 * "Nada te espera"). Este candado barre los componentes visibles de la home
 * y muere si el tuteo vuelve a asomar, cubriendo en particular el `detalle`
 * de AccionesRapidas, que ningún test afirmaba.
 *
 * Es un candado de CONDUCTA, no de una frase: afirma la ausencia de las
 * marcas de tuteo ("por ti", el imperativo tú "Entra"/"Entrá", el clítico
 * "te espera") y la presencia del trato de usted, no un string literal.
 * Integración (jsdom); no toca vitest.unit.includes.ts.
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AccionesRapidas } from "./AccionesRapidas";
import { EmptyStateColegio } from "./EmptyStateColegio";
import { EmbudoEstado } from "./EmbudoEstado";

// Marcas de TUTEO/VOSEO dirigidas al rector que no deben aparecer en la home.
// Bordes de palabra Unicode para no morder "entrada", "byte", etc.
const TUTEO = [
    /\bpor ti\b/iu,
    /\bpara ti\b/iu,
    /(?<![\p{L}])entr[aá](?![\p{L}])/iu, // "Entra"/"Entrá" (usted = "Entre")
    /\bte esperan?\b/iu, // "te espera"/"te esperan" (usted = "le espera(n)")
];

function sinTuteo(texto: string, etiqueta: string) {
    for (const re of TUTEO) {
        expect(texto, `${etiqueta}: tuteo «${re}» en «${texto}»`).not.toMatch(re);
    }
}

describe("SPEC-568 · voz usted en la home del colegio", () => {
    it("AccionesRapidas: usted, sin tuteo en los detalles", () => {
        const { container } = render(<AccionesRapidas />);
        const t = container.textContent ?? "";
        expect(t).toContain("por usted");
        expect(t).toContain("Entre a cada curso");
        sinTuteo(t, "AccionesRapidas");
    });

    it("EmptyStateColegio: usted, sin tuteo", () => {
        const { container } = render(<EmptyStateColegio colegioNombre="Colegio X" />);
        const t = container.textContent ?? "";
        expect(t).toContain("por usted");
        sinTuteo(t, "EmptyStateColegio");
    });

    it("EmbudoEstado: 'le esperan' / 'Nada le espera', sin tuteo (con y sin pendientes)", () => {
        const conPend = render(<EmbudoEstado embudo={{ recibidos: 5, cerrados: 2, enRevision: 1, teEsperan: 2 }} />);
        const t1 = conPend.container.textContent ?? "";
        expect(t1).toContain("Le esperan");
        sinTuteo(t1, "EmbudoEstado(pendientes)");
        conPend.unmount();

        const enCalma = render(<EmbudoEstado embudo={{ recibidos: 0, cerrados: 0, enRevision: 0, teEsperan: 0 }} />);
        const t2 = enCalma.container.textContent ?? "";
        expect(t2).toContain("Nada le espera");
        sinTuteo(t2, "EmbudoEstado(calma)");
    });
});
