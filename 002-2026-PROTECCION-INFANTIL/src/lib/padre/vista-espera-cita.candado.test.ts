/**
 * CANDADO · SPEC-749 FR-2 (parcial) — la pantalla de espera dice la VERDAD después de
 * la hora para los DOS estados que la fuente única deja pasar (PAGADA_PENDIENTE /
 * SIN_CONFIRMAR), con el copy de FORMA §14, y NO inventa el tercero (CONFIRMADA-pasada,
 * diferido: devuelve null → conducta actual).
 *
 * Control positivo por MUTACIÓN, dos direcciones (SPEC-749 A-2): con la franja pasada
 * la vista cambia; con la franja futura vuelve a `null` (no se dispara sola). `now`
 * inyectado. Unit puro (sin BD, sin render).
 */
import { describe, it, expect } from "vitest";
import { derivarVistaFranjaPasada } from "./vista-espera-cita";

const HORA = 60 * 60 * 1000;
// Franja de "ayer": inicio y fin ambos antes de `AHORA`.
const INICIO = Date.parse("2026-09-28T14:00:00.000Z");
const FIN = INICIO + HORA;
const AHORA = Date.parse("2026-09-29T18:00:00.000Z"); // > FIN → franja pasada
const FRANJA_FUTURA_INI = AHORA + 24 * HORA;
const FRANJA_FUTURA_FIN = FRANJA_FUTURA_INI + HORA;
const PROF = "Dra. Juez"; // nombre visible; se interpola literal

describe("SPEC-749 FR-2 · derivarVistaFranjaPasada", () => {
    it("PAGADA_PENDIENTE + franja pasada + plazo VIGENTE (< 48 h) → «aún puede responder»", () => {
        const venceEn = AHORA + HORA; // now < venceEn → plazo no vencido
        const v = derivarVistaFranjaPasada("PAGADA_PENDIENTE", INICIO, FIN, venceEn, PROF, AHORA);
        expect(v).not.toBeNull();
        expect(v!.titulo).toContain("ya pasó");
        expect(v!.titulo).toContain(PROF);
        expect(v!.detalle).toContain("Todavía puede responder");
        expect(v!.tono).toBe("espera");
        expect(v!.accion).toBe("revisar_pago");
    });

    it("PAGADA_PENDIENTE + franja pasada + plazo VENCIDO (≥ 48 h) → «no respondió», tono rojo", () => {
        const venceEn = AHORA - HORA; // now >= venceEn → plazo vencido
        const v = derivarVistaFranjaPasada("PAGADA_PENDIENTE", INICIO, FIN, venceEn, PROF, AHORA);
        expect(v!.detalle).toContain("no respondió");
        expect(v!.tono).toBe("rojo");
    });

    it("SIN_CONFIRMAR + franja pasada → «no llegó a confirmarse y la hora ya pasó» + pedir otra cita", () => {
        const v = derivarVistaFranjaPasada("SIN_CONFIRMAR", INICIO, FIN, AHORA, PROF, AHORA);
        expect(v!.titulo).toContain("no llegó a confirmarse");
        expect(v!.titulo).toContain("ya pasó");
        expect(v!.accion).toBe("pedir_otra_cita");
    });

    // ── Control positivo, OTRA dirección: franja FUTURA → no se dispara (null) ──
    it("PAGADA_PENDIENTE + franja FUTURA → null (cae al copy de espera actual, no se dispara sola)", () => {
        expect(
            derivarVistaFranjaPasada("PAGADA_PENDIENTE", FRANJA_FUTURA_INI, FRANJA_FUTURA_FIN, AHORA + 48 * HORA, PROF, AHORA),
        ).toBeNull();
    });

    it("SIN_CONFIRMAR + franja FUTURA → null", () => {
        expect(
            derivarVistaFranjaPasada("SIN_CONFIRMAR", FRANJA_FUTURA_INI, FRANJA_FUTURA_FIN, AHORA, PROF, AHORA),
        ).toBeNull();
    });

    // ── El TERCERO no se inventa: CONFIRMADA-pasada → null (copy diferido, Diseño) ──
    it("CONFIRMADA + franja pasada → null (NO se inventa el copy diferido, ni como placeholder)", () => {
        expect(derivarVistaFranjaPasada("CONFIRMADA", INICIO, FIN, AHORA, PROF, AHORA)).toBeNull();
    });

    // ── FR-4: dato ausente/basura falla CONSERVADOR (se trata como PASADA, dice la verdad) ──
    it("PAGADA_PENDIENTE + franja ausente/basura → se trata como pasada (fallo conservador, FR-4)", () => {
        const v = derivarVistaFranjaPasada("PAGADA_PENDIENTE", null, "no-es-fecha", undefined, PROF, AHORA);
        expect(v).not.toBeNull();
        expect(v!.titulo).toContain("ya pasó");
        // `venceEn` ausente también falla conservador → plazo vencido → «no respondió».
        expect(v!.detalle).toContain("no respondió");
    });

    // ── Estados que no se cablean aquí (passthrough de la fuente) → null ──
    it("CUMPLIDA / VENCIDA_SIN_RESPUESTA → null (no los toca esta derivación)", () => {
        expect(derivarVistaFranjaPasada("CUMPLIDA", INICIO, FIN, AHORA, PROF, AHORA)).toBeNull();
        expect(derivarVistaFranjaPasada("VENCIDA_SIN_RESPUESTA", INICIO, FIN, AHORA, PROF, AHORA)).toBeNull();
    });
});
