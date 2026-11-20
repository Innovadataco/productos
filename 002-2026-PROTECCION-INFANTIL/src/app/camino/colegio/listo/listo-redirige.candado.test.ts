/**
 * SPEC-962 · CANDADO (#5): /camino/colegio/listo ya NO tiene pantalla ni envía
 * nada — redirige server-side, conservando la guardia de rol y de paso pendiente.
 *
 *  - rol != SCHOOL_ADMIN → su propia home (no sirve el panel del colegio);
 *  - paso pendiente → ese paso (no al panel), SIN encolar;
 *  - camino completo → /dashboard/colegio, SIN encolar.
 *
 * «No encola» se vigila por CONDUCTA: se espían `programar` y la bienvenida del
 * rector; si alguien re-cableara un envío en esta ruta (el GET-con-efecto que
 * SPEC-962 prohíbe), el spy lo caza. Muere con el defecto: cambiar el destino del
 * cierre o reintroducir el envío pone rojo el caso.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyAuthMock = vi.fn();
const derivarMock = vi.fn();
const homeParaRolMock = vi.fn((..._a: unknown[]) => "/home-rol");
const programarMock = vi.fn();
const bienvenidaMock = vi.fn();
const redirectMock = vi.fn((p: string) => {
    // Emula next/navigation.redirect: corta la ejecución lanzando (como en Next).
    throw new Error(`NEXT_REDIRECT:${p}`);
});

vi.mock("next/navigation", () => ({ redirect: (p: string) => redirectMock(p) }));
vi.mock("@/lib/auth", () => ({ verifyAuth: (...a: unknown[]) => verifyAuthMock(...a) }));
vi.mock("@/lib/auth/home-para-rol", () => ({ homeParaRol: (...a: unknown[]) => homeParaRolMock(...a) }));
vi.mock("@/lib/dal/services/camino/estado-colegio", () => ({
    derivarPasoPendienteColegio: (...a: unknown[]) => derivarMock(...a),
}));
// Vigilancia de «no encola»: la ruta NO debe tocar el motor ni la bienvenida.
vi.mock("@/lib/notificaciones", () => ({ programar: (...a: unknown[]) => programarMock(...a) }));
vi.mock("@/lib/email-colegio", () => ({ enviarBienvenidaRectorFusionada: (...a: unknown[]) => bienvenidaMock(...a) }));

import CaminoColegioListoPage from "./page";

async function correr(): Promise<string> {
    try {
        await CaminoColegioListoPage();
        throw new Error("la página no redirigió");
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const m = msg.match(/^NEXT_REDIRECT:(.+)$/);
        if (m) return m[1] as string;
        throw e;
    }
}

describe("SPEC-962 · /camino/colegio/listo redirige y NO encola", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        homeParaRolMock.mockReturnValue("/home-rol");
    });

    it("camino completo → /dashboard/colegio, sin encolar", async () => {
        verifyAuthMock.mockResolvedValue({ id: "u1", rol: "SCHOOL_ADMIN" });
        derivarMock.mockResolvedValue(null);

        expect(await correr()).toBe("/dashboard/colegio");
        expect(programarMock).not.toHaveBeenCalled();
        expect(bienvenidaMock).not.toHaveBeenCalled();
    });

    it("paso pendiente → a ese paso (no al panel), sin encolar", async () => {
        verifyAuthMock.mockResolvedValue({ id: "u1", rol: "SCHOOL_ADMIN" });
        derivarMock.mockResolvedValue("profesores");

        expect(await correr()).toBe("/camino/colegio/profesores");
        expect(programarMock).not.toHaveBeenCalled();
        expect(bienvenidaMock).not.toHaveBeenCalled();
    });

    it("rol no SCHOOL_ADMIN → su home, sin derivar pasos ni encolar", async () => {
        verifyAuthMock.mockResolvedValue({ id: "p1", rol: "PARENT" });
        homeParaRolMock.mockReturnValue("/dashboard/padre");

        expect(await correr()).toBe("/dashboard/padre");
        expect(derivarMock).not.toHaveBeenCalled();
        expect(programarMock).not.toHaveBeenCalled();
        expect(bienvenidaMock).not.toHaveBeenCalled();
    });
});
