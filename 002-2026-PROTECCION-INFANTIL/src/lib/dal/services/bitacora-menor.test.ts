/**
 * A-70 · F10 — bitácora del menor.
 *
 * Los asserts van contra las llamadas REALES de `hijos/hijos.ts` (no contra
 * filas de AuditLog escritas a mano): si mañana alguien cambia la forma del
 * metadato, este test se cae, que es exactamente lo que debe pasar.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import {
    registrarHijo,
    agregarIdentificador,
    cambiarEstadoIdentificador,
    cambiarEstadoHijo,
    desvincularIdentificador,
    actualizarHijo,
} from "./hijos/hijos";
import { bitacoraDelMenor } from "./bitacora-menor";

async function crearPadre(sufijo: string) {
    return crearUsuario("PARENT", `padre-bitacora-${sufijo}-${Date.now()}@test.local`);
}

let secuenciaDocumento = 0;

async function crearMenor(usuarioId: string, nombre = "Sofía") {
    secuenciaDocumento += 1;
    const { hijoId } = await registrarHijo(usuarioId, {
        nombre,
        apellidos: "Pérez",
        documentoTipo: "TI",
        documentoNumero: `${Date.now()}${secuenciaDocumento}`.slice(-10),
    });
    return hijoId;
}

describe("bitacoraDelMenor", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("el primer hito es el alta y define desde cuándo se está monitoreando", async () => {
        const padre = await crearPadre("alta");
        const hijoId = await crearMenor(padre.id, "Sofía");

        const bitacora = await bitacoraDelMenor(hijoId, padre.id);

        expect(bitacora.hitos).toHaveLength(1);
        expect(bitacora.hitos[0].tipo).toBe("menor_registrado");
        expect(bitacora.hitos[0].descripcion).toContain("Sofía");
        expect(bitacora.monitoreadoDesde).toEqual(bitacora.hitos[0].fecha);
        expect(bitacora.nombre).toBe("Sofía");
    });

    it("el reloj del monitoreo no se reinicia: monitoreadoDesde es siempre el hito más antiguo", async () => {
        const padre = await crearPadre("reloj");
        const hijoId = await crearMenor(padre.id);
        // Agregar una cuenta después del alta crea un hito más nuevo; el
        // monitoreo sigue contando desde el registro, no desde la cuenta.
        await agregarIdentificador(padre.id, hijoId, { valor: "sofi_tiktok" });

        const { hitos, monitoreadoDesde } = await bitacoraDelMenor(hijoId, padre.id);

        expect(hitos[0].tipo).toBe("menor_registrado");
        expect(monitoreadoDesde).toEqual(hitos[0].fecha);
        for (let i = 1; i < hitos.length; i++) {
            expect(hitos[i].fecha.getTime()).toBeGreaterThanOrEqual(hitos[i - 1].fecha.getTime());
        }
    });

    it("sigue la vida de una cuenta: alta, apagado y encendido, nombrándola", async () => {
        const padre = await crearPadre("cuentas");
        const hijoId = await crearMenor(padre.id);

        const { identificadorId } = await agregarIdentificador(padre.id, hijoId, {
            valor: "sofi_roblox",
        });
        await cambiarEstadoIdentificador(padre.id, identificadorId, false);
        await cambiarEstadoIdentificador(padre.id, identificadorId, true);

        const { hitos } = await bitacoraDelMenor(hijoId, padre.id);

        expect(hitos.map((h) => h.tipo)).toEqual([
            "menor_registrado",
            "identificador_asignado",
            "identificador_inactivado",
            "identificador_activado",
        ]);
        // El alta de la cuenta sale UNA vez: viene del `creadoEn`, y el
        // HIJO_UPDATE de "agregado" no debe duplicarla.
        expect(hitos.filter((h) => h.tipo === "identificador_asignado")).toHaveLength(1);
        for (const hito of hitos.slice(1)) {
            expect(hito.identificador).toBe("sofi_roblox");
            expect(hito.descripcion).toContain("sofi_roblox");
        }
    });

    it("pausar y reactivar al menor por `cambiarEstadoHijo` enciende los hitos (SPEC-363 en main)", async () => {
        // La regla viva del lado ESCRITURA: la UI cambia el estado del hijo por
        // `PATCH /api/padre/hijos/[id]`, que desde SPEC-363 enruta el estado por
        // `cambiarEstadoHijo` — la ÚNICA función que audita `{estado}` con el
        // valor. La bitácora lo lee de ahí. (Antes de SPEC-363 esto era un
        // tripwire que afirmaba lo contrario; con la escritura en main, se
        // convirtió en el assert de la regla.)
        const padre = await crearPadre("estado-vivo");
        const hijoId = await crearMenor(padre.id, "Sofía");

        await cambiarEstadoHijo(padre.id, hijoId, "inactivo");
        await cambiarEstadoHijo(padre.id, hijoId, "activo");

        const { hitos } = await bitacoraDelMenor(hijoId, padre.id);
        expect(hitos.map((h) => h.tipo)).toEqual([
            "menor_registrado",
            "menor_inactivado",
            "menor_activado",
        ]);
        expect(hitos[1].descripcion).toContain("Pausaste");
        expect(hitos[2].descripcion).toContain("Reactivaste");
    });

    it("corregir un dato de la ficha por `actualizarHijo` NO es un hito de la protección", async () => {
        // El otro lado de la regla: `actualizarHijo` audita las correcciones
        // como `{campos:[...]}` sin valor. Cambiar un apellido mal escrito no
        // pertenece a la línea de tiempo de la protección — solo altas, estado
        // y cuentas.
        const padre = await crearPadre("correccion");
        const hijoId = await crearMenor(padre.id);

        await actualizarHijo(padre.id, hijoId, { nombre: "Sofía Lucía" });

        const { hitos } = await bitacoraDelMenor(hijoId, padre.id);
        expect(hitos.map((h) => h.tipo)).toEqual(["menor_registrado"]);
    });

    it("quitar una cuenta enciende el hito sin filtrar el valor del identificador (PII)", async () => {
        // `desvincularIdentificador` BORRA la fila; desde SPEC-363 graba `{hijoId}`
        // en la auditoría para poder atar el hito al menor. El valor NUNCA vuelve
        // al log: el hito nombra el hecho, no la cuenta.
        const padre = await crearPadre("quitar");
        const hijoId = await crearMenor(padre.id);
        const { identificadorId } = await agregarIdentificador(padre.id, hijoId, {
            valor: "sofi_secreto",
        });

        await desvincularIdentificador(padre.id, identificadorId);

        const { hitos } = await bitacoraDelMenor(hijoId, padre.id);
        const quitada = hitos.find((h) => h.tipo === "identificador_inactivado");
        expect(quitada).toBeDefined();
        expect(quitada!.descripcion).toContain("Quitaste");
        // El valor es PII y la fila ya no existe: no debe aparecer en ningún hito.
        for (const hito of hitos) {
            expect(hito.descripcion).not.toContain("sofi_secreto");
            expect(hito.identificador).not.toBe("sofi_secreto");
        }
    });

    it("recorrido completo de Jelkin: alta → pausa → reactivación → cuenta quitada = 4 hitos, sin PII", async () => {
        // El recorrido que prueba Jelkin, contra las funciones reales que usa la
        // ruta. La cuenta se agrega y luego se quita: al borrarse la fila, su
        // hito de alta (que sale del `creadoEn`) desaparece y queda solo el de
        // "quitaste" — por eso el recorrido cierra en 4 hitos, no 5.
        const padre = await crearPadre("e2e");
        const hijoId = await crearMenor(padre.id, "Sofía");

        const { identificadorId } = await agregarIdentificador(padre.id, hijoId, {
            valor: "sofi_tiktok",
        });
        await cambiarEstadoHijo(padre.id, hijoId, "inactivo");
        await cambiarEstadoHijo(padre.id, hijoId, "activo");
        await desvincularIdentificador(padre.id, identificadorId);

        const { hitos, monitoreadoDesde } = await bitacoraDelMenor(hijoId, padre.id);

        // Los 4 hitos que espera Jelkin, en orden cronológico.
        expect(hitos.map((h) => h.tipo)).toEqual([
            "menor_registrado",
            "menor_inactivado",
            "menor_activado",
            "identificador_inactivado",
        ]);
        // El alta abre la bitácora y fija el reloj del monitoreo.
        expect(monitoreadoDesde).toEqual(hitos[0].fecha);
        // SIN el valor del identificador (PII) en ningún hito.
        for (const hito of hitos) {
            expect(hito.descripcion).not.toContain("sofi_tiktok");
            expect(hito.identificador).not.toBe("sofi_tiktok");
        }
        // Cronología no decreciente.
        for (let i = 1; i < hitos.length; i++) {
            expect(hitos[i].fecha.getTime()).toBeGreaterThanOrEqual(hitos[i - 1].fecha.getTime());
        }
    });

    it("la ficha de otro padre no se lee: 404", async () => {
        const dueno = await crearPadre("dueno");
        const ajeno = await crearPadre("ajeno");
        const hijoId = await crearMenor(dueno.id);

        await expect(bitacoraDelMenor(hijoId, ajeno.id)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("un metadato con JSON roto se omite en vez de tumbar la bitácora", async () => {
        const padre = await crearPadre("json-roto");
        const hijoId = await crearMenor(padre.id);
        await prisma.auditLog.create({
            data: {
                accion: "HIJO_UPDATE",
                tipoRecurso: "Hijo",
                recursoId: hijoId,
                usuarioId: padre.id,
                valorNuevo: "{esto no es json",
                ipAddress: "127.0.0.1",
                userAgent: "test",
            },
        });

        const { hitos } = await bitacoraDelMenor(hijoId, padre.id);
        expect(hitos.map((h) => h.tipo)).toEqual(["menor_registrado"]);
    });
});
