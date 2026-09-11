/**
 * SPEC-623 (I-376) · CANDADO DE CONDUCTA — la vista de éxito de «olvidé mi contraseña» es IDÉNTICA para
 * los tres casos, así no filtra enumeración de usuarios. jsdom, sin base.
 *
 * La brecha original: la API distinguía la cuenta solo-Google (`metodo`) pero la VISTA descartaba el
 * cuerpo y pintaba siempre el genérico, dejando al padre esperando un correo que nunca llega. Los
 * candados de SPEC-609 verificaron el endpoint; nadie afirmó qué VE la pantalla. Lección: cuando el
 * radicado termina en «el usuario ve X», el candado no puede vivir solo en el endpoint.
 *
 * El diseño (Diseño, D del 10-09): NO se personaliza por caso. Mostrar «tu cuenta es de Google»
 * confirmaría que ese correo tiene cuenta en la plataforma; en protección infantil, saber que un correo
 * está registrado puede delatar que un padre denunció. Un ÚNICO estado de éxito, ciego a
 * `metodo`/`message`/`emailSent`. Este candado exige que los casos rindan EXACTAMENTE la misma pantalla
 * — aserción binaria: si alguien re-personaliza por `metodo`, el HTML del caso Google difiere y MUERE.
 *
 * SPEC-647 (D-136): Google salió del producto — la vista de éxito ya no ofrece «Entrar con Google»
 * (eso vive ahora en el candado de conducta de SPEC-647). Lo que este candado preserva es la
 * INDISTINGUIBILIDAD: el mensaje genérico es idéntico para todo correo.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor, within } from "@testing-library/react";
import { RecuperarForm } from "./RecuperarForm";

const MENSAJE_GENERICO = "Si el email está registrado, recibirás un enlace para restablecer tu contraseña.";

function mockRespuesta(json: unknown) {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify(json), { status: 200, headers: { "content-type": "application/json" } })),
    );
}

/** Envía el formulario con la respuesta `json` y devuelve el contenedor de la vista de éxito. */
async function contenedorExito(json: unknown): Promise<HTMLElement> {
    mockRespuesta(json);
    const { container } = render(<RecuperarForm />);
    fireEvent.change(within(container).getByPlaceholderText(/tu@email/i), { target: { value: "padre@ejemplo.co" } });
    fireEvent.click(within(container).getByRole("button", { name: /enviar enlace/i }));
    await waitFor(() => expect(within(container).queryByTestId("recuperar-exito")).not.toBeNull());
    return within(container).getByTestId("recuperar-exito");
}

afterEach(() => vi.unstubAllGlobals());

describe("SPEC-623 · la vista de éxito de recuperar es idéntica para los tres casos (anti-enumeración)", () => {
    it("inexistente, clave-local y Google → EXACTAMENTE la misma pantalla (indistinguibles)", async () => {
        const inexistente = (await contenedorExito({ message: MENSAJE_GENERICO, emailSent: false })).outerHTML;
        vi.unstubAllGlobals();
        const claveLocal = (await contenedorExito({ message: MENSAJE_GENERICO, emailSent: true })).outerHTML;
        vi.unstubAllGlobals();
        const google = (
            await contenedorExito({ metodo: "google", message: "Tu cuenta no tiene contraseña: entra con Google, con el correo padre@ejemplo.co." })
        ).outerHTML;

        expect(inexistente, "debe ser el bloque de éxito, no vacío").toContain("recuperar-exito");
        expect(claveLocal, "clave-local indistinguible de inexistente").toBe(inexistente);
        expect(
            google,
            "Google debe ser indistinguible de los otros dos: personalizarlo confirmaría que el correo tiene cuenta (enumeración)",
        ).toBe(inexistente);
    });
});
