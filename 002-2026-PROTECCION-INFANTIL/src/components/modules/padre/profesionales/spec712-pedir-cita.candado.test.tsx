/**
 * CANDADO · SPEC-712 (FORMA-SPEC712 §1-§5) + SPEC-729 (§2/§3) · la pantalla del
 * padre para pedir cita, medida por Jelkin en `/dashboard/padre/profesionales/<id>`.
 *
 * Conductas que no se pueden fingir (render real + candado de copy):
 *  §1  Encabezado «Elige un horario»; la frase del «admin» no vuelve.
 *  §2 (reencuadrado por SPEC-729): la presentación se TOMA de Mi perfil. Si la tiene
 *      → «Lo que nos contaste» + «Editar» (no se re-pide). Si está vacía → enlace
 *      «Complétala en Mi perfil», NO un formulario acá.
 *  §3  Franjas ordenadas más-próxima-primero; chip «Solo esta semana» que FILTRA (y
 *      lo dice honesto si no hay); línea de emergencia SIEMPRE visible; toggle inerte
 *      retirado.
 *  §4  Modal SÓLIDO, velo firme + blur, z-50.
 *  §5  Sin «admin»/«48h»; «en proceso de validación»; ningún botón dice «pagar».
 *  SPEC-729 §3: el mínimo de la presentación es 10 (no 20), en cliente Y servidor.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

const pushSpy = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushSpy }) }));

import { SolicitarCitaPanel, finDeSemana } from "./SolicitarCitaPanel";

const RUTA = path.resolve(process.cwd(), "src/components/modules/padre/profesionales/SolicitarCitaPanel.tsx");
const SRC = fs.readFileSync(RUTA, "utf-8");

const PROPS = {
    profesionalId: "prof1",
    tarifaProfesionalCOP: 120_000,
    precioEstandarPrimeraCitaCOP: 80_000,
    duracionMinutos: 45,
};

function franja(id: string, inicio: Date, modalidad: "VIRTUAL" | "PRESENCIAL") {
    return { id, inicio: inicio.toISOString(), fin: new Date(inicio.getTime() + 3_600_000).toISOString(), modalidad };
}

// SPEC-729: al montar, el panel hace DOS fetch — /api/padre/perfil (presentacionEstandar)
// y las franjas. El mock enruta por URL.
function mockFetch(opts: { franjas?: Array<Record<string, unknown>>; presentacion?: string | null } = {}) {
    const { franjas = [], presentacion = null } = opts;
    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
        const u = typeof input === "string" ? input : input.toString();
        if (u.startsWith("/api/padre/perfil")) {
            return Promise.resolve(
                new Response(JSON.stringify({ perfil: { presentacionEstandar: presentacion } }), { status: 200 }),
            );
        }
        return Promise.resolve(new Response(JSON.stringify({ data: franjas }), { status: 200 }));
    });
}

beforeEach(() => {
    pushSpy.mockReset();
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("SPEC-712 + SPEC-729 · pantalla del padre para pedir cita", () => {
    it("§1 encabezado «Elige un horario»; la frase del «admin» no vuelve", async () => {
        mockFetch();
        render(<SolicitarCitaPanel {...PROPS} />);
        expect(await screen.findByRole("heading", { name: "Elige un horario" })).toBeTruthy();
        expect(SRC).not.toContain("El pago se aprueba luego con un admin");
    });

    it("§3 la línea de emergencia va SIEMPRE visible: 141 y 123 (tel) + Te Protejo", async () => {
        mockFetch();
        const { container } = render(<SolicitarCitaPanel {...PROPS} />);
        expect(await screen.findByText(/¿Es una emergencia\?/)).toBeTruthy();
        expect(container.querySelector('a[href="tel:141"]')).toBeTruthy();
        expect(container.querySelector('a[href="tel:123"]')).toBeTruthy();
        expect(container.querySelector('a[href="https://www.teprotejo.gov.co"]')).toBeTruthy();
    });

    it("§2 con presentación en Mi perfil: MUESTRA «Lo que nos contaste» + Editar; no re-pide", async () => {
        mockFetch({ presentacion: "Mi hijo de 12 está siendo acosado en el colegio." });
        render(<SolicitarCitaPanel {...PROPS} />);
        expect(await screen.findByText("Lo que nos contaste")).toBeTruthy();
        expect(screen.getByText(/Mi hijo de 12/)).toBeTruthy();
        expect(screen.queryByText(/Complétala en Mi perfil/)).toBeNull();
        // «Editar» abre el textarea para ajustarlo (ajuste puntual, SPEC-729 §2).
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        expect(screen.getByLabelText(/Ajusta lo que nos contaste/)).toBeTruthy();
    });

    it("§2 sin presentación: enlaza a «Mi perfil», NO un formulario acá", async () => {
        mockFetch({ presentacion: null });
        render(<SolicitarCitaPanel {...PROPS} />);
        expect(await screen.findByText(/Aún no tienes una presentación/)).toBeTruthy();
        const link = screen.getByRole("link", { name: /Complétala en Mi perfil/ });
        expect(link.getAttribute("href")).toBe("/dashboard/padre/perfil");
        expect(screen.queryByRole("textbox")).toBeNull(); // no se re-pide acá
        expect(screen.queryByText("Lo que nos contaste")).toBeNull();
    });

    it("§3 franjas ordenadas más-próxima-primero; el chip «Solo esta semana» filtra de verdad", async () => {
        const fin = finDeSemana();
        const dentro = new Date(Math.floor((Date.now() + fin.getTime()) / 2)); // esta semana
        const fuera = new Date(fin.getTime() + 3 * 24 * 3_600_000); // semana siguiente
        // La API los entrega DESORDENADOS (la lejana primero): el orden lo pone el componente.
        mockFetch({ franjas: [franja("lejos", fuera, "PRESENCIAL"), franja("cerca", dentro, "VIRTUAL")] });
        const { container } = render(<SolicitarCitaPanel {...PROPS} />);
        await screen.findByText("Virtual");
        const html = container.innerHTML;
        expect(html.indexOf("Virtual")).toBeLessThan(html.indexOf("Presencial")); // próxima antes
        fireEvent.click(screen.getByRole("button", { name: "Solo esta semana" }));
        expect(screen.getByText("Virtual")).toBeTruthy();
        expect(screen.queryByText("Presencial")).toBeNull();
    });

    it("§3 sin horarios esta semana: lo dice honesto («el más próximo es el …»)", async () => {
        const fin = finDeSemana();
        const fuera = new Date(fin.getTime() + 3 * 24 * 3_600_000);
        mockFetch({ franjas: [franja("lejos", fuera, "PRESENCIAL")] });
        render(<SolicitarCitaPanel {...PROPS} />);
        await screen.findByText("Presencial");
        fireEvent.click(screen.getByRole("button", { name: "Solo esta semana" }));
        expect(screen.getByText(/no tiene horarios esta semana; el más próximo es el/)).toBeTruthy();
        expect(screen.queryByText("Presencial")).toBeNull();
    });

    it("§3 el toggle binario inerte «Sin apuro» se retiró", () => {
        expect(SRC).not.toContain("Sin apuro");
    });

    it("§4 el modal es SÓLIDO y por encima de todo (no el vidrio en z-40)", () => {
        expect(SRC).toContain("bg-superficie-2"); // superficie opaca de tarjeta
        expect(SRC).toContain("bg-tinta/55"); // velo firme
        expect(SRC).toContain("backdrop-blur");
        expect(SRC).toContain("z-50");
        expect(SRC).not.toContain("bg-tinta/40");
        expect(SRC).not.toContain("z-40");
        expect(SRC).not.toContain("glass w-full max-w-md");
    });

    it("§5 sin «admin» ni «48h» prometida en el flujo estándar; «en proceso de validación»", () => {
        expect(SRC).toContain("Tu pago está en proceso de validación");
        expect(SRC).not.toContain("El pago se aprueba manualmente por un admin");
        expect(SRC).not.toContain("si el profesional no confirma en 48h");
    });

    it("§5 ningún botón dice «pagar» sin cobrar: CTA «Solicitar la cita», confirm «Confirmar solicitud»", async () => {
        expect(SRC).not.toContain("Pagar y solicitar");
        expect(SRC).not.toContain("Confirmar y pagar");
        // En vivo: con presentación de Mi perfil + franja, la CTA abre el modal.
        const dentro = new Date(Math.floor((Date.now() + finDeSemana().getTime()) / 2));
        mockFetch({
            presentacion: "Un relato suficientemente largo para pasar el mínimo.",
            franjas: [franja("cerca", dentro, "VIRTUAL")],
        });
        render(<SolicitarCitaPanel {...PROPS} />);
        const cta = await screen.findByRole("button", { name: "Solicitar la cita" });
        fireEvent.click(screen.getByText("Virtual")); // selecciona franja → habilita la CTA
        fireEvent.click(cta);
        expect(await screen.findByRole("button", { name: "Confirmar solicitud" })).toBeTruthy();
        expect(screen.getByText(/Tu pago está en proceso de validación/)).toBeTruthy();
    });

    it("SPEC-729 §3 · el mínimo de la presentación es 10 (no 20), en cliente Y servidor", () => {
        // Cliente: la validez y el «Faltan N» usan 10.
        expect(SRC).toContain(">= 10");
        expect(SRC).not.toContain(">= 20");
        // Servidor: el schema de la cita exige min(10), max(500) — el 20 viejo se fue.
        const rutaSrv = path.resolve(process.cwd(), "src/app/api/padre/citas/route.ts");
        const srcSrv = fs.readFileSync(rutaSrv, "utf-8");
        expect(/presentacion:\s*z\.string\(\)\.trim\(\)\.min\(10\)\.max\(500\)/.test(srcSrv)).toBe(true);
        expect(srcSrv).not.toContain(".min(20)");
    });
});
