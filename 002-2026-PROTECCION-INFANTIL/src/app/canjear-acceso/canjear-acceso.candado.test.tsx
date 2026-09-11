/**
 * SPEC-610 (I-372) · Candados de la VISTA del pase (D-129 léxico · D-130 forma).
 *
 * D-130: el profesional ve TODOS los eventos; los ANOTADOS POR LA FAMILIA (sin
 * reporte) se marcan como tales y NO llevan chip de análisis; los de origen reporte
 * dicen «Clasificado por el análisis» con su categoría. Este candado RENDERIZA la
 * pantalla del profesional y muere si un evento manual pinta chip, o si el de
 * reporte pierde su etiqueta.
 *
 * D-129: dos mecanismos, dos nombres. En las superficies del PASE nunca se dice
 * «código» (acentuado, palabra visible) — eso confunde con la «llave» del padre. Se
 * verifica en el DOM de la pantalla del profesional y por escaneo de fuente (sin
 * comentarios) de los componentes del padre que generan/muestran el pase.
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";
import CanjearAccesoPage from "./page";

const EVENTO_REPORTE = {
    eventoId: "ev-rep",
    fecha: "2026-09-01T10:05:00Z",
    texto: "Relato clasificado por el motor",
    esManual: false,
    categoria: "CONTACTO_INSISTENTE",
};
const EVENTO_MANUAL = {
    eventoId: "ev-man",
    fecha: "2026-09-02T08:00:00Z",
    texto: "Nota escrita por la familia",
    esManual: true,
    categoria: null,
};

function mockFetch() {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        const u = String(url);
        if (u.includes("/canjar")) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    tokenSesion: "11111111-1111-1111-1111-111111111111",
                    expiraEn: new Date(Date.now() + 900_000).toISOString(),
                    expedienteId: "e1",
                }),
            };
        }
        // /ver
        return {
            ok: true,
            status: 200,
            json: async () => ({
                eventos: [EVENTO_REPORTE, EVENTO_MANUAL],
                gravedad: "AMARILLO",
                expiraEn: new Date(Date.now() + 900_000).toISOString(),
            }),
        };
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

async function abrirCasoEnLaUI() {
    render(<CanjearAccesoPage />);
    fireEvent.change(screen.getByLabelText("El pase"), { target: { value: "ABCD2345" } });
    fireEvent.click(screen.getByRole("button", { name: /abrir el caso/i }));
    // Espera a que rendericen los eventos leídos.
    await screen.findByText("Nota escrita por la familia");
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("SPEC-610 · vista del profesional · D-130 (forma de los eventos)", () => {
    it("el evento MANUAL dice «Anotado por la familia» y NO lleva chip de análisis", async () => {
        mockFetch();
        await abrirCasoEnLaUI();

        const cardManual = screen.getByText("Nota escrita por la familia").closest("li");
        expect(cardManual, "el evento manual debería vivir en su propia tarjeta").not.toBeNull();
        const manual = within(cardManual!);
        expect(manual.getByText("Anotado por la familia")).toBeTruthy();
        // D-130: nada de análisis en un evento anotado por la familia.
        expect(manual.queryByText("Clasificado por el análisis")).toBeNull();
        expect(manual.queryByText("Contacto insistente")).toBeNull();
    });

    it("el evento de ORIGEN REPORTE dice «Clasificado por el análisis» con su categoría", async () => {
        mockFetch();
        await abrirCasoEnLaUI();

        const cardReporte = screen.getByText("Relato clasificado por el motor").closest("li");
        expect(cardReporte).not.toBeNull();
        const reporte = within(cardReporte!);
        expect(reporte.getByText("Clasificado por el análisis")).toBeTruthy();
        expect(reporte.getByText("Contacto insistente")).toBeTruthy();
    });
});

describe("SPEC-610 · D-129 · en las superficies del pase nunca se dice «código»", () => {
    // Un enlace/palabra COMENTADO no cuenta: se escanea el código SIN comentarios.
    function sinComentarios(s: string): string {
        return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    }

    it("la pantalla del profesional dice «pase» y jamás «código» (DOM)", async () => {
        mockFetch();
        render(<CanjearAccesoPage />);
        // En reposo ya se ve el lenguaje del pase, sin «código».
        expect(screen.getByText(/Abrir un caso con un pase/i)).toBeTruthy();
        expect(screen.getByLabelText("El pase")).toBeTruthy();
        expect((document.body.textContent ?? "").toLowerCase()).not.toContain("código");
        // Y tampoco tras abrir el caso.
        fireEvent.change(screen.getByLabelText("El pase"), { target: { value: "ABCD2345" } });
        fireEvent.click(screen.getByRole("button", { name: /abrir el caso/i }));
        await screen.findByText("Nota escrita por la familia");
        expect((document.body.textContent ?? "").toLowerCase()).not.toContain("código");
    });

    it("los componentes del padre que generan/muestran el pase no dicen «código» (fuente)", () => {
        const base = path.resolve(__dirname, "../../components/modules/padre");
        const archivos = ["GenerarPase.tsx", "QuienHaLeido.tsx"].map((f) => path.join(base, f));
        for (const archivo of archivos) {
            expect(fs.existsSync(archivo), `No encontré ${archivo}`).toBe(true);
            const fuente = sinComentarios(fs.readFileSync(archivo, "utf-8")).toLowerCase();
            expect(
                fuente.includes("código"),
                `${path.basename(archivo)} usa «código» en texto visible; D-129 exige «pase» (la «llave» es otra cosa).`
            ).toBe(false);
        }
        // Y el generador sí habla de «pase».
        const generar = fs.readFileSync(path.join(base, "GenerarPase.tsx"), "utf-8").toLowerCase();
        expect(generar.includes("pase")).toBe(true);
    });
});
