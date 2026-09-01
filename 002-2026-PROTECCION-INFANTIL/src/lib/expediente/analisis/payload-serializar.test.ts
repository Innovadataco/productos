/**
 * SPEC-349 (audit 615 chars) · el payload que llega al modelo debe:
 *  1) llevar la fecha del hecho en TZ America/Bogota (no UTC),
 *  2) incluir plataforma y categoría cuando existen (no null por join perdido).
 */
import { describe, it, expect } from "vitest";
import { payloadParaModelo } from "./ejecutar-analisis";
import { armarPayload, type HechoPadre } from "./armar-payload";

describe("SPEC-349 · payload serializado para el modelo (audit 615 chars)", () => {
    it("fecha del hecho en TZ Bogota, no UTC (fix nº1)", () => {
        // 30/08/2026 21:15 hora Bogota = 30/08/2026 02:15 UTC (siguiente día)
        // = "2026-08-31T02:15:00.000Z" en ISO.
        // Verificamos que el string serializado NO diga 02:15 ni "9:19 AM";
        // debe reflejar "21:15" o "9:15 p." en la localización es-CO Bogota.
        const hecho: HechoPadre = {
            fecha: new Date("2026-08-31T02:15:00.000Z"),
            ciudad: "Bogotá",
            pais: "CO",
            plataforma: "roblox",
            categoria: "CIBERACOSO",
            edadReportada: 11,
        };
        const payload = armarPayload({ alcance: "PADRE_COMPLETO", hechos: [hecho], hijoCruzado: null });
        const serializado = JSON.stringify(payloadParaModelo(payload));

        // Contiene la hora local Bogota (9:15 p.m. o 21:15)
        expect(serializado, "el payload debe llevar la fecha en TZ Bogota").toMatch(/9:15/);
        // NO contiene el ISO UTC ni "02:15"
        expect(serializado).not.toContain("2026-08-31T02:15:00.000Z");
        expect(serializado).not.toMatch(/T\d\d:\d\d/); // sin marcador ISO Z
    });

    it("preserva plataforma y categoría cuando vienen (fix nº2)", () => {
        const hecho: HechoPadre = {
            fecha: new Date("2026-08-30T14:00:00.000Z"),
            ciudad: "Cali",
            pais: "CO",
            plataforma: "roblox",
            categoria: "CIBERACOSO",
            edadReportada: 12,
        };
        const payload = armarPayload({ alcance: "PADRE_COMPLETO", hechos: [hecho], hijoCruzado: null });
        const s = JSON.stringify(payloadParaModelo(payload));

        expect(s, "plataforma llega al modelo").toContain("roblox");
        expect(s, "categoria llega al modelo").toContain("CIBERACOSO");
    });

    it("no rompe cuando plataforma o categoría son null (histórico legítimo)", () => {
        const hecho: HechoPadre = {
            fecha: new Date("2026-08-30T14:00:00.000Z"),
            ciudad: "Cali",
            pais: "CO",
            plataforma: null,
            categoria: null,
            edadReportada: null,
        };
        const payload = armarPayload({ alcance: "PADRE_COMPLETO", hechos: [hecho], hijoCruzado: null });
        expect(() => payloadParaModelo(payload)).not.toThrow();
    });

    it("COLEGIO_BLINDADO devuelve el payload tal cual (no lleva fechas individuales)", () => {
        const payload = armarPayload({
            alcance: "COLEGIO_BLINDADO",
            agregados: [{ curso: "9°-A", plataforma: "roblox", franjaHoraria: "18-24", categoria: "CIBERACOSO", cantidad: 3 }],
        });
        expect(payloadParaModelo(payload)).toBe(payload);
    });
});
