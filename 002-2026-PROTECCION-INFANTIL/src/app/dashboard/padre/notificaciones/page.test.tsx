/**
 * SPEC-607 · la ruta vieja /dashboard/padre/notificaciones redirige (servidor)
 * a «Mi perfil» con ancla #notificaciones — los enlaces existentes no se rompen.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const redirectMock = vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));

import PadreNotificacionesRedirectPage from "./page";

describe("SPEC-607 · /dashboard/padre/notificaciones → /dashboard/padre/perfil#notificaciones", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        redirectMock.mockImplementation((url: string) => {
            throw new Error(`NEXT_REDIRECT:${url}`);
        });
    });

    it("redirect de servidor al acordeón «Notificaciones» de Mi perfil", () => {
        expect(() => PadreNotificacionesRedirectPage()).toThrow(
            "NEXT_REDIRECT:/dashboard/padre/perfil#notificaciones",
        );
        expect(redirectMock).toHaveBeenCalledWith("/dashboard/padre/perfil#notificaciones");
    });
});
