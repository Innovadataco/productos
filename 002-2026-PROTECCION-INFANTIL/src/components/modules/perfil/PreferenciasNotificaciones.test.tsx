/**
 * SPEC-326 §3.1: la pantalla de notificaciones del padre se lee en frases,
 * sin claves técnicas, con 2 toggles reales + bloque forzado.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PreferenciasNotificaciones } from "./PreferenciasNotificaciones";

function mockPreferencias(grupos: unknown[]) {
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
            if (typeof url === "string" && url.includes("/api/notificaciones/preferencias")) {
                return { ok: true, json: async () => ({ preferencias: grupos }) } as Response;
            }
            return { ok: true, json: async () => ({}) } as Response;
        })
    );
}

const GRUPOS_PADRE = [
    {
        evento: "padre.circulo_confianza.reporte_enriquecido",
        canales: [
            { evento: "padre.circulo_confianza.reporte_enriquecido", canal: "EMAIL", eventoRegla: "padre.circulo_confianza.reporte_enriquecido.email", obligatoria: false, habilitado: true },
        ],
    },
    {
        evento: "reporte.resuelto",
        canales: [
            { evento: "reporte.resuelto", canal: "EMAIL", eventoRegla: "reporte.resuelto.email", obligatoria: false, habilitado: true },
        ],
    },
    // Un evento extra que NO está en el catálogo curado → NO debe mostrarse como frase.
    {
        evento: "suscriptores.reporte_publicado",
        canales: [
            { evento: "suscriptores.reporte_publicado", canal: "EMAIL", eventoRegla: "suscriptores.reporte_publicado.email", obligatoria: false, habilitado: true },
        ],
    },
];

describe("PreferenciasNotificaciones · vista del padre (SPEC-326 §3.1)", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("muestra el correo, 2 toggles en frases y el bloque forzado, sin claves técnicas", async () => {
        mockPreferencias(GRUPOS_PADRE);
        render(<PreferenciasNotificaciones rol="PARENT" correo="juan@correo.com" />);

        // Encabezado con el correo.
        await waitFor(() => expect(screen.getByText("juan@correo.com")).toBeDefined());
        // SPEC-539: el cambio de correo queda honesto/deshabilitado hasta SPEC-547 (no un enlace muerto).
        expect(screen.getByText("Cambiar (pronto)")).toBeDefined();
        expect(screen.queryByRole("link", { name: /Cambiar/ })).toBeNull();

        // Los 2 toggles reales, en frases.
        expect(screen.getByText("Cuando alguien reporte a una persona de mi círculo")).toBeDefined();
        expect(screen.getByText("Cuando se resuelva un reporte que hice")).toBeDefined();

        // Bloque forzado.
        expect(screen.getByText(/siempre te llegan/)).toBeDefined();
        expect(screen.getByText(/Cuando tu plan esté por vencer/)).toBeDefined();

        // Cero claves técnicas visibles.
        expect(screen.queryByText(/reporte\.resuelto/)).toBeNull();
        expect(screen.queryByText(/circulo_confianza/)).toBeNull();
        // El evento fuera del catálogo NO aparece.
        expect(screen.queryByText(/reporte_publicado/i)).toBeNull();
    });

    it("oculta un toggle si su evento no vino en las preferencias (FR-005)", async () => {
        // Solo círculo; reporte.resuelto ausente → no debe renderizarse su frase.
        mockPreferencias([GRUPOS_PADRE[0]]);
        render(<PreferenciasNotificaciones rol="PARENT" correo="juan@correo.com" />);

        await waitFor(() =>
            expect(screen.getByText("Cuando alguien reporte a una persona de mi círculo")).toBeDefined()
        );
        expect(screen.queryByText("Cuando se resuelva un reporte que hice")).toBeNull();
    });

    it("para un rol NO-padre conserva la vista técnica por evento", async () => {
        mockPreferencias([GRUPOS_PADRE[2]]);
        render(<PreferenciasNotificaciones rol="ADMIN" correo="admin@correo.com" />);

        // La vista técnica formatea la clave del evento.
        await waitFor(() =>
            expect(screen.getByText(/Suscriptores › Reporte_publicado/)).toBeDefined()
        );
        // No muestra el encabezado de frases del padre.
        expect(screen.queryByText("¿Qué quieres que te avisemos?")).toBeNull();
    });
});

// SPEC-506 · CANDADO: la voz del CUERPO va por AUDIENCIA (§1.9), como el título
// por rol (TEMA_POR_ROL). Padre = «tú» (sin voseo) · colegio/profesional/admin/
// interno = «usted». Antes el cuerpo estaba fijo en «tú» y el componente estaba
// EXIMIDO del candado de voz (PENDIENTE_VOZ_MIXTA). Vigila CONDUCTA: inspecciona
// el texto REALMENTE renderizado por rol. Muere con el defecto — volver a «querés»
// (voseo) o poner «tu rol»/«tus preferencias» a un rol usted vuelve rojo.
function mockPreferenciasError() {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: false, json: async () => ({}) }) as Response)
    );
}

describe("PreferenciasNotificaciones · voz del cuerpo por audiencia (SPEC-506)", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("padre: el cuerpo tutea SIN voseo («quieres», nunca «querés»)", async () => {
        mockPreferencias(GRUPOS_PADRE);
        const { container } = render(<PreferenciasNotificaciones rol="PARENT" correo="juan@correo.com" />);
        await waitFor(() => expect(screen.getByText("¿Qué quieres que te avisemos?")).toBeDefined());
        expect(container.textContent).not.toMatch(/querés/i);
    });

    it("rol usted (colegio) sin config: el cuerpo trata de «usted» («su rol», no «tu rol»)", async () => {
        mockPreferencias([]);
        const { container } = render(<PreferenciasNotificaciones rol="SCHOOL_ADMIN" correo="rector@colegio.edu" />);
        await waitFor(() =>
            expect(screen.getByText("No hay notificaciones configurables para su rol.")).toBeDefined()
        );
        expect(container.textContent).not.toMatch(/para tu rol/i);
    });

    it("el error de carga adapta la voz: padre «tus», usted «sus»", async () => {
        mockPreferenciasError();
        const { unmount } = render(<PreferenciasNotificaciones rol="PARENT" correo="p@correo.com" />);
        await waitFor(() => expect(screen.getByText("No pudimos cargar tus preferencias")).toBeDefined());
        expect(screen.queryByText("No pudimos cargar sus preferencias")).toBeNull();
        unmount();

        mockPreferenciasError();
        render(<PreferenciasNotificaciones rol="SCHOOL_ADMIN" correo="r@colegio.edu" />);
        await waitFor(() => expect(screen.getByText("No pudimos cargar sus preferencias")).toBeDefined());
        expect(screen.queryByText("No pudimos cargar tus preferencias")).toBeNull();
    });
});
