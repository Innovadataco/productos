import { describe, it, expect } from "vitest";
import { detectarPiiDeterministico, detectarDoxing } from "./pii-patterns";

describe("detectarPiiDeterministico", () => {
    it("detecta nombre propio en contexto familiar", () => {
        const r = detectarPiiDeterministico("Mi hijo Juan estudia en el colegio San José");
        expect(r.contienePii).toBe(true);
        expect(r.piiDetectada.some((f) => f.toLowerCase().includes("juan"))).toBe(true);
    });

    it("detecta dirección colombiana", () => {
        const r = detectarPiiDeterministico("Vivo en calle 45 # 12-34");
        expect(r.contienePii).toBe(true);
        expect(r.piiDetectada.some((f) => f.toLowerCase().startsWith("calle"))).toBe(true);
    });

    it("detecta teléfono atribuido a NNA", () => {
        const r = detectarPiiDeterministico("El celular de mi hija es 3001234567");
        expect(r.contienePii).toBe(true);
        expect(r.piiDetectada.some((f) => /\d{10}/.test(f))).toBe(true);
    });

    it("detecta colegio e información escolar", () => {
        const r = detectarPiiDeterministico("La profesora Marta le dio clase en el grado 5B, salón 302");
        expect(r.contienePii).toBe(true);
        expect(r.piiDetectada.some((f) => f.toLowerCase().includes("colegio") || f.toLowerCase().includes("profesora") || f.toLowerCase().includes("grado") || f.toLowerCase().includes("salón"))).toBe(true);
    });

    it("NO detecta contexto familiar sin nombre propio", () => {
        const r = detectarPiiDeterministico("Mi mamá lo vio");
        expect(r.contienePii).toBe(false);
    });

    it("NO detecta teléfono del agresor como PII de NNA", () => {
        const r = detectarPiiDeterministico("El sujeto me escribe desde el 3009998888");
        expect(r.contienePii).toBe(false);
    });

    it("NO detecta nick del agresor como PII de NNA", () => {
        const r = detectarPiiDeterministico("Su usuario es @depredador123");
        expect(r.contienePii).toBe(false);
    });

    it("detecta auto-identificación del denunciante por nombre", () => {
        const r = detectarPiiDeterministico("Yo soy María Gómez y denuncio este número.");
        expect(r.contienePii).toBe(true);
        expect(r.piiDetectada.some((f) => f.toLowerCase().includes("maría") || f.toLowerCase().includes("gómez"))).toBe(true);
    });

    it("detecta auto-identificación del denunciante por teléfono propio", () => {
        const r = detectarPiiDeterministico("Mi celular es 3001234567, me escribieron por WhatsApp.");
        expect(r.contienePii).toBe(true);
        expect(r.piiDetectada.some((f) => /\d{10}/.test(f))).toBe(true);
    });

    it("detecta auto-identificación del denunciante por email propio", () => {
        const r = detectarPiiDeterministico("Mi correo es maria@ejemplo.com, por favor contactenme.");
        expect(r.contienePii).toBe(true);
        expect(r.piiDetectada.some((f) => f.toLowerCase().includes("maria@ejemplo.com"))).toBe(true);
    });

    it("NO detecta teléfono del agresor como auto-identificación", () => {
        const r = detectarPiiDeterministico("El número que me contactó es 3009998888.");
        expect(r.contienePii).toBe(false);
    });
});

describe("detectarDoxing", () => {
    it("detecta DOXING usando patrones compartidos más intención", () => {
        const r = detectarDoxing("Voy a publicar la dirección: cra 7 # 45-67, colegio San José");
        expect(r.esDoxing).toBe(true);
        expect(r.fragmentos.length).toBeGreaterThan(0);
    });

    it("detecta DOXING sin tildes (compartio / informacion)", () => {
        const r = detectarDoxing("Compartio la direccion cra 7 # 45-67 y el telefono 3001234567 de mi hijo");
        expect(r.esDoxing).toBe(true);
    });

    it("detecta DOXING sin tildes (publico / direccion)", () => {
        const r = detectarDoxing("Publico mi direccion cra 7 # 45-67 y mi numero 3001234567 para que me busquen");
        expect(r.esDoxing).toBe(true);
    });

    it("detecta DOXING por multiples datos sin tildes", () => {
        const r = detectarDoxing("Mando mi direccion cra 7 # 45-67 y mi telefono 3001234567 a extranos");
        expect(r.esDoxing).toBe(true);
    });

    it("NO detecta DOXING cuando solo hay datos personales sin intención de publicar", () => {
        const r = detectarDoxing("Mi hijo Juan estudia en el colegio San José");
        expect(r.esDoxing).toBe(false);
    });

    it("detecta DOXING aunque solo haya 'datos personales' genericos sin PII concreta", () => {
        const r = detectarDoxing("Mando mi informacion personal a extranos para que me encuentren");
        expect(r.esDoxing).toBe(true);
    });

    it("detecta DOXING con 'datos personales del menor' y verbo compartir", () => {
        const r = detectarDoxing("compartio datos personales del nene en internet");
        expect(r.esDoxing).toBe(true);
    });

    it("conserva fragmentos del texto original aunque el matching sea sin tildes", () => {
        const r = detectarDoxing("compartió datos de mi hijo del colegio San Andrés");
        expect(r.esDoxing).toBe(true);
        expect(r.fragmentos.some((f) => f.toLowerCase().includes("san andrés"))).toBe(true);
    });
});
