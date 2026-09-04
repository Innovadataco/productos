/**
 * SPEC-440 P5 (Jelkin vivo 04-09) · «que no le vuelva a pedir la presentación
 * en cada ingreso».
 *
 * Verifica la CONDUCTA del formulario:
 *   · Prellena desde `/api/padre/perfil` cuando sessionStorage está vacío.
 *   · El borrador de sessionStorage GANA sobre el perfil (es lo más fresco).
 *   · Al enviar, hace PATCH al perfil con presentación + urgencia (fire-and-forget).
 *   · Si el PATCH falla, la navegación sigue igual (no bloquea).
 *
 * Candado por CONDUCTA: si mañana alguien retira el fetch al perfil o el
 * PATCH al enviar, los tests mueren. Verificado por mutación:
 *   · Comentar la rama de perfil → cae «prellena desde perfil».
 *   · Comentar el `fetch("/api/padre/perfil", { method: "PATCH", ... })` →
 *     cae «guarda al perfil al enviar».
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { PresentacionUrgenciaForm } from "./PresentacionUrgenciaForm";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

vi.mock("@/components/modules/CanalesOficiales", () => ({
    CanalesOficiales: () => <div data-testid="canales" />,
}));

// Silenciar el helper sessionStorage salvo cuando el test lo necesita.
const leerBorradorMock = vi.fn();
const guardarBorradorMock = vi.fn();
vi.mock("@/lib/padre/borrador-consulta", () => ({
    leerBorradorConsulta: () => leerBorradorMock(),
    guardarBorradorConsulta: (v: unknown) => guardarBorradorMock(v),
    borrarBorradorConsulta: vi.fn(),
}));

// `vi.spyOn(globalThis, "fetch")` no calza en `MockInstance<...unknown[]...>`.
// Guardamos el spy en `unknown` y hacemos casts locales cuando accedemos a
// `mock.calls` para operarlo con la firma real de `fetch`.
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
    pushMock.mockReset();
    leerBorradorMock.mockReset();
    guardarBorradorMock.mockReset();
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("SPEC-440 P5 · PresentacionUrgenciaForm persiste en perfil", () => {
    it("prellena desde /api/padre/perfil cuando sessionStorage está vacío", async () => {
        leerBorradorMock.mockReturnValue(null);
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
            perfil: {
                presentacionEstandar: "Soy mamá de dos niños y estamos buscando apoyo.",
                urgenciaEstandar: "ESTA_SEMANA",
            },
        }), { status: 200, headers: { "Content-Type": "application/json" } }));

        render(<PresentacionUrgenciaForm hrefDirectorio="/dashboard/padre/profesionales/directorio" />);

        await waitFor(() => {
            const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
            expect(textarea.value).toBe("Soy mamá de dos niños y estamos buscando apoyo.");
        });
        const radioEstaSemana = screen.getByRole("radio", { name: /Esta semana/i }) as HTMLInputElement;
        expect(radioEstaSemana.checked).toBe(true);
    });

    it("el borrador de sessionStorage GANA sobre el perfil (no llama a /api/padre/perfil)", async () => {
        leerBorradorMock.mockReturnValue({
            presentacion: "Borrador fresco del padre",
            urgencia: "SIN_APURO",
        });

        render(<PresentacionUrgenciaForm hrefDirectorio="/dashboard/padre/profesionales/directorio" />);

        await waitFor(() => {
            const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
            expect(textarea.value).toBe("Borrador fresco del padre");
        });
        // Contraprueba: ningún fetch al perfil.
        expect(fetchSpy).not.toHaveBeenCalledWith("/api/padre/perfil", expect.anything());
    });

    it("al enviar, hace PATCH a /api/padre/perfil con presentación + urgencia", async () => {
        leerBorradorMock.mockReturnValue(null);
        // 1er fetch: GET perfil vacío. 2do: PATCH al enviar.
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ perfil: {} }), { status: 200 }));
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ perfil: {} }), { status: 200 }));

        render(<PresentacionUrgenciaForm hrefDirectorio="/dashboard/padre/profesionales/directorio" />);

        const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: "Necesitamos hablar con alguien de confianza" } });
        fireEvent.click(screen.getByRole("radio", { name: /Esta semana/i }));
        fireEvent.click(screen.getByRole("button", { name: /Ver profesionales verificados/i }));

        await waitFor(() => {
            // El PATCH quedó registrado con el body correcto.
            const patch = fetchSpy.mock.calls.find(([url, init]) =>
                url === "/api/padre/perfil"
                && typeof init === "object"
                && init !== null
                && (init as RequestInit).method === "PATCH"
            );
            expect(patch, "no se registró un PATCH a /api/padre/perfil al enviar el form").toBeDefined();
            const body = JSON.parse(((patch![1] as RequestInit).body as string) ?? "{}");
            expect(body.presentacionEstandar).toBe("Necesitamos hablar con alguien de confianza");
            expect(body.urgenciaEstandar).toBe("ESTA_SEMANA");
        });
        // La navegación no depende del PATCH — fire-and-forget.
        expect(pushMock).toHaveBeenCalledWith("/dashboard/padre/profesionales/directorio");
    });

    it("si el PATCH al perfil falla, la navegación sigue igual (no bloquea)", async () => {
        leerBorradorMock.mockReturnValue({ presentacion: "Ya listo para enviar", urgencia: "SIN_APURO" });
        fetchSpy.mockRejectedValue(new Error("network fail"));

        render(<PresentacionUrgenciaForm hrefDirectorio="/dashboard/padre/profesionales/directorio" />);

        // El borrador prellena → botón habilitado. Enviamos.
        await waitFor(() => {
            expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Ya listo para enviar");
        });
        fireEvent.click(screen.getByRole("button", { name: /Ver profesionales verificados/i }));
        await waitFor(() => {
            expect(pushMock).toHaveBeenCalledWith("/dashboard/padre/profesionales/directorio");
        });
    });
});
