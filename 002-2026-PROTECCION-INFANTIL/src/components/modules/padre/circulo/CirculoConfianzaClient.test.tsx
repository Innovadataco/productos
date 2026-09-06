import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { CirculoConfianzaClient } from "./CirculoConfianzaClient";

vi.mock("next/link", () => ({
    default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

const PLATAFORMAS = [
    { id: "p1", nombre: "Instagram", clave: "instagram" },
    { id: "p2", nombre: "WhatsApp", clave: "whatsapp" },
];

const MARTA = {
    id: "c1",
    nombre: "Marta Gómez",
    parentesco: "Abuela",
    etiqueta: null,
    nota: null,
    activo: true,
    creadoEn: "2026-08-03T10:00:00.000Z",
    estado: "sinReportes" as const,
    totalReportes: 0,
    identificadores: [
        { id: "i1", valor: "marta.gomez", tipo: null, plataforma: PLATAFORMAS[1]!, activo: true },
    ],
};

const CARLOS = {
    id: "c2",
    nombre: "Carlos Ramírez",
    parentesco: "Tío",
    etiqueta: null,
    nota: null,
    activo: true,
    creadoEn: "2026-08-12T10:00:00.000Z",
    estado: "enRevision" as const,
    totalReportes: 1,
    identificadores: [
        { id: "i2", valor: "tiocarlos01", tipo: null, plataforma: PLATAFORMAS[0]!, activo: true },
    ],
};

/** Responde cada endpoint que la pantalla consulta al cargar. */
function mockearFetch(contactos: unknown[]) {
    const fetchMock = vi.fn(async (url: string) => {
        if (url.startsWith("/api/circulo-confianza/preferencias")) {
            return { ok: true, json: async () => ({ notificacionesCirculo: true }) };
        }
        if (url === "/api/circulo-confianza") {
            return { ok: true, json: async () => ({ contactos, resumen: {}, tope: 20 }) };
        }
        if (url === "/api/plataformas") {
            return { ok: true, json: async () => PLATAFORMAS };
        }
        return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

describe("Tu círculo de confianza · A-73 (SPEC-367)", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("decisión 1 · usa LOS DOS nombres: la miga 'A quién vigilo' y el título 'Tu círculo de confianza'", async () => {
        mockearFetch([]);
        render(<CirculoConfianzaClient />);

        expect(await screen.findByText("A quién vigilo")).toBeTruthy();
        const titulo = screen.getByRole("heading", { level: 1 });
        expect(titulo.textContent).toContain("Tu círculo");
        expect(titulo.textContent).toContain("de confianza");
    });

    it("estado 1 · vacío: muestra el PRIMER PASO, no un vacío", async () => {
        mockearFetch([]);
        render(<CirculoConfianzaClient />);

        expect(await screen.findByText("Todavía no vigilas a nadie")).toBeTruthy();
        // Los tres pasos, en lenguaje de padre.
        expect(screen.getByText("Agrega a la persona")).toBeTruthy();
        expect(screen.getByText("Escribe cómo la encuentran")).toBeTruthy();
        expect(screen.getByText("Nosotros la vigilamos")).toBeTruthy();
        expect(screen.getByRole("button", { name: /Agregar a la primera persona/ })).toBeTruthy();
        // La promesa que calma: la persona nunca se entera.
        expect(screen.getByText(/no recibe ningún aviso/)).toBeTruthy();
    });

    it("estado 2 · con personas: resumen, atención arriba y una tarjeta por persona", async () => {
        mockearFetch([CARLOS, MARTA]);
        render(<CirculoConfianzaClient />);

        expect(await screen.findByText("Carlos Ramírez")).toBeTruthy();
        expect(screen.getByText("Marta Gómez")).toBeTruthy();

        // Resumen con el cupo real que manda la API (no un 20 inventado).
        expect(screen.getByText(/2 personas/)).toBeTruthy();
        expect(screen.getByText(/de 20/)).toBeTruthy();

        // Lo que apremia, primero.
        expect(screen.getByText("Necesita tu atención")).toBeTruthy();
        expect(screen.getByText(/Alguien reportó a Carlos Ramírez/)).toBeTruthy();

        // Decisión 2: el reporte EN REVISIÓN ya se muestra, no se espera a procesarlo.
        expect(screen.getByText("1 reporte en revisión")).toBeTruthy();
        expect(screen.getByText("Sin reportes")).toBeTruthy();
    });

    it("decisión 3 · la pantalla principal queda simple: sin mapas ni estadísticas sueltas", async () => {
        mockearFetch([CARLOS, MARTA]);
        render(<CirculoConfianzaClient />);
        await screen.findByText("Carlos Ramírez");

        // Las estadísticas viven DENTRO de cada persona ("Ver de qué se trata").
        expect(screen.queryByText("De qué se trata")).toBeNull();
        expect(screen.queryByText("Dónde")).toBeNull();
        expect(screen.queryByText("Cuándo")).toBeNull();
        expect(screen.getAllByRole("button", { name: "Ver de qué se trata" }).length).toBeGreaterThan(0);
    });

    it("estado 3 · agregar: las tres preguntas en orden humano, sin jerga", async () => {
        mockearFetch([]);
        render(<CirculoConfianzaClient />);
        const abrir = await screen.findByRole("button", { name: /Agregar a la primera persona/ });

        fireEvent.click(abrir);

        expect(await screen.findByText("¿Cómo se llama?")).toBeTruthy();
        expect(screen.getByText("¿Qué es de tus hijos?")).toBeTruthy();
        expect(screen.getByText("¿Cómo se le encuentra en internet?")).toBeTruthy();

        // Nada de jerga técnica en la cara del padre.
        expect(screen.queryByText(/identificador/i)).toBeNull();
        expect(screen.queryByText(/etiqueta/i)).toBeNull();
    });

    it("no se le pide al padre nada en rojo: el tono de alerta es ámbar", async () => {
        mockearFetch([CARLOS, MARTA]);
        const { container } = render(<CirculoConfianzaClient />);
        await screen.findByText("Carlos Ramírez");

        // `rubi` es el rojo del sistema de diseño; el círculo no lo usa nunca.
        expect(container.innerHTML).not.toContain("rubi");
        expect(container.innerHTML).toContain("ambar");
    });

    it("solo pide lo que necesita: una persona sin reportes no ofrece 'Ver de qué se trata'", async () => {
        mockearFetch([MARTA]);
        render(<CirculoConfianzaClient />);
        await screen.findByText("Marta Gómez");

        await waitFor(() => {
            expect(screen.queryByRole("button", { name: "Ver de qué se trata" })).toBeNull();
        });
    });

    it("SPEC-540 · «Quitar» abre un MODAL del estándar (no window.confirm), nombra a la persona y avisa permanente; confirmar ejecuta el borrado", async () => {
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
        const fetchMock = mockearFetch([MARTA]);
        render(<CirculoConfianzaClient />);
        await screen.findByText("Marta Gómez");

        // Antes de abrir, solo el botón de la tarjeta.
        fireEvent.click(screen.getByRole("button", { name: "Quitar" }));

        // Es un modal (está en el DOM con role=dialog), NO window.confirm.
        const dialog = await screen.findByRole("dialog");
        expect(dialog.textContent).toContain("Marta Gómez"); // nombra a la persona
        expect(dialog.textContent).toMatch(/no se puede deshacer/i); // avisa que es permanente
        expect(confirmSpy).not.toHaveBeenCalled();

        // La confirmación ACTÚA: dispara el DELETE del contacto.
        fireEvent.click(within(dialog).getByRole("button", { name: "Quitar" }));
        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith("/api/circulo-confianza/c1", { method: "DELETE" });
        });
    });
});
