import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ModalConsentimiento } from "./ModalConsentimiento";

const push = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push }),
}));

type ObserverInstance = {
    trigger: (isIntersecting: boolean) => void;
};

let currentObserver: ObserverInstance | null = null;

function setupIntersectionObserverMock() {
    vi.stubGlobal(
        "IntersectionObserver",
        vi.fn((callback: IntersectionObserverCallback) => {
            const instance: ObserverInstance = {
                trigger: (isIntersecting: boolean) => {
                    callback(
                        [{ isIntersecting, target: document.createElement("div") } as unknown as IntersectionObserverEntry],
                        {} as IntersectionObserver
                    );
                },
            };
            currentObserver = instance;
            return {
                observe: vi.fn(),
                disconnect: vi.fn(),
                unobserve: vi.fn(),
            };
        })
    );
}

function mockFetch(response: unknown, ok = true) {
    return vi.spyOn(global, "fetch").mockResolvedValue({
        ok,
        json: async () => response,
    } as Response);
}

function renderModal(documentoContenido = "Línea 1\nLínea 2\nLínea 3") {
    return render(
        <ModalConsentimiento
            rol="PARENT"
            documentoTipo="POLITICA_DATOS"
            documentoContenido={documentoContenido}
            redirectUrl="/dashboard/padre/suscripcion"
        />
    );
}

function getBoton() {
    return screen.getByTestId("btn-aceptar") as HTMLButtonElement;
}

describe("ModalConsentimiento (SPEC-241)", () => {
    beforeEach(() => {
        setupIntersectionObserverMock();
        push.mockClear();
        currentObserver = null;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("deshabilita el botón Acepto inicialmente", () => {
        renderModal();
        expect(getBoton().disabled).toBe(true);
    });

    it("sigue deshabilitado si solo se hace scroll pero no se marcan checks", async () => {
        renderModal();
        currentObserver?.trigger(true);

        await waitFor(() => {
            expect(getBoton().disabled).toBe(true);
        });
    });

    it("habilita Acepto tras scroll completo y ambos checks", async () => {
        renderModal();
        currentObserver?.trigger(true);

        fireEvent.click(screen.getByTestId("check-representante"));
        fireEvent.click(screen.getByTestId("check-politica"));

        await waitFor(() => {
            expect(getBoton().disabled).toBe(false);
        });
    });

    it("envía POST a /api/consentimiento/aceptar y redirige al dashboard", async () => {
        const fetchMock = mockFetch({ ok: true, version: "v0.4" });

        renderModal();
        currentObserver?.trigger(true);

        fireEvent.click(screen.getByTestId("check-representante"));
        fireEvent.click(screen.getByTestId("check-politica"));

        await waitFor(() => expect(getBoton().disabled).toBe(false));
        fireEvent.click(getBoton());

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                "/api/consentimiento/aceptar",
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify({ documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: true }),
                })
            );
        });

        await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/padre/suscripcion"));
    });

    it("muestra error si el endpoint falla", async () => {
        mockFetch({ error: { message: "Error del servidor" } }, false);

        renderModal();
        currentObserver?.trigger(true);

        fireEvent.click(screen.getByTestId("check-representante"));
        fireEvent.click(screen.getByTestId("check-politica"));

        await waitFor(() => expect(getBoton().disabled).toBe(false));
        fireEvent.click(getBoton());

        await waitFor(() => expect(screen.getByText("Error del servidor")).toBeDefined());
    });
});

describe("ModalConsentimiento · render markdown (SPEC-343)", () => {
    beforeEach(() => {
        setupIntersectionObserverMock();
        push.mockClear();
        currentObserver = null;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("renderiza encabezados como elementos de título, no como texto con #", () => {
        const { container } = renderModal("## Marco legal\n\nTexto del documento.");
        const h2 = container.querySelector("h2");
        expect(h2?.textContent).toBe("Marco legal");
        expect(container.textContent).not.toContain("## Marco legal");
    });

    it("renderiza negritas como <strong>, no como texto con asteriscos", () => {
        const { container } = renderModal("Datos de **INNOVADATACO S.A.S.** aquí.");
        const strong = container.querySelector("strong");
        expect(strong?.textContent).toBe("INNOVADATACO S.A.S.");
        expect(container.textContent).not.toContain("**");
    });

    it("renderiza tablas GFM como <table> dentro de un contenedor con scroll propio", () => {
        const { container } = renderModal(
            "| Dato | Período |\n|---|---|\n| Cuentas | 2 años |"
        );
        const tabla = container.querySelector("table");
        expect(tabla).not.toBeNull();
        expect(tabla?.parentElement?.className).toContain("overflow-x-auto");
        expect(container.querySelector("td")?.textContent).toBe("Cuentas");
        expect(container.textContent).not.toContain("|---|");
    });

    it("no interpreta ni ejecuta HTML embebido en el documento", () => {
        const { container } = renderModal(
            "Texto seguro.\n\n<script>alert(1)</script>\n\nTexto <b>enfatizado</b> final."
        );
        expect(container.querySelector("script")).toBeNull();
        expect(container.querySelector("b")).toBeNull();
        expect(container.textContent).toContain("Texto seguro.");
    });

    it("renderiza degradado un documento con tabla malformada sin lanzar error", () => {
        const { container } = renderModal("| celda sin cierre\n|--- roto\ntexto suelto");
        expect(container.textContent).toContain("texto suelto");
    });

    it("mantiene el candado de scroll-final con contenido markdown", async () => {
        renderModal("## Documento\n\nContenido largo del documento legal.");
        fireEvent.click(screen.getByTestId("check-representante"));
        fireEvent.click(screen.getByTestId("check-politica"));
        expect(getBoton().disabled).toBe(true);

        currentObserver?.trigger(true);
        await waitFor(() => {
            expect(getBoton().disabled).toBe(false);
        });
    });
});

// ────────────────────────────────────────────────────────────────────────────
// SPEC-358 (A-70 · B3): la puerta de entrada no depende del IntersectionObserver
//
// En el recorrido de Jelkin (prod `e137caab`) el botón "Acepto" quedó
// deshabilitado con el documento leído hasta el final y las dos casillas
// marcadas — el observer nunca reportó intersección y el usuario quedó trabado
// en la primera pantalla del producto. Estos tests corren con un observer que
// NO dispara nunca, que es justo lo que la suite anterior no podía ver: su mock
// siempre disparaba.
// ────────────────────────────────────────────────────────────────────────────
describe("ModalConsentimiento · el gate no depende del observer (SPEC-358 · B3)", () => {
    /** Observer que jamás reporta intersección: el escenario de Jelkin. */
    function observerMudo() {
        vi.stubGlobal(
            "IntersectionObserver",
            vi.fn(() => ({ observe: vi.fn(), disconnect: vi.fn(), unobserve: vi.fn() })),
        );
    }

    /** jsdom no calcula layout: se fijan las medidas del contenedor a mano. */
    function medirContenedor(el: HTMLElement, opts: { scrollHeight: number; clientHeight: number }) {
        Object.defineProperty(el, "scrollHeight", { value: opts.scrollHeight, configurable: true });
        Object.defineProperty(el, "clientHeight", { value: opts.clientHeight, configurable: true });
    }

    beforeEach(() => {
        observerMudo();
        push.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("con el observer mudo, llegar al final del documento habilita Acepto", async () => {
        renderModal();
        const cont = screen.getByTestId("documento-scroll");
        medirContenedor(cont, { scrollHeight: 1000, clientHeight: 300 });

        fireEvent.click(screen.getByTestId("check-representante"));
        fireEvent.click(screen.getByTestId("check-politica"));
        // Aún arriba del documento: el botón espera.
        cont.scrollTop = 0;
        fireEvent.scroll(cont);
        await waitFor(() => expect(getBoton().disabled).toBe(true));

        // Hasta el fondo: se habilita sin que ningún observer dispare.
        cont.scrollTop = 700;
        fireEvent.scroll(cont);
        await waitFor(() => expect(getBoton().disabled).toBe(false));
    });

    it("documento que no desborda: no hay nada que bajar, no se traba", async () => {
        renderModal("Documento corto.");
        const cont = screen.getByTestId("documento-scroll");
        medirContenedor(cont, { scrollHeight: 200, clientHeight: 400 });
        fireEvent.scroll(cont);

        fireEvent.click(screen.getByTestId("check-representante"));
        fireEvent.click(screen.getByTestId("check-politica"));

        await waitFor(() => expect(getBoton().disabled).toBe(false));
    });

    it("scroll casi al final (subpíxeles del navegador) también cuenta como leído", async () => {
        renderModal();
        const cont = screen.getByTestId("documento-scroll");
        medirContenedor(cont, { scrollHeight: 1000, clientHeight: 300 });

        fireEvent.click(screen.getByTestId("check-representante"));
        fireEvent.click(screen.getByTestId("check-politica"));
        cont.scrollTop = 690; // 690 + 300 = 990, a 10 px del final
        fireEvent.scroll(cont);

        await waitFor(() => expect(getBoton().disabled).toBe(false));
    });
});
