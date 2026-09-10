/**
 * SPEC-606 — el texto sensible se revela con el código de 6 dígitos del correo.
 *
 * Flujo cubierto: 403 STEP_UP_REQUERIDO → la pieza pide el código sola →
 * panel con correo enmascarado + 6 casillas + vigencia 10:00 + reenvío con
 * cooldown → verificar → texto con anillo de cuenta regresiva → retapado solo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TextoSensible } from "./TextoSensible";

const TEXTO = "Le pidió fotos y le dijo que no le contara a nadie.";

function respuesta(status: number, body?: unknown): Response {
    return {
        status,
        ok: status >= 200 && status < 300,
        json: async () => body,
        headers: new Headers(),
    } as unknown as Response;
}

describe("TextoSensible (SPEC-606)", () => {
    let verificado: boolean;
    let respuestaVerificar: () => Response;
    let llamadasCodigo: number;
    let cooldownInicial: number;

    beforeEach(() => {
        verificado = false;
        llamadasCodigo = 0;
        cooldownInicial = 60;
        respuestaVerificar = () => {
            verificado = true;
            return respuesta(204);
        };
        vi.stubGlobal(
            "fetch",
            vi.fn(async (url: string, init?: RequestInit) => {
                if (url.includes("/api/padre/reportes/") && url.endsWith("/texto")) {
                    return verificado
                        ? respuesta(200, { texto: TEXTO })
                        : respuesta(403, { error: { code: "STEP_UP_REQUERIDO", metodos: ["codigo_email"] } });
                }
                if (url.includes("/api/padre/step-up/codigo")) {
                    llamadasCodigo++;
                    return respuesta(200, {
                        enviado: true,
                        vigenciaMinutos: 10,
                        cooldownSegundos: llamadasCodigo === 1 ? cooldownInicial : 60,
                        correoEnmascarado: "j•••••@gmail.com",
                    });
                }
                if (url.includes("/api/padre/step-up/verificar")) {
                    return respuestaVerificar();
                }
                throw new Error(`fetch no esperado: ${url} ${init?.method ?? "GET"}`);
            })
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    async function abrirPanelCodigo(retapadoMinutos = 10) {
        render(<TextoSensible reporteId="r1" retapadoMinutos={retapadoMinutos} />);
        fireEvent.click(screen.getByRole("button", { name: /Revelar texto/ }));
        await waitFor(() => expect(screen.getByText("Te enviamos un código")).toBeTruthy());
    }

    function escribirCodigo(codigo: string) {
        for (let i = 0; i < 6; i++) {
            fireEvent.change(screen.getByLabelText(`Dígito ${i + 1} de 6`), { target: { value: codigo.charAt(i) } });
        }
    }

    it("tras el 403 pide el código sola: correo enmascarado, 6 casillas, vigencia 10:00 y reenvío con cooldown", async () => {
        await abrirPanelCodigo();

        // El correo sale enmascarado (j•••••@gmail.com), nunca completo.
        expect(screen.getByText("j•••••@gmail.com")).toBeTruthy();
        expect(screen.queryByText(/julio\.padre@gmail\.com/)).toBeNull();

        // Las 6 casillas y la vigencia visible.
        for (let i = 1; i <= 6; i++) expect(screen.getByLabelText(`Dígito ${i} de 6`)).toBeTruthy();
        expect(screen.getByRole("timer").textContent).toMatch(/^10:00|9:59$/);

        // Confirmar nace deshabilitado (faltan dígitos) y el reenvío con cooldown.
        expect((screen.getByRole("button", { name: "Confirmar" }) as HTMLButtonElement).disabled).toBe(true);
        const reenviar = screen.getByRole("button", { name: /Reenviar código/ }) as HTMLButtonElement;
        expect(reenviar.disabled).toBe(true);
        expect(reenviar.textContent).toContain("60 s");

        // El código se pidió UNA sola vez (automático tras el 403).
        expect(llamadasCodigo).toBe(1);
    });

    it("verifica el código y revela el texto con el anillo de cuenta regresiva", async () => {
        await abrirPanelCodigo();
        escribirCodigo("731904");

        const confirmar = screen.getByRole("button", { name: "Confirmar" }) as HTMLButtonElement;
        expect(confirmar.disabled).toBe(false);
        fireEvent.click(confirmar);

        await waitFor(() => expect(screen.getByText(TEXTO)).toBeTruthy());
        // Anillo con la cuenta regresiva del retapado (10 min por defecto).
        expect(screen.getByRole("timer").textContent).toMatch(/^10:00|9:59$/);
        expect(screen.getByText(/Cada revelado queda auditado/)).toBeTruthy();
        expect(screen.getByRole("button", { name: "Ocultar" })).toBeTruthy();
    });

    it("código incorrecto: muestra el error del servidor y limpia las casillas", async () => {
        respuestaVerificar = () =>
            respuesta(401, { error: { message: "Código incorrecto. Te quedan 4 intentos.", code: "AUTH_INVALID" } });
        await abrirPanelCodigo();
        escribirCodigo("000000");
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

        await waitFor(() => expect(screen.getByText(/Te quedan 4 intentos/)).toBeTruthy());
        for (let i = 1; i <= 6; i++) {
            expect((screen.getByLabelText(`Dígito ${i} de 6`) as HTMLInputElement).value).toBe("");
        }
        // El texto sigue sin aparecer.
        expect(screen.queryByText(TEXTO)).toBeNull();
    });

    it("el reenvío se habilita al terminar el cooldown y pide otro código", async () => {
        cooldownInicial = 1; // el primer envío nace con cooldown de 1 s
        await abrirPanelCodigo();
        expect(llamadasCodigo).toBe(1);
        expect((screen.getByRole("button", { name: /Reenviar código/ }) as HTMLButtonElement).disabled).toBe(true);

        // Pasado ~1 s el botón despierta solo y el reenvío dispara otro envío.
        await waitFor(
            () => {
                const reenviar = screen.getByRole("button", { name: "Reenviar código" }) as HTMLButtonElement;
                expect(reenviar.disabled).toBe(false);
            },
            { timeout: 4000 }
        );
        fireEvent.click(screen.getByRole("button", { name: "Reenviar código" }));
        await waitFor(() => expect(llamadasCodigo).toBe(2));
    });

    it("cancelar devuelve al estado tapado sin pedir el texto", async () => {
        await abrirPanelCodigo();
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(screen.getByRole("button", { name: /Revelar texto/ })).toBeTruthy();
        expect(screen.queryByText(TEXTO)).toBeNull();
    });

    it("el texto revelado se vuelve a tapar solo al cumplirse el retapado", async () => {
        await abrirPanelCodigo(0.02); // 0.02 min ≈ 1.2 s de retapado
        escribirCodigo("123456");
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        await waitFor(() => expect(screen.getByText(TEXTO)).toBeTruthy());

        // Cumplido el plazo, el texto se oculta solo y vuelve el botón de revelar.
        await waitFor(() => expect(screen.queryByText(TEXTO)).toBeNull(), { timeout: 5000 });
        expect(screen.getByRole("button", { name: /Revelar texto/ })).toBeTruthy();
    });
});
