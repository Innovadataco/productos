/**
 * SPEC-564 (I-346) · CANDADO: /dashboard (panel del reportero) rebota a los roles
 * NO reporteros a SU área, nunca al error «No pudimos cargar tus reportes» (403 de
 * mis-reportes, que exige PARENT). El middleware no aplica el modelo de rol en
 * runtime, así que la guardia vive en la página. Muere si se quita el rebote, y el
 * secundario (camino/colegio/listo) muere si vuelve a `/dashboard` fijo.
 *
 * Integración (jsdom); no toca vitest.unit.includes.ts. Usa el homeParaRol REAL.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyAuth = vi.fn();
const redirect = vi.fn();
vi.mock("@/lib/auth", () => ({ verifyAuth: () => verifyAuth() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));
vi.mock("@/components/modules/DashboardUsuarioClient", () => ({ DashboardUsuarioClient: () => null }));
// listo/page deps (irrelevantes al rebote por rol, que ocurre antes)
vi.mock("@/lib/dal/services/camino/estado-colegio", () => ({ derivarPasoPendienteColegio: async () => null }));
vi.mock("@/lib/camino/pasos-colegio", () => ({ destinoDePasoColegio: () => "/camino/colegio" }));
vi.mock("next/link", () => ({ default: () => null }));

import DashboardPage from "./page";
import CaminoColegioListoPage from "@/app/camino/colegio/listo/page";

beforeEach(() => {
    verifyAuth.mockReset();
    redirect.mockReset();
});

describe("SPEC-564 · /dashboard rebota a los no-reporteros a su área", () => {
    it("OPERADOR → redirect a /dashboard/admin (su home), no al panel", async () => {
        verifyAuth.mockResolvedValue({ rol: "OPERADOR", id: "u1" });
        await DashboardPage();
        expect(redirect).toHaveBeenCalledWith("/dashboard/admin");
    });

    it("COMITE_VALIDACION → redirect a /dashboard/admin/comite", async () => {
        verifyAuth.mockResolvedValue({ rol: "COMITE_VALIDACION", id: "u1" });
        await DashboardPage();
        expect(redirect).toHaveBeenCalledWith("/dashboard/admin/comite");
    });

    it("PARENT → NO rebota (ve su panel)", async () => {
        verifyAuth.mockResolvedValue({ rol: "PARENT", id: "u1" });
        await DashboardPage();
        expect(redirect).not.toHaveBeenCalled();
    });
});

describe("SPEC-564 · secundario: camino/colegio/listo rebota a homeParaRol, no a /dashboard fijo", () => {
    it("un no-SCHOOL_ADMIN va a SU home, no a /dashboard", async () => {
        verifyAuth.mockResolvedValue({ rol: "OPERADOR", id: "u1" });
        await CaminoColegioListoPage();
        expect(redirect).toHaveBeenCalledWith("/dashboard/admin");
        expect(redirect).not.toHaveBeenCalledWith("/dashboard");
    });
});
