/**
 * CANDADO · SPEC-749 FR-2 — la pantalla del padre dice la VERDAD después de la hora para
 * los tres estados-pasados (CONFIRMADA / PAGADA_PENDIENTE / SIN_CONFIRMAR), con el copy
 * de Diseño, SIN prometer un mecanismo inexistente ni culpar a un operador que no existe.
 *
 * Conducta, no palabras (FORMA-CITA-CONFIRMADA-HORA-PASADA-INTERIM · candado):
 *  · CONFIRMADA-pasada dice «Esta cita ya pasó», NO «Cita confirmada» a secas.
 *  · Ni «aparecerá» (prometería enlace), ni «atrasada»/«operador» (culparía a quien no existe).
 *  · Control positivo por MUTACIÓN, dos direcciones: franja pasada dispara; futura → null.
 * `now` inyectado. Unit puro (sin BD, sin render).
 */
import { describe, it, expect } from "vitest";
import { derivarVistaFranjaPasada } from "./vista-espera-cita";

const HORA = 60 * 60 * 1000;
const INICIO = Date.parse("2026-09-28T14:00:00.000Z");
const FIN = INICIO + HORA;
const AHORA = Date.parse("2026-09-29T18:00:00.000Z"); // > FIN → franja pasada
const FUTURO_INI = AHORA + 24 * HORA;
const FUTURO_FIN = FUTURO_INI + HORA;
const PROF = "Dra. Juez";
const PALABRAS_PROHIBIDAS = ["aparecerá", "atrasada", "operador", "Cita confirmada"];

describe("SPEC-749 FR-2 · derivarVistaFranjaPasada", () => {
    it("SPEC-792 C2 · CONFIRMADA-pasada → «Esta cita ya pasó» SIN [Pedir otra cita] (la encuesta es el primer camino)", () => {
        const v = derivarVistaFranjaPasada("CONFIRMADA", INICIO, FIN, AHORA, PROF, AHORA);
        expect(v).not.toBeNull();
        expect(v!.titulo).toBe("Esta cita ya pasó");
        expect(v!.detalle).toContain(PROF);
        expect(v!.detalle).toContain("ya pasó");
        expect(v!.tono).toBe("gris"); // tinta neutro, NO verde
        // SPEC-792 C2: NO se ofrece [Pedir otra cita] en paralelo —era la vía de escape del motor de
        // contradicciones (reprogramar sin responder nunca)—; la tarjeta de la encuesta (arriba) es el
        // primer camino y reprogramar va DESPUÉS, por el desenlace de la encuesta. Queda [Escríbenos].
        expect(v!.acciones).toEqual({ escribenos: true });
        expect(v!.acciones?.pedirOtraCita, "C2: pedir otra cita no puede ser una oferta paralela acá").toBeFalsy();
    });

    it("SPEC-792 C4 · CONFIRMADA-pasada + enlace NUNCA publicado → «no dependió de ti»; pedir otra cita HEREDA el pago", () => {
        const v = derivarVistaFranjaPasada("CONFIRMADA", INICIO, FIN, AHORA, PROF, AHORA, {
            enlaceNuncaPublicado: true,
            citaId: "cita-123",
        })!;
        expect(v.titulo).toBe("El acceso a tu reunión no llegó a estar disponible.");
        expect(v.detalle).toContain("no alcanzó a publicarse");
        expect(v.detalle).toContain("Esto no dependió de ti");
        // Límites: no culpa al operador, no inventa causa técnica, no dice que el profesional faltó.
        const texto = `${v.titulo} ${v.detalle}`.toLowerCase();
        for (const p of ["operador", "técnic", "falló", "no se conectó"]) {
            expect(texto, `C4 no debe nombrar «${p}»`).not.toContain(p);
        }
        // El servicio NO se entregó → pedir otra cita hereda el pago (control positivo del heredarDe).
        expect(v.acciones?.pedirOtraCita).toBe(true);
        expect(v.acciones?.heredarDeCitaId).toBe("cita-123");
        expect(v.acciones?.escribenos).toBe(true);
    });

    it("SPEC-792 C4 · control NEGATIVO: enlace SÍ publicado (sin el flag) → «ya pasó» normal, no el copy de C4", () => {
        const v = derivarVistaFranjaPasada("CONFIRMADA", INICIO, FIN, AHORA, PROF, AHORA)!;
        expect(v.titulo).toBe("Esta cita ya pasó");
        expect(v.titulo).not.toContain("no llegó a estar disponible");
    });

    it("CONFIRMADA-pasada: ni promesa de mecanismo ni culpa de operador (conducta, verbatim)", () => {
        const v = derivarVistaFranjaPasada("CONFIRMADA", INICIO, FIN, AHORA, PROF, AHORA)!;
        const texto = `${v.titulo} ${v.detalle}`.toLowerCase();
        for (const prohibida of PALABRAS_PROHIBIDAS) {
            expect(texto, `no debe aparecer «${prohibida}»`).not.toContain(prohibida.toLowerCase());
        }
    });

    it("CONFIRMADA + franja FUTURA → null (una cita viva NO se toca: sigue «Cita confirmada»)", () => {
        expect(derivarVistaFranjaPasada("CONFIRMADA", FUTURO_INI, FUTURO_FIN, AHORA, PROF, AHORA)).toBeNull();
    });

    it("PAGADA_PENDIENTE + franja pasada + plazo VIGENTE (< 48 h) → «aún puede responder»", () => {
        const v = derivarVistaFranjaPasada("PAGADA_PENDIENTE", INICIO, FIN, AHORA + HORA, PROF, AHORA);
        expect(v!.detalle).toContain("Todavía puede responder");
        expect(v!.tono).toBe("espera");
        expect(v!.acciones).toEqual({ revisarPago: true });
    });

    it("PAGADA_PENDIENTE + franja pasada + plazo VENCIDO (≥ 48 h) → «no respondió», tono rojo", () => {
        const v = derivarVistaFranjaPasada("PAGADA_PENDIENTE", INICIO, FIN, AHORA - HORA, PROF, AHORA);
        expect(v!.detalle).toContain("no respondió");
        expect(v!.tono).toBe("rojo");
    });

    it("SIN_CONFIRMAR + franja pasada → «no llegó a confirmarse y la hora ya pasó» + pedir otra cita", () => {
        const v = derivarVistaFranjaPasada("SIN_CONFIRMAR", INICIO, FIN, AHORA, PROF, AHORA);
        expect(v!.titulo).toContain("no llegó a confirmarse");
        expect(v!.acciones).toEqual({ pedirOtraCita: true });
    });

    // ── Control positivo, otra dirección: franja FUTURA → no dispara (null) ──
    it("PAGADA_PENDIENTE / SIN_CONFIRMAR + franja FUTURA → null", () => {
        expect(derivarVistaFranjaPasada("PAGADA_PENDIENTE", FUTURO_INI, FUTURO_FIN, AHORA + 48 * HORA, PROF, AHORA)).toBeNull();
        expect(derivarVistaFranjaPasada("SIN_CONFIRMAR", FUTURO_INI, FUTURO_FIN, AHORA, PROF, AHORA)).toBeNull();
    });

    // ── FR-4: dato ausente/basura falla CONSERVADOR (se trata como PASADA, dice la verdad) ──
    it("CONFIRMADA + franja ausente/basura → se trata como pasada (fallo conservador, FR-4)", () => {
        const v = derivarVistaFranjaPasada("CONFIRMADA", null, "no-es-fecha", AHORA, PROF, AHORA);
        expect(v!.titulo).toBe("Esta cita ya pasó");
    });

    // ── Estados terminales → null (la fuente los devuelve tal cual) ──
    it("CUMPLIDA / VENCIDA_SIN_RESPUESTA → null (no los toca esta derivación)", () => {
        expect(derivarVistaFranjaPasada("CUMPLIDA", INICIO, FIN, AHORA, PROF, AHORA)).toBeNull();
        expect(derivarVistaFranjaPasada("VENCIDA_SIN_RESPUESTA", INICIO, FIN, AHORA, PROF, AHORA)).toBeNull();
    });
});
