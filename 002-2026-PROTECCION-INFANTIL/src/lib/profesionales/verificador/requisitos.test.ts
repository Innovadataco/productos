/**
 * SPEC-408 · Tests del reader de `verificacion.requisitos`.
 */
import { describe, it, expect } from "vitest";
import { leerRequisitosVerificacion, checklistVacio, type RequisitoVerificacion } from "./requisitos";

function clienteConValor(valor: string | null) {
    return {
        parametroSistema: {
            findUnique: async () => (valor === null ? null : { valor, esSecreto: false, clave: "verificacion.requisitos" }),
        },
    } as never;
}

describe("SPEC-408 · leerRequisitosVerificacion", () => {
    it("devuelve la lista parseada cuando el JSON es válido", async () => {
        const lista = [
            { clave: "tarjeta_profesional", nombre: "Tarjeta", descripcion: "PDF o imagen" },
            { clave: "cedula", nombre: "Cédula", descripcion: "" },
        ];
        const result = await leerRequisitosVerificacion(clienteConValor(JSON.stringify(lista)));
        expect(result).toEqual(lista);
    });

    it("acepta descripcion ausente y la default-ea a ''", async () => {
        const lista = [{ clave: "x", nombre: "X" }];
        const result = await leerRequisitosVerificacion(clienteConValor(JSON.stringify(lista)));
        expect(result[0].descripcion).toBe("");
    });

    it("tira si el parámetro no existe (candado: sin lista no hay verificación)", async () => {
        await expect(leerRequisitosVerificacion(clienteConValor(null))).rejects.toThrow(/parámetro ausente/);
    });

    it("tira si el JSON está corrupto", async () => {
        await expect(leerRequisitosVerificacion(clienteConValor("{ no soy json"))).rejects.toThrow(/JSON inválido/);
    });

    it("tira si el JSON es array vacío", async () => {
        await expect(leerRequisitosVerificacion(clienteConValor("[]"))).rejects.toThrow(/estructura inválida/);
    });

    it("tira si un ítem no tiene `clave`", async () => {
        await expect(
            leerRequisitosVerificacion(clienteConValor(JSON.stringify([{ nombre: "X" }]))),
        ).rejects.toThrow(/estructura inválida/);
    });
});

describe("SPEC-408 · checklistVacio", () => {
    it("crea un mapa con cada clave en PENDIENTE y observación vacía", () => {
        const requisitos: RequisitoVerificacion[] = [
            { clave: "a", nombre: "A", descripcion: "" },
            { clave: "b", nombre: "B", descripcion: "" },
        ];
        const vacio = checklistVacio(requisitos);
        expect(vacio).toEqual({
            a: { estado: "PENDIENTE", observacion: "" },
            b: { estado: "PENDIENTE", observacion: "" },
        });
    });
});
