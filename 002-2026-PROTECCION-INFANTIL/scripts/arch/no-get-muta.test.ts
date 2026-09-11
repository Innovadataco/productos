/**
 * SPEC-619 (I-371 · D-131) · Candado: ningún GET-que-muta NUEVO fuera de la superficie declarada.
 *
 * Corre en el suite (unit, scan estático de archivos, sin base) Y está cableado en arch:check main.
 * Ejercita la EVASIÓN por construcción del scanner (ver no-get-muta.ts): un handler GET —o una página
 * Server Component que escribe al render— que llame a un frontier de escritura conocido y no esté en
 * `SUPERFICIE_GET_MUTA` lo pone rojo. Verificado por mutación al construirlo: quitar una entrada del
 * allowlist hace que el scanner la reporte (p. ej. `registrarInformePadre` en el PDF del expediente).
 */
import { describe, it, expect } from "vitest";
import { buscarInfractores, entradasObsoletas, frontierSinCallsite } from "./no-get-muta";
import { SUPERFICIE_GET_MUTA } from "../../src/lib/auth/superficie-get-muta";

describe("SPEC-619 · candado GET-que-muta (ratchet de la superficie)", () => {
    it("ningún GET-que-muta NUEVO fuera de la lista compartida", () => {
        const infractores = buscarInfractores();
        expect(
            infractores.map((i) => `${i.archivo}:${i.linea} [${i.patron}]`),
            "Un GET (o página al render) llama a un frontier de escritura y NO está en SUPERFICIE_GET_MUTA. " +
                "Declaralo ahí con su razón, o sacá la escritura del GET (a POST, o `registrarLectura:false` si es lectura).",
        ).toEqual([]);
    });

    it("la lista compartida no tiene entradas obsoletas (archivo renombrado o borrado)", () => {
        expect(
            entradasObsoletas(),
            "SUPERFICIE_GET_MUTA tiene entradas cuyo archivo ya no existe; actualizá la lista (la consume también el chequeo Sec-Fetch-Site).",
        ).toEqual([]);
    });

    it("forma de la lista: 17 entradas, 2 de ellas páginas al render", () => {
        // 18 → 17: SPEC-647/D-136 retiró el login de Google, y con él su callback OAuth (tier oauth-exento),
        // única superficie exenta. `entradasObsoletas()` lo cazó al rebasar #537 sobre el main sin Google.
        expect(SUPERFICIE_GET_MUTA.length).toBe(17);
        expect(SUPERFICIE_GET_MUTA.filter((e) => e.tipo === "page-render").length).toBe(2);
    });

    // Control positivo del propio scanner: los regex de detección se DERIVAN de las listas de nombres, y
    // acá exigimos que el regex de CADA nombre TODAVÍA PEGUE en una llamada viva `NOMBRE(` en src/. Mide
    // que la SONDA funciona, no que el nombre exista (un shim `const viejo=nuevo`, un homónimo o una def
    // muerta pasarían el chequeo de «existe» y dejarían el scanner ciego — ése era el hueco que marcó
    // Dev 1). Un rename total, o PARCIAL con shim + callers migrados, deja el regex sin pegar → rojo. Fue
    // el caso real de `leerTextoConSesion` → `leerExpedienteConSesion` (SPEC-610). NO caza un homónimo
    // llamado en otro lado: eso lo dice el docblock, y el cierre de la clase es Sec-Fetch-Site.
    it("control positivo: el regex de cada frontier PEGA en ≥1 llamada viva en src/ (un rename total o parcial lo pone rojo)", () => {
        expect(
            frontierSinCallsite(),
            "El regex de un frontier de FRONTIER_SIEMPRE/FRONTIER_LECTURA ya no pega en ninguna llamada viva en src/ " +
                "(¿rename total, o parcial con shim y callers migrados?). El scanner quedó ciego a ese frontier. " +
                "Actualizá el nombre en NOMBRES_FRONTIER_* de scripts/arch/no-get-muta.ts para que apunte al nombre vivo.",
        ).toEqual([]);
    });
});
