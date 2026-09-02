/**
 * SPEC-357 (I-254) — El colegio que vence a mitad del camino NO queda encerrado.
 *
 * El encierro verificado en vivo por Calidad: el guardián manda al rector al paso
 * pendiente, la pantalla le exige cargar un profesor y el handler le responde 403
 * «El servicio del colegio ha vencido». Estos tests fijan la salida: mientras el
 * camino tenga un paso pendiente, las rutas que el camino necesita quedan
 * abiertas aunque la vigencia esté caída — y apenas el camino cierra, la
 * vigencia vuelve a mandar sin excepciones.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, terminarCaminoColegio, vencerColegio } from "@/lib/reporte-test-utils";
import { verificarVigenciaColegioSalvoCamino } from "./vigencia-camino";
import { verificarVigenciaCliente } from "./vigencia";
import { derivarPasoPendienteColegio } from "@/lib/dal/services/camino/estado-colegio";

describe("SPEC-357 · vigencia del colegio EN el camino (I-254)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("colegio VENCIDO con el camino a medias: puede seguir (las rutas del camino no se cierran)", async () => {
        const { colegio, admin } = await crearColegioConAdmin();
        await vencerColegio(colegio.id);

        // Premisa del escenario: está vencido y el camino le pide algo.
        expect((await verificarVigenciaCliente(admin.id)).vigente, "el colegio está vencido").toBe(false);
        expect(await derivarPasoPendienteColegio(admin.id), "el camino le exige terminar").not.toBeNull();

        const resultado = await verificarVigenciaColegioSalvoCamino(admin.id);
        expect(resultado.vigente, "el camino le queda abierto: puede terminar lo que le exigen").toBe(true);
    });

    it("colegio VENCIDO con el camino TERMINADO: sigue cortado (la vigencia vuelve a mandar)", async () => {
        const { colegio, admin } = await crearColegioConAdmin();
        await terminarCaminoColegio(colegio.id, admin.id);
        await vencerColegio(colegio.id);

        expect(await derivarPasoPendienteColegio(admin.id), "camino cerrado").toBeNull();

        const resultado = await verificarVigenciaColegioSalvoCamino(admin.id);
        expect(resultado.vigente, "un colegio configurado y vencido NO gana acceso").toBe(false);
        expect(resultado.estado).toBe("vencido");
    });

    it("colegio VIGENTE: el resultado es el de siempre, con o sin camino pendiente", async () => {
        const { admin } = await crearColegioConAdmin();
        const resultado = await verificarVigenciaColegioSalvoCamino(admin.id);
        expect(resultado.vigente).toBe(true);
        expect(resultado).toEqual(await verificarVigenciaCliente(admin.id));
    });

    it("colegio INACTIVO: el corte se mantiene aunque el camino esté a medias (no es la ventana, es el estado)", async () => {
        const { colegio, admin } = await crearColegioConAdmin();
        await prisma.colegio.update({ where: { id: colegio.id }, data: { estado: "inactivo" } });

        const resultado = await verificarVigenciaColegioSalvoCamino(admin.id);
        expect(resultado.vigente, "un colegio dado de baja no entra por la puerta del camino").toBe(false);
        expect(resultado.estado).toBe("inactivo");
    });
});
