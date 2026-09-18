/**
 * CANDADO · SPEC-712 (FORMA-SPEC712 §1-§5) · la pantalla del padre para pedir cita,
 * medida por Jelkin en `/dashboard/padre/profesionales/<id>`.
 *
 * Conductas que no se pueden fingir (render real + candado de copy):
 *  §1  El encabezado es «Elige un horario»; la frase del «admin» no vuelve.
 *  §2  Con borrador: MUESTRA «Lo que nos contaste» + «Editar», sin re-pedir el
 *      relato; sin borrador: lo pide acá, una vez.
 *  §3  Franjas ordenadas de la más próxima a la más lejana; chip «Solo esta
 *      semana» que FILTRA de verdad (y lo dice honesto si no hay); línea de
 *      emergencia SIEMPRE visible (141/123/Te Protejo); toggle inerte retirado.
 *  §4  El modal es SÓLIDO (superficie opaca), velo firme + blur, z-50 — no el
 *      vidrio translúcido en z-40 que se leía transparente.
 *  §5  Sin «admin»/«48h» en el flujo estándar; «Tu pago está en proceso de
 *      validación…»; y ningún botón dice «pagar» sin cobrar (veredicto CEO).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

const pushSpy = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushSpy }) }));

// El borrador del paso previo (sessionStorage) se controla por test.
const leerBorrador = vi.fn();
vi.mock("@/lib/padre/borrador-consulta", () => ({
    leerBorradorConsulta: () => leerBorrador(),
    borrarBorradorConsulta: vi.fn(),
}));

import { SolicitarCitaPanel, finDeSemana } from "./SolicitarCitaPanel";

const RUTA = path.resolve(process.cwd(), "src/components/modules/padre/profesionales/SolicitarCitaPanel.tsx");
const SRC = fs.readFileSync(RUTA, "utf-8");

const PROPS = {
    profesionalId: "prof1",
    tarifaProfesionalCOP: 120_000,
    precioEstandarPrimeraCitaCOP: 80_000,
    duracionMinutos: 45,
};

function mockFranjas(franjas: Array<Record<string, unknown>>) {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ data: franjas }), { status: 200 }),
    );
}
function franja(id: string, inicio: Date, modalidad: "VIRTUAL" | "PRESENCIAL") {
    return { id, inicio: inicio.toISOString(), fin: new Date(inicio.getTime() + 3_600_000).toISOString(), modalidad };
}

beforeEach(() => {
    leerBorrador.mockReset();
    leerBorrador.mockReturnValue(null);
    pushSpy.mockReset();
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("SPEC-712 · pantalla del padre para pedir cita", () => {
    it("§1 encabezado «Elige un horario»; la frase del «admin» no vuelve", async () => {
        mockFranjas([]);
        render(<SolicitarCitaPanel {...PROPS} />);
        expect(await screen.findByRole("heading", { name: "Elige un horario" })).toBeTruthy();
        expect(SRC).not.toContain("El pago se aprueba luego con un admin");
    });

    it("§3 la línea de emergencia va SIEMPRE visible: 141 y 123 (tel) + Te Protejo", async () => {
        mockFranjas([]);
        const { container } = render(<SolicitarCitaPanel {...PROPS} />);
        expect(await screen.findByText(/¿Es una emergencia\?/)).toBeTruthy();
        expect(container.querySelector('a[href="tel:141"]')).toBeTruthy();
        expect(container.querySelector('a[href="tel:123"]')).toBeTruthy();
        expect(container.querySelector('a[href="https://www.teprotejo.gov.co"]')).toBeTruthy();
    });

    it("§2 con borrador: MUESTRA «Lo que nos contaste» + Editar, sin re-pedir; Editar abre el textarea", async () => {
        leerBorrador.mockReturnValue({
            presentacion: "Mi hijo de 12 está siendo acosado en el colegio.",
            urgencia: "SIN_APURO",
        });
        mockFranjas([]);
        render(<SolicitarCitaPanel {...PROPS} />);
        expect(await screen.findByText("Lo que nos contaste")).toBeTruthy();
        expect(screen.getByText(/Mi hijo de 12/)).toBeTruthy();
        // No se re-pide el relato (no hay textarea todavía).
        expect(screen.queryByLabelText(/Cuéntanos qué pasa/)).toBeNull();
        // «Editar» abre el textarea para ajustarlo.
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        expect(screen.getByLabelText(/Ajusta lo que nos contaste/)).toBeTruthy();
    });

    it("§2 sin borrador: se pide el relato acá (una vez), sin «Lo que nos contaste»", async () => {
        leerBorrador.mockReturnValue(null);
        mockFranjas([]);
        render(<SolicitarCitaPanel {...PROPS} />);
        expect(await screen.findByLabelText(/Cuéntanos qué pasa/)).toBeTruthy();
        expect(screen.queryByText("Lo que nos contaste")).toBeNull();
    });

    it("§3 franjas ordenadas más-próxima-primero; el chip «Solo esta semana» filtra de verdad", async () => {
        const fin = finDeSemana();
        const dentro = new Date(Math.floor((Date.now() + fin.getTime()) / 2)); // esta semana
        const fuera = new Date(fin.getTime() + 3 * 24 * 3_600_000); // semana siguiente
        // La API los entrega DESORDENADOS (la lejana primero): el orden lo pone el componente.
        mockFranjas([franja("lejos", fuera, "PRESENCIAL"), franja("cerca", dentro, "VIRTUAL")]);
        const { container } = render(<SolicitarCitaPanel {...PROPS} />);
        await screen.findByText("Virtual");
        const html = container.innerHTML;
        expect(html.indexOf("Virtual")).toBeLessThan(html.indexOf("Presencial")); // próxima antes
        // Chip ON → solo la de esta semana; la lejana desaparece.
        fireEvent.click(screen.getByRole("button", { name: "Solo esta semana" }));
        expect(screen.getByText("Virtual")).toBeTruthy();
        expect(screen.queryByText("Presencial")).toBeNull();
    });

    it("§3 sin horarios esta semana: lo dice honesto («el más próximo es el …»)", async () => {
        const fin = finDeSemana();
        const fuera = new Date(fin.getTime() + 3 * 24 * 3_600_000);
        mockFranjas([franja("lejos", fuera, "PRESENCIAL")]);
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
        // Lo que se quitó: el velo débil, el z bajo y el vidrio translúcido del modal.
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
        // En vivo: la CTA abre el modal y el confirm dice «Confirmar solicitud».
        leerBorrador.mockReturnValue({ presentacion: "Un relato suficientemente largo para pasar el mínimo.", urgencia: "SIN_APURO" });
        const dentro = new Date(Math.floor((Date.now() + finDeSemana().getTime()) / 2));
        mockFranjas([franja("cerca", dentro, "VIRTUAL")]);
        render(<SolicitarCitaPanel {...PROPS} />);
        const cta = await screen.findByRole("button", { name: "Solicitar la cita" });
        fireEvent.click(screen.getByText("Virtual")); // selecciona franja → habilita la CTA
        fireEvent.click(cta);
        expect(await screen.findByRole("button", { name: "Confirmar solicitud" })).toBeTruthy();
        expect(screen.getByText(/Tu pago está en proceso de validación/)).toBeTruthy();
    });
});
