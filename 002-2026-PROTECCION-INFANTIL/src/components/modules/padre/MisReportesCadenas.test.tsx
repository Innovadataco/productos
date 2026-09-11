import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MisReportesCadenas, type Cadena } from "./MisReportesCadenas";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

// Hijos del acordeón que no son el foco del bloque: se aislan para no arrastrar
// sus propios fetches (el texto sensible se revela con flujo aparte, SPEC-584).
vi.mock("./TextoSensible", () => ({
    TextoSensible: () => <div data-testid="texto-sensible" />,
}));
vi.mock("./VerAnalisis", () => ({
    VerAnalisis: () => <div data-testid="ver-analisis" />,
}));

afterEach(() => {
    vi.restoreAllMocks();
});

const CADENA_BASE: Cadena = {
    reportePrincipalId: "rp1",
    identificador: "7001",
    plataforma: "WhatsApp",
    clasificacionDominante: "Solicitud de material",
    cantidadEventos: 1,
    ultimoEventoEn: "2026-09-07T17:00:00.000Z",
    expedienteId: null,
    eventos: [
        {
            id: "ev1",
            fechaIncidente: "2026-09-07T17:00:00.000Z",
            horaAproximada: false,
            franja: null,
            creadoEn: "2026-09-07T17:30:00.000Z",
            estado: "CLASIFICADO",
            categoriaLabel: "Solicitud de material",
            explicacion: null,
            analisisIa: null,
            ficha: { pais: "Colombia", ciudad: "Montería", edadVictima: 12, origen: "padre" },
            esPrincipal: true,
            hijoNombre: null,
        },
    ],
    otrosReportes: [],
};

function mockFetchCadenas(cadenas: Cadena[]) {
    return vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ cadenas, retapadoMinutos: 10 }),
    } as Response);
}

async function renderBloqueOtros(cadenas: Cadena[]) {
    mockFetchCadenas(cadenas);
    render(<MisReportesCadenas />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver los eventos" }));
    return screen.getByLabelText("Otros reportes sobre este identificador");
}

describe("MisReportesCadenas · bloque Otros reportes (SPEC-593)", () => {
    it("muestra título, contador prominente y cada evento con fecha, lugar y clasificación", async () => {
        const bloque = await renderBloqueOtros([
            {
                ...CADENA_BASE,
                otrosReportes: [
                    {
                        id: "o1",
                        creadoEn: "2026-09-08T05:11:00.000Z",
                        pais: "Colombia",
                        ciudad: "Montería",
                        categoriaLabel: "Solicitud de material",
                        esAnonimo: true,
                    },
                    {
                        id: "o2",
                        creadoEn: "2026-09-05T10:00:00.000Z",
                        pais: "Colombia",
                        ciudad: null,
                        categoriaLabel: "Contacto insistente",
                        esAnonimo: false,
                    },
                ],
            },
        ]);

        expect(bloque).toBeTruthy();
        // Contador prominente (badge) + énfasis en la frase: dos pintadas de «2 personas más».
        expect(screen.getAllByText("2 personas más").length).toBe(2);
        expect(screen.getByText(/reportaron a/)).toBeTruthy();
        expect(screen.getByText("7001")).toBeTruthy();
        // Cada evento con fecha, lugar y clasificación (badge).
        expect(screen.getByText(/Montería/)).toBeTruthy();
        expect(screen.getByText("Solicitud de material")).toBeTruthy();
        expect(screen.getByText("Contacto insistente")).toBeTruthy();
        // Nota de privacidad en texto secundario.
        expect(screen.getByText(/solo ves fecha, lugar y clasificación/)).toBeTruthy();
    });

    it("singular cuando solo hay una persona más", async () => {
        await renderBloqueOtros([
            {
                ...CADENA_BASE,
                otrosReportes: [
                    {
                        id: "o1",
                        creadoEn: "2026-09-08T05:11:00.000Z",
                        pais: "Colombia",
                        ciudad: "Montería",
                        categoriaLabel: "Solicitud de material",
                        esAnonimo: true,
                    },
                ],
            },
        ]);

        expect(screen.getByText("1 persona más")).toBeTruthy();
        expect(screen.getByText(/Una persona más reportó a/)).toBeTruthy();
    });

    it("NO muestra texto de reportes ajenos ni quién reportó", async () => {
        await renderBloqueOtros([
            {
                ...CADENA_BASE,
                otrosReportes: [
                    {
                        id: "o1",
                        creadoEn: "2026-09-08T05:11:00.000Z",
                        pais: "Colombia",
                        ciudad: "Montería",
                        categoriaLabel: "Solicitud de material",
                        esAnonimo: true,
                    },
                ],
            },
        ]);

        // Ni el flag de anonimato ni la procedencia: la regla de privacidad es
        // "nunca el texto ni quién reportó".
        expect(screen.queryByText(/anónimo|otro padre/i)).toBeNull();
        // El texto del reporte propio queda dentro de TextoSensible (mockeado):
        // nada del contenido ajeno aparece en el bloque.
        expect(screen.queryByText(/No estás solo/)).toBeNull();
        expect(screen.queryByText(/fortalece tu expediente/i)).toBeNull();
        expect(screen.queryByText(/Nada se cierra/i)).toBeNull();
    });

    it("sin otros reportes: mensaje simple, sin contador", async () => {
        const bloque = await renderBloqueOtros([CADENA_BASE]);

        expect(screen.getByText("Sin otros reportes por ahora.")).toBeTruthy();
        expect(screen.queryByText(/personas más/)).toBeNull();
        expect(bloque.textContent).toContain("Otros reportes sobre este identificador");
    });
});
