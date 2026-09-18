/**
 * CANDADO · SPEC-705 · «Ver la autorización» necesita el modo RELEER.
 *
 * La página de aceptación, cuando el profesional YA aceptó la versión vigente, REDIRIGE fuera
 * (no hay nada que aceptar) — salvo que venga con `?releer=1`, que abre el texto en SOLO LECTURA
 * (derecho a releer, legal §8). El enlace «Ver la autorización» de la ficha apuntaba SIN el
 * parámetro → la página lo rebotaba y «no mostraba nada». Este candado fija el CONTROL:
 *   · aceptado + `releer=1`  → NO redirige y pinta la pantalla en solo lectura.
 *   · aceptado + sin releer  → redirige (control: reproduce el bug si se quita el parámetro).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { redirectMock, cookiesGet, verifyTokenMock, versionVigenteMock, aceptacionVigenteMock, documentoMock, habMock } =
    vi.hoisted(() => ({
        redirectMock: vi.fn(),
        cookiesGet: vi.fn(() => ({ value: "tok" })),
        verifyTokenMock: vi.fn(async () => ({ sub: "u1" })),
        versionVigenteMock: vi.fn(async () => "v0.1"),
        aceptacionVigenteMock: vi.fn(),
        documentoMock: vi.fn(async () => "TEXTO LEGAL"),
        habMock: vi.fn(async () => ({ estado: "ACTIVO", habilitado: true })),
    }));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookiesGet }) }));
vi.mock("@/lib/auth", () => ({ verifyToken: verifyTokenMock }));
vi.mock("@/lib/profesionales/habilitacion", () => ({ obtenerHabilitacionProfesional: habMock }));
vi.mock("@/lib/dal/services/autorizacion-profesional", () => ({
    AutorizacionProfesionalService: class {
        versionVigente = versionVigenteMock;
        aceptacionVigente = aceptacionVigenteMock;
        obtenerDocumentoVigente = documentoMock;
    },
}));

import AutorizacionProfesionalPage from "./page";

const conParams = (releer?: string) =>
    AutorizacionProfesionalPage({ searchParams: Promise.resolve(releer ? { releer } : {}) });

describe("SPEC-705 · la pantalla de autorización respeta el modo releer", () => {
    beforeEach(() => {
        redirectMock.mockClear();
        // Por defecto: YA aceptó la versión vigente.
        aceptacionVigenteMock.mockResolvedValue({ version: "v0.1", aceptadoEn: new Date() });
    });

    it("aceptado + ?releer=1 → NO redirige y pinta en SOLO LECTURA", async () => {
        const el = (await conParams("1")) as { props: { soloLectura?: boolean } };
        expect(redirectMock).not.toHaveBeenCalled();
        expect(el.props.soloLectura).toBe(true);
    });

    it("CONTROL · aceptado SIN releer → redirige (el bug de «Ver la autorización» sin el parámetro)", async () => {
        await conParams(undefined);
        expect(redirectMock).toHaveBeenCalledWith("/dashboard/profesional/mi-perfil");
    });
});
