/**
 * SPEC-721 · CANDADO DE PANTALLA — no existe camino por el FORMULARIO para que
 * nazca una cuenta de menor SIN plataforma. Sin la red, `ruby1` en Discord y
 * `ruby1` en Roblox son cuentas distintas y un reporte sobre una no dice nada de
 * la otra (I-429): una cuenta sin red no se puede vigilar. Por eso la pantalla la
 * exige antes de crear la fila.
 *
 * Es la contraparte de pantalla del candado de la API (Datos ·
 * `src/app/api/padre/hijos/plataforma-obligatoria.candado.test.ts`): la API es el
 * respaldo; la pantalla impide llegar a él. Cubre las DOS puertas del padre:
 *   (1) alta de un hijo con cuentas (FormularioAltaHijo)
 *   (2) agregar una cuenta a un hijo existente (HijoCard)
 *
 * Verificado por MUTACIÓN (control positivo):
 *   · quitar «|| !…plataformaId» de la condición `disabled` del botón habilita
 *     agregar sin red → cae la aserción de botón inactivo;
 *   · quitar el guardia del submit del alta hace que la cuenta suelta se ENVÍE →
 *     cae la aserción de «sin red no sale».
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { FormularioAltaHijo } from "./FormularioAltaHijo";
import { HijoCard, type Hijo } from "./HijoCard";

// La pantalla ofrece la red con un placeholder vacío + las redes del catálogo:
// el value "" es SOLO el estado inicial, ya no habilita registrar «suelto».
const OPCIONES = [
    { value: "", label: "Elige la red o app" },
    { value: "p1", label: "Roblox" },
];

const boton = (nombre: string) => screen.getByRole("button", { name: nombre }) as HTMLButtonElement;

describe("SPEC-721 · la pantalla exige la plataforma (sin red la cuenta no nace)", () => {
    describe("puerta 1 · alta de hijo con cuentas (FormularioAltaHijo)", () => {
        const onRegistrado = vi.fn();
        const fetchMock = vi.fn();
        beforeEach(() => {
            onRegistrado.mockReset();
            fetchMock.mockReset();
            fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ hijoId: "h1" }) } as Response);
            vi.stubGlobal("fetch", fetchMock);
        });

        it("«Agregar otro» está inactivo sin plataforma y se activa al elegir la red", () => {
            render(<FormularioAltaHijo opcionesPlataforma={OPCIONES} onRegistrado={onRegistrado} />);
            // solo el valor, sin red → inactivo (control positivo: mutar la condición lo activa)
            fireEvent.change(screen.getByLabelText("Cuenta"), { target: { value: "anaroblox" } });
            expect(boton("Agregar otro").disabled).toBe(true);
            // + la red → activo
            fireEvent.change(screen.getByLabelText("Plataforma"), { target: { value: "p1" } });
            expect(boton("Agregar otro").disabled).toBe(false);
        });

        it("al registrar, una cuenta escrita SIN red no se envía: se pide la red", () => {
            render(<FormularioAltaHijo opcionesPlataforma={OPCIONES} onRegistrado={onRegistrado} />);
            fireEvent.change(screen.getByLabelText("Nombres"), { target: { value: "Ana" } });
            fireEvent.change(screen.getByLabelText("Apellidos"), { target: { value: "Ruiz" } });
            // valor escrito pero sin elegir plataforma, y se envía el alta directo:
            fireEvent.change(screen.getByLabelText("Cuenta"), { target: { value: "anaroblox" } });
            fireEvent.submit(screen.getByTestId("form-hijo"));

            expect(screen.getByTestId("form-alta-error").textContent).toContain("Elige la red o app");
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("con la red elegida, la cuenta pendiente entra en el alta con su plataforma", async () => {
            render(<FormularioAltaHijo opcionesPlataforma={OPCIONES} onRegistrado={onRegistrado} />);
            fireEvent.change(screen.getByLabelText("Nombres"), { target: { value: "Ana" } });
            fireEvent.change(screen.getByLabelText("Apellidos"), { target: { value: "Ruiz" } });
            fireEvent.change(screen.getByLabelText("Cuenta"), { target: { value: "anaroblox" } });
            fireEvent.change(screen.getByLabelText("Plataforma"), { target: { value: "p1" } });
            fireEvent.submit(screen.getByTestId("form-hijo"));

            await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
            const body = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body));
            expect(body.identificadores).toEqual([{ valor: "anaroblox", plataformaId: "p1" }]);
        });
    });

    describe("puerta 2 · agregar cuenta a un hijo existente (HijoCard)", () => {
        const hijo: Hijo = {
            id: "h1",
            nombre: "Juan",
            apellidos: "Pérez",
            anioNacimiento: 2015,
            sexo: "M",
            estado: "activo",
            identificadores: [],
        };
        const noop = vi.fn();

        it("«Agregar» está inactivo sin plataforma y no llama al backend; con la red se activa", () => {
            const onAgregar = vi.fn();
            render(
                <HijoCard
                    hijo={hijo}
                    opcionesPlataforma={OPCIONES}
                    onCambiarEstadoHijo={noop}
                    onEditarHijo={noop}
                    onCambiarEstadoIdentificador={noop}
                    onDesvincular={noop}
                    onAgregarIdentificador={onAgregar}
                />,
            );
            const card = screen.getByTestId("hijo-h1");
            fireEvent.change(within(card).getByLabelText("Agregar cuenta"), { target: { value: "juan@correo.com" } });
            const agregar = within(card).getByRole("button", { name: "Agregar" }) as HTMLButtonElement;
            expect(agregar.disabled).toBe(true);
            // el clic sobre el botón inactivo no dispara el alta
            fireEvent.click(agregar);
            expect(onAgregar).not.toHaveBeenCalled();
            // + la red → activo
            fireEvent.change(within(card).getByLabelText("Plataforma"), { target: { value: "p1" } });
            expect(agregar.disabled).toBe(false);
        });
    });
});
