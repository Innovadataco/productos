/**
 * SPEC-599 · RegistroHijoWizard — wizard de alta de hijo aprobado sobre el
 * mockup `design/padre-hijos-registro-mockup.html`. Cubre: navegación de los
 * cuatro pasos, validación amable (nombre/apellidos bloquean; edad opcional),
 * preview vivo del círculo, simulador verde→ámbar, POST con el payload real de
 * SPEC-589 (sin documento) y el reset de «registrar a otro hijo».
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { RegistroHijoWizard } from "./RegistroHijoWizard";
import { anioDesdeEdad } from "@/lib/padre/documento-menor";

const fetchMock = vi.fn();
const onRegistrado = vi.fn(async () => {});

beforeEach(() => {
    fetchMock.mockReset();
    onRegistrado.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ hijoId: "h9" }) } as Response);
});

function renderWizard() {
    return render(
        <RegistroHijoWizard
            opcionesPlataforma={[
                { value: "", label: "Elige una plataforma" },
                { value: "p1", label: "Roblox" },
            ]}
            onRegistrado={onRegistrado}
        />,
    );
}

/** Llena nombre/apellidos y pasa del paso 2 al 3. */
function datosValidos() {
    fireEvent.change(screen.getByLabelText("Nombres"), { target: { value: "Sara Valentina" } });
    fireEvent.change(screen.getByLabelText("Apellidos"), { target: { value: "Fuentes Gómez" } });
    fireEvent.submit(screen.getByTestId("form-hijo"));
}

describe("SPEC-599 · RegistroHijoWizard", () => {
    it("arranca en la bienvenida y el CTA abre el paso de datos", () => {
        renderWizard();
        expect(screen.getByRole("heading", { name: /Registra a tu hijo/i })).toBeDefined();
        expect(screen.queryByTestId("form-hijo")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: /Registrar a mi hijo/i }));
        expect(screen.getByTestId("form-hijo")).toBeDefined();
        // el foco va al título del paso (anuncio del cambio)
        expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Cuéntanos de tu hijo" }));
    });

    it("el stepper permite volver a un paso visitado, no saltar adelante", () => {
        renderWizard();
        expect(screen.getByRole("button", { name: /Listo/ })).toHaveProperty("disabled", true);
        fireEvent.click(screen.getByRole("button", { name: /Registrar a mi hijo/i }));
        fireEvent.click(screen.getByRole("button", { name: /Bienvenida/ }));
        expect(screen.getByRole("heading", { name: /Registra a tu hijo/i })).toBeDefined();
    });

    it("bloquea con nombre/apellidos vacíos y nombra el campo", () => {
        renderWizard();
        fireEvent.click(screen.getByRole("button", { name: /Registrar a mi hijo/i }));
        fireEvent.submit(screen.getByTestId("form-hijo"));
        expect(screen.getByText("Escribe el nombre del menor.")).toBeDefined();
        expect(screen.getByText("Escribe los apellidos del menor.")).toBeDefined();
        // no avanza: sigue en el paso de datos
        expect(screen.getByTestId("form-hijo")).toBeDefined();
    });

    it("la edad es opcional: sin elegir chip se avanza igual", () => {
        renderWizard();
        fireEvent.click(screen.getByRole("button", { name: /Registrar a mi hijo/i }));
        datosValidos();
        expect(screen.getByRole("heading", { name: /Así queda Sara/i })).toBeDefined();
    });

    it("el preview del círculo refleja los datos en vivo (iniciales, nombre, detalle)", () => {
        renderWizard();
        fireEvent.click(screen.getByRole("button", { name: /Registrar a mi hijo/i }));
        const previa = screen.getByLabelText(/Vista previa de tu círculo de confianza/);

        expect(within(previa).getByText("Tu hijo aparecerá aquí")).toBeDefined();
        fireEvent.change(screen.getByLabelText("Nombres"), { target: { value: "Sara Valentina" } });
        fireEvent.change(screen.getByLabelText("Apellidos"), { target: { value: "Fuentes Gómez" } });
        expect(within(previa).getByText("Sara Valentina Fuentes Gómez")).toBeDefined();

        fireEvent.click(screen.getByRole("button", { name: "9 años" }));
        expect(screen.getByRole("button", { name: "9 años" }).getAttribute("aria-pressed")).toBe("true");
        expect(within(previa).getByText(/9 años · 0 cuentas protegidas/)).toBeDefined();
    });

    it("el chip de edad es conmutable: volver a pulsarlo lo desmarca", () => {
        renderWizard();
        fireEvent.click(screen.getByRole("button", { name: /Registrar a mi hijo/i }));
        const chip = screen.getByRole("button", { name: "9 años" });
        fireEvent.click(chip);
        expect(chip.getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(chip);
        expect(chip.getAttribute("aria-pressed")).toBe("false");
    });

    it("el simulador cambia el estado visual a ámbar (1 reporte en revisión)", () => {
        renderWizard();
        fireEvent.click(screen.getByRole("button", { name: /Registrar a mi hijo/i }));
        datosValidos();

        const simulador = screen.getByRole("switch");
        expect(simulador.getAttribute("aria-checked")).toBe("false");
        expect(screen.getByRole("status").textContent).toBe("Sin reportes");

        fireEvent.click(simulador);
        expect(simulador.getAttribute("aria-checked")).toBe("true");
        expect(screen.getByRole("status").textContent).toBe("1 reporte en revisión");
    });

    it("confirmar hace POST con el payload de SPEC-589 (sin documento, edad derivada) y confirma", async () => {
        renderWizard();
        fireEvent.click(screen.getByRole("button", { name: /Registrar a mi hijo/i }));
        fireEvent.click(screen.getByRole("button", { name: "9 años" }));
        datosValidos();

        fireEvent.click(screen.getByRole("button", { name: /Confirmar registro/i }));

        await waitFor(() => {
            const post = fetchMock.mock.calls.find((c) => c[1]?.method === "POST" && c[0] === "/api/padre/hijos");
            expect(post).toBeDefined();
            const body = JSON.parse(String(post![1].body)) as Record<string, unknown>;
            expect(body.nombre).toBe("Sara Valentina");
            expect(body.apellidos).toBe("Fuentes Gómez");
            expect(body.anioNacimiento).toBe(anioDesdeEdad(9));
            expect(body).not.toHaveProperty("documentoTipo");
            expect(body).not.toHaveProperty("documentoNumero");
        });
        await waitFor(() => expect(onRegistrado).toHaveBeenCalled());
        expect(screen.getByRole("heading", { name: /Ya estás cuidando a Sara/i })).toBeDefined();
    });

    it("el alta manda TODOS los identificadores cargados, con y sin plataforma", async () => {
        renderWizard();
        fireEvent.click(screen.getByRole("button", { name: /Registrar a mi hijo/i }));
        fireEvent.change(screen.getByLabelText("Nombres"), { target: { value: "Sara" } });
        fireEvent.change(screen.getByLabelText("Apellidos"), { target: { value: "Fuentes" } });

        fireEvent.change(screen.getByLabelText("Cuenta"), { target: { value: "saragamer" } });
        fireEvent.change(screen.getByLabelText("Plataforma"), { target: { value: "p1" } });
        fireEvent.click(screen.getByRole("button", { name: "Agregar otro" }));
        await waitFor(() => expect(screen.getByTestId("identificadores-nuevos")).toBeDefined());

        // escrito pero no «agregado»: entra igual al confirmar
        fireEvent.change(screen.getByLabelText("Cuenta"), { target: { value: "+573001112233" } });
        fireEvent.submit(screen.getByTestId("form-hijo"));
        fireEvent.click(screen.getByRole("button", { name: /Confirmar registro/i }));

        await waitFor(() => {
            const post = fetchMock.mock.calls.find((c) => c[1]?.method === "POST");
            const body = JSON.parse(String(post![1].body)) as { identificadores: unknown[] };
            expect(body.identificadores).toEqual([{ valor: "saragamer", plataformaId: "p1" }, { valor: "+573001112233" }]);
        });
    });

    it("un error del servidor se muestra y vuelve al paso de datos", async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            json: () => Promise.resolve({ error: { message: "Alcanzaste el máximo de menores activos." } }),
        } as Response);
        renderWizard();
        fireEvent.click(screen.getByRole("button", { name: /Registrar a mi hijo/i }));
        datosValidos();
        fireEvent.click(screen.getByRole("button", { name: /Confirmar registro/i }));

        await waitFor(() => expect(screen.getByTestId("wizard-error").textContent).toContain("máximo de menores"));
        expect(screen.getByTestId("form-hijo")).toBeDefined();
    });

    it("«Registrar a otro hijo» resetea el wizard al paso de datos", async () => {
        renderWizard();
        fireEvent.click(screen.getByRole("button", { name: /Registrar a mi hijo/i }));
        datosValidos();
        fireEvent.click(screen.getByRole("button", { name: /Confirmar registro/i }));
        await screen.findByRole("heading", { name: /Ya estás cuidando a Sara/i });

        fireEvent.click(screen.getByRole("button", { name: /Registrar a otro hijo/i }));
        expect(screen.getByTestId("form-hijo")).toBeDefined();
        expect((screen.getByLabelText("Nombres") as HTMLInputElement).value).toBe("");
        expect(screen.queryByText("Sara Valentina")).toBeNull();
    });
});
