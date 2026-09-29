/**
 * CANDADO · SPEC-783 — una `Credencial` NO expone su texto en claro salvo por `revelarCredencial`.
 *
 * Esta es la mitad «falla-cerrado» del mecanismo: aunque alguien OLVIDE ponerla en `sensibles`
 * y la deje suelta en `variables`, el texto NO se persiste ni se renderiza — el valor vive tras
 * un símbolo de módulo, así que `JSON.stringify` la serializa como `{}` y `String()` da
 * "[object Object]". Olvidar deja de significar «persistir en claro». La ÚNICA vía al texto es
 * `revelarCredencial`, un acto explícito y visible (que el motor usa solo al serializar a
 * `_sensibles`, y las rutas solo para la exposición de una vez al admin).
 *
 * Con el valor REAL plantado, no un placeholder (se busca el texto exacto y se exige CERO).
 */
import { describe, it, expect } from "vitest";
import { credencial, revelarCredencial } from "./credencial";

const CLAVE_REAL = "Sup3r-Secreta-9F3a";

describe("SPEC-783 · la credencial no filtra su texto en claro (falla-cerrado por construcción)", () => {
    it("JSON.stringify NO contiene el texto — ni suelta, ni anidada en un objeto tipo `variables`", () => {
        const c = credencial(CLAVE_REAL);
        expect(JSON.stringify(c)).not.toContain(CLAVE_REAL);
        // El caso que teme el CEO: alguien la deja SUELTA en variables. No se persiste en claro.
        expect(JSON.stringify({ email: "x@test", tempPassword: c })).not.toContain(CLAVE_REAL);
    });

    it("String()/interpolación NO revela el texto (el render la mostraría como [object Object], no en claro)", () => {
        const c = credencial(CLAVE_REAL);
        expect(String(c)).not.toContain(CLAVE_REAL);
        expect(`${c}`).not.toContain(CLAVE_REAL);
    });

    it("las claves propias no exponen el valor (Object.values/keys no lo alcanzan)", () => {
        const c = credencial(CLAVE_REAL);
        expect(JSON.stringify(Object.values(c))).not.toContain(CLAVE_REAL);
        expect(Object.keys(c)).toHaveLength(0); // el valor vive tras un símbolo, no una clave string
    });

    it("CONTROL POSITIVO: `revelarCredencial` SÍ devuelve el texto (la única vía, explícita)", () => {
        expect(revelarCredencial(credencial(CLAVE_REAL))).toBe(CLAVE_REAL);
    });
});
