/**
 * CANDADO · SPEC-778 — la visibilidad del ENLACE de la reunión es UNA decisión derivada,
 * gateada, y NO miente sin reloj. Unit puro (sin BD).
 *
 * Tres invariantes (las dos condiciones del CEO + la disciplina de fuente):
 *  · C-visible: la `url` REAL sale SOLO en PUBLICADO (publicado + hora no pasada); no publicado
 *    → SIN_PUBLICAR sin url; pasada la hora → PASADA sin url. Se prueba CRUZANDO EL VIVO: la
 *    MISMA fixture con la url plantada, moviendo `now` de antes a después de `franjaFin`.
 *  · C-sin-reloj (condición 2): `now` ausente/basura → INDETERMINADO: sin url (fail-closed) y
 *    SIN afirmar que la hora pasó (≠ PASADA) ni que el operador no actuó (≠ SIN_PUBLICAR).
 *  · C-fuente-reloj (condición 1): la noción de «pasó la hora» viene de `estadoEfectivoDeCita`
 *    (746), no de una comparación propia. Meta-aserción: el módulo NO tiene su propia
 *    aritmética de tiempo (`getTime(`) y delega en `estadoEfectivoDeCita`.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { derivarEnlaceParaCita, type CitaParaEnlace } from "./enlace-derivado";

const URL_REAL = "https://video.example/sala-real-xyz";
const INICIO = new Date("2026-09-20T14:00:00Z");
const FIN = new Date("2026-09-20T15:00:00Z");
const ANTES = new Date("2026-09-20T14:30:00Z"); // EN_CURSO
const DESPUES = new Date("2026-09-20T15:30:00Z"); // PASADA

const base = (over: Partial<CitaParaEnlace> = {}): CitaParaEnlace => ({
    estado: "CONFIRMADA",
    enlaceReunion: URL_REAL,
    enlacePublicadoEn: new Date("2026-09-20T13:00:00Z"),
    franjaInicio: INICIO,
    franjaFin: FIN,
    ...over,
});

describe("SPEC-778 · C-visible — la url real sale solo en PUBLICADO (cruzar el vivo)", () => {
    it("publicado + antes de la hora → PUBLICADO con la url REAL", () => {
        const r = derivarEnlaceParaCita(base(), ANTES);
        expect(r.estado).toBe("PUBLICADO");
        expect(r.url).toBe(URL_REAL);
    });

    it("MISMA cita, movido `now` a después de la hora → PASADA, sin url (frontera cruzada)", () => {
        const r = derivarEnlaceParaCita(base(), DESPUES);
        expect(r.estado).toBe("PASADA");
        expect(r.url).toBeUndefined();
    });

    it("no publicado + antes de la hora → SIN_PUBLICAR, sin url", () => {
        const r = derivarEnlaceParaCita(base({ enlaceReunion: null, enlacePublicadoEn: null }), ANTES);
        expect(r.estado).toBe("SIN_PUBLICAR");
        expect(r.url).toBeUndefined();
    });

    it("SPEC-792 C4 · pasada la hora + enlace NUNCA publicado → PASADA_SIN_PUBLICAR (el acceso no llegó)", () => {
        const r = derivarEnlaceParaCita(base({ enlaceReunion: null, enlacePublicadoEn: null }), DESPUES);
        expect(r.estado).toBe("PASADA_SIN_PUBLICAR");
        expect(r.url).toBeUndefined();
    });

    it("SPEC-792 C4 · control positivo: pasada + enlace SÍ publicado → PASADA (no el sub-estado)", () => {
        // `base()` tiene enlaceReunion + enlacePublicadoEn: el acceso SÍ estuvo → «ya pasó» normal.
        expect(derivarEnlaceParaCita(base(), DESPUES).estado).toBe("PASADA");
    });

    it("estado NO CONFIRMADA → sin url (no hay reunión viva)", () => {
        const r = derivarEnlaceParaCita(base({ estado: "CUMPLIDA" }), ANTES);
        expect(r.url).toBeUndefined();
    });

    it("publicado sin url real (inconsistencia de datos) → NO se pinta PUBLICADO", () => {
        const r = derivarEnlaceParaCita(base({ enlaceReunion: null }), ANTES);
        expect(r.estado).toBe("SIN_PUBLICAR");
        expect(r.url).toBeUndefined();
    });
});

describe("SPEC-778 · C-sin-reloj (condición 2) — sin `now`, no se miente", () => {
    for (const nowMalo of [null, undefined, "no-soy-fecha", NaN] as const) {
        it(`now = ${String(nowMalo)} + publicado → INDETERMINADO, sin url, ni «pasó» ni «sin publicar»`, () => {
            const r = derivarEnlaceParaCita(base(), nowMalo);
            expect(r.estado).toBe("INDETERMINADO");
            expect(r.url).toBeUndefined();
            expect(r.estado).not.toBe("PASADA"); // no afirma que la hora pasó
            expect(r.estado).not.toBe("SIN_PUBLICAR"); // no culpa al operador
        });
    }
});

describe("SPEC-778 · C-fuente-reloj (condición 1) — el tiempo lo decide estadoEfectivoDeCita (746)", () => {
    const fuente = fs.readFileSync(path.resolve(__dirname, "enlace-derivado.ts"), "utf-8");

    it("delega en `estadoEfectivoDeCita` (no reimplementa la fase temporal)", () => {
        expect(fuente).toContain("estadoEfectivoDeCita(");
    });

    it("NO tiene su propia aritmética de tiempo (`getTime(`) — una sola frontera en el producto", () => {
        expect(fuente.includes("getTime(")).toBe(false);
    });

    it("la validez del reloj se reusa de 746 (`relojUtilizable`), no una comprobación paralela", () => {
        expect(fuente).toContain("relojUtilizable(");
    });
});
