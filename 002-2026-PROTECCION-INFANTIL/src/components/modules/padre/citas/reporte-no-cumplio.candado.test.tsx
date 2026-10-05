/**
 * CANDADO · SPEC-864 (FORMA-SPEC864 §2.2-2.5) · «El profesional no cumplió».
 *
 * El padre reporta DESDE su cita CONFIRMADA cuya hora ya pasó que el profesional no cumplió. Reusa la
 * puerta de PQR (SPEC-752): crea un `PeticionServicio` motivo CITA atado a `solicitudId` = esta cita.
 * Conductas que NO se pueden fingir (render real + el POST que dispara):
 *
 *  §2.2  El disparador es botón FANTASMA (`variant="outline"` → `btn-ds--fantasma`), NUNCA rubí ni
 *        Primario (D-120: el estado de una cita es PROCESO, jamás criticidad). Cero rubí en TODO el
 *        recorrido de 864.
 *  §2.3  El paso de confirmación trae el copy VERBATIM de Diseño y NO tiene campo de texto libre
 *        (imposibilidad estructural, igual que PuertaSoporte).
 *  §2.4  Al avisar, el POST va a la puerta de PQR con `{ motivo: "CITA", solicitudId }` (sin texto) y,
 *        tras refrescar, aparece el MARCADOR «ya nos avisaste» con el número que DEVUELVE el registro.
 *  §2.5.2 Ningún texto del recorrido promete reembolso/monto/plazo (D-140 · I-393).
 *  §2.5.5 Con una PQR abierta sobre la cita, el disparador DESAPARECE (no se radica dos veces).
 *  §2.7  El disparador SOLO aparece en CONFIRMADA cuya hora ya pasó — nunca viva, nunca en otro estado
 *        (control positivo por remoción del discriminador).
 *
 * La NO-transición de `EstadoSolicitudCita` (§2.5.4) y la idempotencia/propiedad del backend las fija el
 * candado del servicio (`peticion-servicio-service.candado.test.ts`), contra la BD.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { CitaParaPadreDto } from "@/lib/profesional/cita/dto";

// La tarjeta de encuesta hace su propio fetch al montar; se aísla (como el patrón de GenerarPase en
// el candado hermano) para que el recorrido de 864 no dependa de ese endpoint.
vi.mock("@/components/modules/encuesta/TarjetaEncuestaPendiente", () => ({
    TarjetaEncuestaPendiente: () => null,
}));

import { EsperaCitaPanel } from "./EsperaCitaPanel";

const ayerH = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

/** CONFIRMADA cuya hora YA PASÓ (franja de ayer). `enlace: PASADA` = rama C2 limpia (confirmada-pasada). */
function citaPasada(over: Partial<CitaParaPadreDto> = {}): CitaParaPadreDto {
    return {
        id: "c1",
        estado: "CONFIRMADA",
        urgencia: "SIN_APURO",
        creadoEn: ayerH(50),
        venceEn: ayerH(2),
        pagoAprobadoEn: ayerH(50),
        montoTotal: 80_000,
        profesional: { id: "p1", nombreVisible: "Dra. Ramírez", tituloProfesional: "Psicología", ciudad: { id: "co", nombre: "Bogotá" } },
        franja: { inicio: ayerH(26), fin: ayerH(25), modalidad: "VIRTUAL" },
        enlace: { estado: "PASADA" },
        solicitudPreviaId: null,
        pagoHeredadoDeId: null,
        expedienteCompartidoId: null,
        ...over,
    };
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("SPEC-864 · el disparador «El profesional no cumplió»", () => {
    it("§2.2/§2.5.1: es botón FANTASMA (outline), NUNCA rubí ni Primario; cero rubí en el recorrido", () => {
        const { container } = render(<EsperaCitaPanel citaInicial={citaPasada()} />);
        const boton = screen.getByRole("button", { name: /El profesional no cumplió/ });
        const cls = boton.className;
        expect(cls, "el disparador es Fantasma del sistema").toContain("btn-ds--fantasma");
        expect(cls, "§2.2: nunca Fantasma-rubí").not.toContain("rubi");
        expect(cls, "§2.2: nunca Primario").not.toContain("btn-ds--primary");
        // Cero rubí en TODA la pantalla de la cita CONFIRMADA-pasada (D-120).
        expect(container.innerHTML.toLowerCase(), "cero rubí en el recorrido de 864").not.toContain("rubi");
    });

    it("§2.3: el paso de confirmación trae el copy verbatim y NO tiene campo de texto libre", () => {
        const { container } = render(<EsperaCitaPanel citaInicial={citaPasada()} />);
        fireEvent.click(screen.getByRole("button", { name: /El profesional no cumplió/ }));
        // Copy verbatim de Diseño (FORMA §2.3).
        expect(screen.getByText("Nos cuentas que el profesional no cumplió")).toBeTruthy();
        expect(
            screen.getByText("Vamos a revisar qué pasó con esta cita. No tienes que escribir nada: con avisarnos basta."),
        ).toBeTruthy();
        expect(screen.getByRole("button", { name: /^Avisar a nuestro equipo$/ })).toBeTruthy();
        expect(screen.getByRole("button", { name: /^Volver$/ })).toBeTruthy();
        // SIN texto libre (§2.5.3): ni textarea ni input de texto ni ningún role textbox.
        expect(container.querySelector("textarea"), "§2.5.3: sin textarea").toBeNull();
        expect(container.querySelector('input[type="text"]'), "§2.5.3: sin input de texto").toBeNull();
        expect(screen.queryByRole("textbox"), "§2.5.3: sin ningún textbox").toBeNull();
    });

    it("§2.5.2: ningún texto del recorrido promete reembolso, monto ni plazo", () => {
        const PROHIBIDO = /reembols|devolv|reintegr|plazo|en \d+\s*d[ií]as?/i;
        // Recorrido completo: disparador → confirmación.
        const flujo = render(<EsperaCitaPanel citaInicial={citaPasada()} />);
        fireEvent.click(screen.getByRole("button", { name: /El profesional no cumplió/ }));
        expect(flujo.container.textContent ?? "", "sin promesa de plata/plazo en disparador+confirmación").not.toMatch(PROHIBIDO);
        cleanup();
        // Y la variante del marcador (PQR abierta).
        const marc = render(<EsperaCitaPanel citaInicial={citaPasada({ peticionCitaAbierta: { numeroSeguimiento: "pqr_x" } })} />);
        expect(marc.container.textContent ?? "", "sin promesa de plata/plazo en el marcador").not.toMatch(PROHIBIDO);
    });

    it("§2.4: avisar hace POST a la puerta de PQR con { motivo: CITA, solicitudId } y SIN texto; tras refrescar aparece el marcador", async () => {
        const citaConPqr = citaPasada({ peticionCitaAbierta: { numeroSeguimiento: "pqr_nuevo_1" } });
        const fetchMock = vi.fn((url: string | URL, init?: RequestInit) => {
            const u = String(url);
            if (u.includes("/api/padre/soporte/peticiones")) {
                return Promise.resolve({ ok: true, status: 201, json: () => Promise.resolve({ numeroSeguimiento: "pqr_nuevo_1" }) });
            }
            if (u.includes("/api/padre/citas/")) {
                return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: citaConPqr }) });
            }
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<EsperaCitaPanel citaInicial={citaPasada()} />);
        fireEvent.click(screen.getByRole("button", { name: /El profesional no cumplió/ }));
        fireEvent.click(screen.getByRole("button", { name: /^Avisar a nuestro equipo$/ }));

        // El POST a la puerta de PQR con el payload REAL del endpoint (motivo CITA + solicitudId, sin texto).
        await waitFor(() => {
            const post = fetchMock.mock.calls.find((c) => String(c[0]).includes("/api/padre/soporte/peticiones"));
            expect(post, "disparó el POST a la puerta de PQR").toBeTruthy();
            expect(post![1]?.method).toBe("POST");
            expect(JSON.parse(String(post![1]?.body))).toEqual({ motivo: "CITA", solicitudId: "c1" });
        });
        // Refrescó desde la entidad persistida → aparece el marcador con el número que DEVOLVIÓ el registro,
        // y el disparador desaparece.
        expect(await screen.findByText(/Ya nos avisaste que el profesional no cumplió/)).toBeTruthy();
        expect(screen.getByText("pqr_nuevo_1")).toBeTruthy();
        expect(screen.queryByRole("button", { name: /El profesional no cumplió/ })).toBeNull();
    });

    it("§2.5.5: con una PQR ABIERTA sobre la cita, el marcador manda y el disparador NO se muestra", () => {
        render(<EsperaCitaPanel citaInicial={citaPasada({ peticionCitaAbierta: { numeroSeguimiento: "pqr_abc123" } })} />);
        expect(screen.getByText(/Ya nos avisaste que el profesional no cumplió/)).toBeTruthy();
        expect(screen.getByText("pqr_abc123")).toBeTruthy();
        expect(
            screen.queryByRole("button", { name: /El profesional no cumplió/ }),
            "§2.5.5: no se radica dos veces — sin disparador cuando ya hay PQR abierta",
        ).toBeNull();
    });

    it("§2.7: control positivo — el disparador SOLO en CONFIRMADA-pasada (ni viva, ni otro estado)", () => {
        // CONFIRMADA VIVA (franja futura): no hay disparador (la sesión no ocurrió aún).
        const futura = citaPasada({
            franja: { inicio: new Date(Date.now() + 24 * 3600_000).toISOString(), fin: new Date(Date.now() + 25 * 3600_000).toISOString(), modalidad: "VIRTUAL" },
            enlace: { estado: "SIN_PUBLICAR" },
        });
        const viva = render(<EsperaCitaPanel citaInicial={futura} />);
        expect(screen.queryByRole("button", { name: /El profesional no cumplió/ }), "no en CONFIRMADA viva").toBeNull();
        cleanup();
        // PAGADA_PENDIENTE pasada: no es CONFIRMADA → no hay disparador.
        render(<EsperaCitaPanel citaInicial={citaPasada({ estado: "PAGADA_PENDIENTE" })} />);
        expect(screen.queryByRole("button", { name: /El profesional no cumplió/ }), "no en PAGADA_PENDIENTE").toBeNull();
        void viva;
    });
});
