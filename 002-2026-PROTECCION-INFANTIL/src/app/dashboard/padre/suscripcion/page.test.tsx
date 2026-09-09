/**
 * SPEC-607 · la ruta vieja /dashboard/padre/suscripcion redirige (servidor) a
 * «Mi perfil» con ancla #suscripcion — los enlaces existentes (guardián de
 * vigencia, EsperandoAutorizacion, correos) no se rompen. `?bienvenida=1`
 * se conserva porque `SuscripcionVista` lo usa para el saludo post-autorización.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const redirectMock = vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));

import PadreSuscripcionRedirectPage from "./page";

describe("SPEC-607 · /dashboard/padre/suscripcion → /dashboard/padre/perfil#suscripcion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        redirectMock.mockImplementation((url: string) => {
            throw new Error(`NEXT_REDIRECT:${url}`);
        });
    });

    it("sin parámetros: redirect de servidor al acordeón «Suscripción»", async () => {
        await expect(
            PadreSuscripcionRedirectPage({ searchParams: Promise.resolve({}) }),
        ).rejects.toThrow("NEXT_REDIRECT:/dashboard/padre/perfil#suscripcion");
        expect(redirectMock).toHaveBeenCalledWith("/dashboard/padre/perfil#suscripcion");
    });

    it("conserva ?bienvenida=1 (saludo post-autorización del pago)", async () => {
        await expect(
            PadreSuscripcionRedirectPage({ searchParams: Promise.resolve({ bienvenida: "1" }) }),
        ).rejects.toThrow("NEXT_REDIRECT:/dashboard/padre/perfil?bienvenida=1#suscripcion");
    });

    it("ignora otros valores de bienvenida", async () => {
        await expect(
            PadreSuscripcionRedirectPage({ searchParams: Promise.resolve({ bienvenida: "0" }) }),
        ).rejects.toThrow("NEXT_REDIRECT:/dashboard/padre/perfil#suscripcion");
    });
});
