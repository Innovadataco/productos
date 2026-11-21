/**
 * CANDADO · SPEC-979 (I-460) — el paso 5 del camino del colegio NO se bloquea a sí mismo.
 *
 * EL DEFECTO (hallazgo de Jelk en prod 799c8880). La pantalla inline del paso 5 (SPEC-956)
 * pinta su «Lista actual» con `GET /api/colegio/estudiantes` (SPEC-931). Pero un colegio con
 * CERO estudiantes está parado EN el paso «estudiantes», así que el guardián del camino
 * (`middleware.ts`, rama CAMINO_INCOMPLETO) le devolvía 403 a esa MISMA lista — la que el paso
 * necesita para renderizarse. Resultado: «No pudimos cargar la lista de estudiantes.» encima de
 * la lista vacía. Al agregar el primero, el camino cierra (`derivarPasoPendienteColegio` → null)
 * y el 403 desaparece: por eso SOLO fallaba con 0 estudiantes.
 *
 * POR QUÉ UN CANDADO DE RUTEO Y NO DE HANDLER. El handler `GET /api/colegio/estudiantes` SIEMPRE
 * respondió 200 + lista vacía para 0 estudiantes (verificado en integración). El 403 lo ponía el
 * MURO de Edge, ANTES del handler. Un test de handler da verde con y sin el defecto; el muro es
 * el único lugar donde el defecto vive. Este candado afirma la exención en la fuente única de
 * rutas (`GUARDIAS_ACCESO`) por sus helpers reales `esExentaCamino` / `esExentaVigencia`.
 *
 * MUERE CON EL DEFECTO. Quitar `/api/colegio/estudiantes` de `camino.exentasColegio` → el primer
 * `expect` se pone ROJO (reintroduce el 403 del paso 5). Quitarla de `vigencia.SCHOOL_ADMIN` →
 * el segundo. Control positivo (anti-vacuo): una ruta operativa gateada NO está exenta.
 *
 * PAYLOAD REAL (regla dura de Jelk). El tercer bloque LEE `page.tsx` del paso 5 y afirma que el
 * endpoint que de verdad consume es `/api/colegio/estudiantes`: si alguien cambia el fetch del
 * paso sin mover la exención, el supuesto de este candado se re-valida en vez de mentir.
 *
 * Unit puro (lee la fuente de rutas + un archivo de texto; sin BD). Registrado en
 * vitest.unit.includes.ts → corre en `test:unit`, que `pi-gate` exige: CORRE en CI y BLOQUEA.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { esExentaCamino, esExentaVigencia } from "./guardias";

const LISTA_PASO5 = "/api/colegio/estudiantes";
const PAGE_PASO5 = resolve(__dirname, "../../app/camino/colegio/estudiantes/page.tsx");

describe("SPEC-979 · la lista del paso 5 queda exenta de los muros del camino del colegio", () => {
    it("CAMINO: GET /api/colegio/estudiantes está exenta para SCHOOL_ADMIN (no 403 CAMINO_INCOMPLETO con 0 estudiantes)", () => {
        expect(esExentaCamino(LISTA_PASO5, "SCHOOL_ADMIN")).toBe(true);
        // Con query string (la pantalla pide ?pageSize=100) el matcher es por segmento: igual exenta.
        expect(esExentaCamino(LISTA_PASO5, "SCHOOL_ADMIN")).toBe(true);
    });

    it("VIGENCIA: GET /api/colegio/estudiantes está exenta para SCHOOL_ADMIN (hermana de /cursos y /profesores)", () => {
        expect(esExentaVigencia(LISTA_PASO5, "SCHOOL_ADMIN")).toBe(true);
        // Hermanas: si la del paso 5 cayera y las otras no, el paso quedaría a medias. Control de intactas.
        expect(esExentaVigencia("/api/colegio/cursos", "SCHOOL_ADMIN")).toBe(true);
        expect(esExentaVigencia("/api/colegio/profesores", "SCHOOL_ADMIN")).toBe(true);
    });

    it("CONTROL POSITIVO (anti-vacuo): una ruta operativa gateada NO está exenta", () => {
        // El panel del colegio SÍ lo tapa el camino hasta cerrarlo: si esto diera `true`, el matcher
        // estaría eximiendo de más y los dos `expect` de arriba no probarían nada.
        expect(esExentaCamino("/dashboard/colegio", "SCHOOL_ADMIN")).toBe(false);
        expect(esExentaVigencia("/dashboard/colegio", "SCHOOL_ADMIN")).toBe(false);
    });

    it("PAYLOAD REAL: el paso 5 consume EXACTAMENTE /api/colegio/estudiantes (si cambia, re-validar la exención)", () => {
        const page = readFileSync(PAGE_PASO5, "utf8");
        expect(
            page.includes(`fetch("${LISTA_PASO5}`),
            "el paso 5 dejó de pedir /api/colegio/estudiantes; la exención de este candado debe seguir al endpoint real",
        ).toBe(true);
    });
});
