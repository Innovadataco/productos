/**
 * CANDADO · SPEC-824 · son DOS los motivos con término de ley, no uno. El separador de la bandeja lo afirma
 * en palabras («Con término de ley — Datos personales y Pagos/cobros»); este candado lo afirma en CONDUCTA.
 *
 * `PAGO_O_COBRO` (reversión, Decreto 1074/2015, 15 días hábiles) corre un término legal igual que la habeas
 * data. Si cayera en el bloque «Sin plazo de ley», el operador lo trataría como una queja sin reloj y se
 * perdería un plazo de ley. Control positivo: una petición de pago DEBE salir en `legales`, NUNCA en `otras`.
 * La fuente única es `motivoTieneTerminoLegal` (plazo-peticion); si alguien «simplifica» a «solo habeas data»,
 * este candado se pone ROJO.
 *
 * Integración (BD de test). NO toca prod.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { crearPeticionServicio } from "@/lib/dal/services/soporte/peticion-servicio.service";
import { listarBandejaPeticiones } from "@/lib/soporte/bandeja-peticiones.service";

describe("SPEC-824 · PAGO_O_COBRO lleva término de ley (va en el bloque legal)", { timeout: 30_000 }, () => {
    beforeEach(async () => resetDatabase());
    afterAll(async () => prisma.$disconnect());

    it("una petición de pago/cobro sale en «Con término de ley», NUNCA en «Sin plazo de ley»", async () => {
        const padre = await crearUsuario("PARENT", `padre.824pago.${Date.now()}@ejemplo.local`);
        const { numeroSeguimiento } = await crearPeticionServicio({ usuarioId: padre.id, motivo: "PAGO_O_COBRO" });

        const bandeja = await listarBandejaPeticiones();
        expect(bandeja.legales.some((p) => p.id === numeroSeguimiento), "PAGO_O_COBRO DEBE ir en el bloque legal").toBe(true);
        expect(bandeja.otras.some((p) => p.id === numeroSeguimiento), "PAGO_O_COBRO NUNCA en el bloque sin-plazo").toBe(false);
        expect(bandeja.legales.find((p) => p.id === numeroSeguimiento)?.esLegal).toBe(true);
    });

    it("control de contraste: una CITA sí es «Sin plazo de ley» (el bloque legal no se traga todo)", async () => {
        const padre = await crearUsuario("PARENT", `padre.824cita.${Date.now()}@ejemplo.local`);
        const { numeroSeguimiento } = await crearPeticionServicio({ usuarioId: padre.id, motivo: "CITA" });

        const bandeja = await listarBandejaPeticiones();
        expect(bandeja.otras.some((p) => p.id === numeroSeguimiento), "una cita no lleva término de ley").toBe(true);
        expect(bandeja.legales.some((p) => p.id === numeroSeguimiento)).toBe(false);
    });
});
