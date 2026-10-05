/**
 * CANDADO · SPEC-819 (FORMA-SPEC819) · la PREGUNTA de habeas data en la puerta. Invariantes de la FORMA:
 *  - NADA pre-seleccionado ([NORMA] no inferir): al abrir «Mis datos personales», ni tipo ni sujeto vienen
 *    marcados, y no se puede enviar sin AMBOS ejes.
 *  - DOS ejes: QUÉ (3 tipos: ver/corregir/pedir borrar) y DE QUIÉN (míos / de un hijo de una lista cerrada).
 *  - «Pedir que borren» NO promete borrar: siempre el pie «No siempre se puede borrar todo…».
 *  - Sin plazo (ningún «días/hábiles/…») y sin lenguaje de abogado VISIBLE (habeas data/titular/tratamiento/
 *    consulta/rectificación/supresión no aparecen en lo que ve el padre; el enum vive en `value`, no en texto).
 *  - Borde sin hijos: «De mi hijo» deshabilitada, con pie honesto.
 * jsdom, sin BD.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { PuertaSoporte, type HijoOpcion } from "@/components/modules/soporte/PuertaSoporte";
import { COPY_PUERTA_SOPORTE, COPY_HABEAS_PREGUNTA, COPY_SUPRESION_LIMITE } from "@/lib/soporte/motivos-soporte";

const SIN_PLAZO = /d[ií]as|plazo|24\s*h|h[áa]biles|\bfecha\b|\bsemana/i;
const LENGUAJE_ABOGADO = /habeas\s*data|\btitular\b|tratamiento|\bconsulta\b|rectificaci[óo]n|supresi[óo]n/i;
const okEnviar = () => Promise.resolve({ numeroSeguimiento: "PQR-2026-XYZ" });
const HIJOS: HijoOpcion[] = [
    { id: "h-ana", nombre: "Ana" },
    { id: "h-beto", nombre: "Beto" },
];

const q = (c: HTMLElement, sel: string) => c.querySelector(sel) as HTMLElement | null;
const enviarBtn = () => screen.getByRole("button", { name: COPY_PUERTA_SOPORTE.enviar }) as HTMLButtonElement;

afterEach(() => cleanup());

describe("SPEC-819 · PuertaSoporte · la pregunta de habeas data", () => {
    it("no muestra la pregunta hasta elegir «Mis datos personales», y entonces NADA viene pre-seleccionado", () => {
        const { container } = render(<PuertaSoporte onEnviar={okEnviar} hijos={HIJOS} />);
        // Antes de elegir el motivo legal: no hay ejes.
        expect(screen.queryByText(COPY_HABEAS_PREGUNTA.ejeATitulo)).toBeNull();
        expect(screen.queryByText(COPY_HABEAS_PREGUNTA.ejeBTitulo)).toBeNull();

        fireEvent.click(q(container, 'input[value="DATOS_PERSONALES"]')!);

        // Ahora sí los dos ejes…
        expect(screen.getByText(COPY_HABEAS_PREGUNTA.ejeATitulo)).toBeTruthy();
        expect(screen.getByText(COPY_HABEAS_PREGUNTA.ejeBTitulo)).toBeTruthy();
        // …y NADA marcado ([NORMA] no inferir).
        expect(container.querySelectorAll('input[name="habeas-tipo"]:checked').length, "el tipo no puede venir pre-elegido").toBe(0);
        expect(container.querySelectorAll('input[name="habeas-sujeto"]:checked').length, "el sujeto no puede venir pre-elegido").toBe(0);
        // No se puede enviar sin ambos ejes.
        expect(enviarBtn().disabled, "sin ejes no se envía").toBe(true);
    });

    it("«míos»: con tipo + sujeto el botón habilita y envía TITULAR_CUENTA (sin plazo, sin lenguaje de abogado)", async () => {
        const onEnviar = vi.fn(okEnviar);
        const { container } = render(<PuertaSoporte onEnviar={onEnviar} hijos={HIJOS} />);
        fireEvent.click(q(container, 'input[value="DATOS_PERSONALES"]')!);
        fireEvent.click(q(container, 'input[name="habeas-tipo"][value="CONSULTA"]')!);
        expect(enviarBtn().disabled, "falta el sujeto").toBe(true);
        fireEvent.click(q(container, 'input[name="habeas-sujeto"][value="TITULAR_CUENTA"]')!);
        expect(enviarBtn().disabled, "ambos ejes elegidos → habilita").toBe(false);

        expect(SIN_PLAZO.test(container.textContent ?? ""), "la pregunta no menciona plazo").toBe(false);
        expect(LENGUAJE_ABOGADO.test(container.textContent ?? ""), "cero lenguaje de abogado visible").toBe(false);

        fireEvent.click(enviarBtn());
        // SPEC-827: CONSULTA no lleva objeto → viaja con `clasesSolicitadas: []`.
        await waitFor(() =>
            expect(onEnviar).toHaveBeenCalledWith({
                motivo: "DATOS_PERSONALES",
                tipo: "CONSULTA",
                sujeto: { calidad: "TITULAR_CUENTA" },
                clasesSolicitadas: [],
            }),
        );
    });

    it("«de mi hijo» con varios hijos: exige elegir CUÁL (lista cerrada) antes de enviar; manda el hijoId", async () => {
        const onEnviar = vi.fn(okEnviar);
        const { container } = render(<PuertaSoporte onEnviar={onEnviar} hijos={HIJOS} />);
        fireEvent.click(q(container, 'input[value="DATOS_PERSONALES"]')!);
        fireEvent.click(q(container, 'input[name="habeas-tipo"][value="RECTIFICACION"]')!);
        fireEvent.click(q(container, 'input[name="habeas-sujeto"][value="REPRESENTANTE_LEGAL"]')!);
        // Con varios hijos, nada pre-elegido: todavía no se puede enviar.
        expect(enviarBtn().disabled, "«de mi hijo» sin elegir cuál no se envía").toBe(true);
        // La lista es cerrada (radios), nunca texto libre.
        expect(container.querySelectorAll("textarea").length).toBe(0);
        expect(container.querySelector('input[name="habeas-hijo"][type="radio"]'), "el hijo se elige de una lista, no se escribe").toBeTruthy();

        fireEvent.click(q(container, 'input[name="habeas-hijo"][value="h-beto"]')!);
        // SPEC-827: RECTIFICACION ahora exige el OBJETO (≥1 clase) — con hijo pero sin objeto, aún no envía.
        expect(enviarBtn().disabled, "RECTIFICACION sin objeto no se envía").toBe(true);
        fireEvent.click(q(container, 'input[name="habeas-clase"][value="RELATO_CITA"]')!);
        expect(enviarBtn().disabled).toBe(false);
        fireEvent.click(enviarBtn());
        await waitFor(() =>
            expect(onEnviar).toHaveBeenCalledWith({
                motivo: "DATOS_PERSONALES",
                tipo: "RECTIFICACION",
                sujeto: { calidad: "REPRESENTANTE_LEGAL", hijoId: "h-beto" },
                clasesSolicitadas: ["RELATO_CITA"],
            }),
        );
    });

    it("«Pedir que borren» muestra SIEMPRE el límite «no siempre se puede borrar» (no promete borrar)", () => {
        const { container } = render(<PuertaSoporte onEnviar={okEnviar} hijos={HIJOS} />);
        fireEvent.click(q(container, 'input[value="DATOS_PERSONALES"]')!);
        expect(screen.getByText(COPY_SUPRESION_LIMITE), "falta el pie de la verdad de la promesa").toBeTruthy();
        // Control positivo de que NO promete: el verbo es «pedir», y no hay «borraremos/eliminaremos».
        expect(/borraremos|eliminaremos tus datos/i.test(container.textContent ?? ""), "no promete el borrado").toBe(false);
    });

    it("borde sin hijos: «De mi hijo» deshabilitada + pie honesto (la salida queda pendiente de Diseño)", () => {
        const { container } = render(<PuertaSoporte onEnviar={okEnviar} hijos={[]} />);
        fireEvent.click(q(container, 'input[value="DATOS_PERSONALES"]')!);
        const deMiHijo = q(container, 'input[name="habeas-sujeto"][value="REPRESENTANTE_LEGAL"]') as HTMLInputElement;
        expect(deMiHijo.disabled, "sin hijos registrados, «De mi hijo» no tiene de dónde elegir").toBe(true);
        expect(screen.getByText(COPY_HABEAS_PREGUNTA.sinHijos)).toBeTruthy();
    });

    it("un solo hijo: al elegir «De mi hijo» queda nombrado (visible) y permite enviar", async () => {
        const onEnviar = vi.fn(okEnviar);
        const { container } = render(<PuertaSoporte onEnviar={onEnviar} hijos={[{ id: "h-uni", nombre: "Uni" }]} />);
        fireEvent.click(q(container, 'input[value="DATOS_PERSONALES"]')!);
        fireEvent.click(q(container, 'input[name="habeas-tipo"][value="SUPRESION"]')!);
        fireEvent.click(q(container, 'input[name="habeas-sujeto"][value="REPRESENTANTE_LEGAL"]')!);
        // El único hijo queda nombrado y confirmado. SPEC-827: SUPRESION exige el OBJETO → aún falta la clase.
        expect((q(container, 'input[name="habeas-hijo"][value="h-uni"]') as HTMLInputElement).checked).toBe(true);
        expect(enviarBtn().disabled, "SUPRESION sin objeto no se envía").toBe(true);
        fireEvent.click(q(container, 'input[name="habeas-clase"][value="PERFIL"]')!);
        expect(enviarBtn().disabled).toBe(false);
        fireEvent.click(enviarBtn());
        await waitFor(() =>
            expect(onEnviar).toHaveBeenCalledWith({
                motivo: "DATOS_PERSONALES",
                tipo: "SUPRESION",
                sujeto: { calidad: "REPRESENTANTE_LEGAL", hijoId: "h-uni" },
                clasesSolicitadas: ["PERFIL"],
            }),
        );
    });
});

describe("SPEC-827 · PuertaSoporte · el objeto de la petición (eje C)", () => {
    it("CONSULTA no muestra el paso del objeto (no lo necesita)", () => {
        const { container } = render(<PuertaSoporte onEnviar={okEnviar} hijos={HIJOS} />);
        fireEvent.click(q(container, 'input[value="DATOS_PERSONALES"]')!);
        fireEvent.click(q(container, 'input[name="habeas-tipo"][value="CONSULTA"]')!);
        expect(container.querySelectorAll('input[name="habeas-clase"]').length, "CONSULTA no lleva objeto").toBe(0);
    });

    it("RECTIFICACION y SUPRESION ofrecen las SEIS clases (el derecho es general, sin hueco)", () => {
        const { container } = render(<PuertaSoporte onEnviar={okEnviar} hijos={HIJOS} />);
        fireEvent.click(q(container, 'input[value="DATOS_PERSONALES"]')!);
        for (const tipo of ["RECTIFICACION", "SUPRESION"] as const) {
            fireEvent.click(q(container, `input[name="habeas-tipo"][value="${tipo}"]`)!);
            expect(container.querySelectorAll('input[name="habeas-clase"]').length, `${tipo} ofrece las 6 clases`).toBe(6);
            for (const v of ["PERFIL", "HIJOS", "IDENTIFICADORES_CIRCULO", "RELATO_CITA", "CONTENIDO_REPORTE", "OTRO"]) {
                expect(q(container, `input[name="habeas-clase"][value="${v}"]`), `falta la clase ${v}`).toBeTruthy();
            }
        }
    });

    it("multi-select: la petición puede recaer sobre MÁS de una clase (las nombra todas, no una)", async () => {
        const onEnviar = vi.fn(okEnviar);
        const { container } = render(<PuertaSoporte onEnviar={onEnviar} hijos={HIJOS} />);
        fireEvent.click(q(container, 'input[value="DATOS_PERSONALES"]')!);
        fireEvent.click(q(container, 'input[name="habeas-tipo"][value="SUPRESION"]')!);
        fireEvent.click(q(container, 'input[name="habeas-sujeto"][value="TITULAR_CUENTA"]')!);
        fireEvent.click(q(container, 'input[name="habeas-clase"][value="PERFIL"]')!);
        fireEvent.click(q(container, 'input[name="habeas-clase"][value="CONTENIDO_REPORTE"]')!);
        fireEvent.click(enviarBtn());
        await waitFor(() =>
            expect(onEnviar).toHaveBeenCalledWith(
                expect.objectContaining({ clasesSolicitadas: ["PERFIL", "CONTENIDO_REPORTE"] }),
            ),
        );
    });

    it("los límites del relato aparecen al elegirlo en una RECTIFICACION, NO en una SUPRESION", () => {
        const { container } = render(<PuertaSoporte onEnviar={okEnviar} hijos={HIJOS} />);
        fireEvent.click(q(container, 'input[value="DATOS_PERSONALES"]')!);
        fireEvent.click(q(container, 'input[name="habeas-tipo"][value="RECTIFICACION"]')!);
        fireEvent.click(q(container, 'input[name="habeas-clase"][value="RELATO_CITA"]')!);
        expect(/no borra/i.test(container.textContent ?? ""), "RECTIFICACION del relato muestra sus límites").toBe(true);
        // Cambiar a SUPRESION: los límites de CORRECCIÓN del relato no aplican (y cambiar de tipo limpia la selección).
        fireEvent.click(q(container, 'input[name="habeas-tipo"][value="SUPRESION"]')!);
        fireEvent.click(q(container, 'input[name="habeas-clase"][value="RELATO_CITA"]')!);
        expect(/no borra/i.test(container.textContent ?? ""), "los límites de corrección no aplican a SUPRESION").toBe(false);
    });

    it("las etiquetas de clase: sin plazo ni jerga (lenguaje de familia — «cuenta», no «identificador»)", () => {
        const { container } = render(<PuertaSoporte onEnviar={okEnviar} hijos={HIJOS} />);
        fireEvent.click(q(container, 'input[value="DATOS_PERSONALES"]')!);
        fireEvent.click(q(container, 'input[name="habeas-tipo"][value="SUPRESION"]')!);
        const txt = container.textContent ?? "";
        expect(SIN_PLAZO.test(txt), "el objeto no menciona plazo").toBe(false);
        expect(/identificador|\bnick\b|\balias\b|\bPII\b/i.test(txt), "lenguaje de familia, no jerga").toBe(false);
    });
});
