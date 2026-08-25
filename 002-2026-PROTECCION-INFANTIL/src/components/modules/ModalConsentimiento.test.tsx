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

function renderModal() {
    return render(
        <ModalConsentimiento
            rol="PARENT"
            documentoTipo="POLITICA_DATOS"
            documentoContenido="Línea 1\nLínea 2\nLínea 3"
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
