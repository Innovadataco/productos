import { describe, it, expect, afterEach, beforeEach } from "vitest";
import {
    REPORTAR_STORAGE_KEY,
    dejarHandoffReportar,
    tomarHandoffReportar,
    guardarBorradorReporte,
    leerBorradorReporte,
    borrarBorradorReporte,
} from "./reportar-handoff";

describe("handoff del identificador hacia /reportar", () => {
    afterEach(() => {
        sessionStorage.clear();
    });

    it("devuelve lo que se dejó, con la marca de fijar", () => {
        dejarHandoffReportar("+573001234567", { fijar: true });
        expect(tomarHandoffReportar()).toEqual({ identificador: "+573001234567", fijar: true });
    });

    it("distingue el prellenado editable del fijo", () => {
        dejarHandoffReportar("@nick", { fijar: false });
        expect(tomarHandoffReportar()).toEqual({ identificador: "@nick", fijar: false });
    });

    it("es de un solo uso: la segunda lectura ya no encuentra nada", () => {
        dejarHandoffReportar("@nick", { fijar: true });
        expect(tomarHandoffReportar()).not.toBeNull();
        expect(tomarHandoffReportar()).toBeNull();
        expect(sessionStorage.getItem(REPORTAR_STORAGE_KEY)).toBeNull();
    });

    it("sin handoff devuelve null", () => {
        expect(tomarHandoffReportar()).toBeNull();
    });

    it("recorta a 100 caracteres (mismo límite que el esquema de la API)", () => {
        dejarHandoffReportar("a".repeat(250), { fijar: true });
        expect(tomarHandoffReportar()?.identificador).toHaveLength(100);
    });

    it("ignora y limpia lo que no sea un handoff válido", () => {
        // Basura de una versión vieja o escrita a mano en la consola.
        for (const basura of ["no-es-json", '{"fijar":true}', '{"identificador":""}', "null"]) {
            sessionStorage.setItem(REPORTAR_STORAGE_KEY, basura);
            expect(tomarHandoffReportar(), basura).toBeNull();
            expect(sessionStorage.getItem(REPORTAR_STORAGE_KEY)).toBeNull();
        }
    });

    it("un `fijar` que no sea true no bloquea el campo", () => {
        sessionStorage.setItem(REPORTAR_STORAGE_KEY, '{"identificador":"@nick","fijar":"si"}');
        expect(tomarHandoffReportar()).toEqual({ identificador: "@nick", fijar: false });
    });
});

// ─── A-70 · B1(d) · el relato no se pierde ──────────────────────────────────
describe("borrador del reporte (A-70 · B1d)", () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    it("guarda y devuelve el relato completo", () => {
        guardarBorradorReporte({ texto: "relato largo del padre", identificador: "@alguien", ciudad: "Bogotá" });
        const leido = leerBorradorReporte();
        expect(leido?.texto, "el relato sobrevive a un envío fallido").toBe("relato largo del padre");
        expect(leido?.identificador).toBe("@alguien");
        expect(leido?.ciudad).toBe("Bogotá");
    });

    it("sin borrador guardado devuelve null (no rompe el arranque limpio)", () => {
        expect(leerBorradorReporte()).toBeNull();
    });

    it("borrarBorradorReporte lo limpia — tras enviar bien no queda rastro del relato", () => {
        guardarBorradorReporte({ texto: "algo sensible" });
        borrarBorradorReporte();
        expect(leerBorradorReporte()).toBeNull();
        expect(sessionStorage.getItem("pi:borrador-reporte")).toBeNull();
    });

    it("JSON corrupto en sessionStorage devuelve null en vez de tronar", () => {
        sessionStorage.setItem("pi:borrador-reporte", "{no es json");
        expect(leerBorradorReporte()).toBeNull();
    });

    it("un array no cuenta como borrador (guardarraíl de forma)", () => {
        sessionStorage.setItem("pi:borrador-reporte", "[1,2,3]");
        expect(leerBorradorReporte()).toBeNull();
    });
});
