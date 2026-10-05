/**
 * 🚨 CANDADO · SPEC-824 · ALCANZABILIDAD — la invariante que impide que esto vuelva a pasar.
 *
 *   «La puerta no puede ser alcanzable por un padre antes de que alguien pueda ver lo que entra por ella.»
 *
 * Es de CONDUCTA, no de palabras:
 *   (1) Lo que entra por la puerta (una PeticionServicio creada por el SERVICIO) APARECE en la bandeja del
 *       operador (`listarBandejaPeticiones`). Si alguien borra la bandeja (servicio o su cadena), este import
 *       falla y el candado se pone ROJO — control positivo exacto que pidió el radicado.
 *   (2) Implicación estructural: si EXISTE el endpoint que crea el reloj legal (la puerta alcanzable), DEBE
 *       existir la página de la bandeja. Quitar la bandeja dejando viva la puerta → ROJO. Quitar la puerta
 *       (volverla inalcanzable, como estaba en 819) NO exige bandeja — por eso la implicación es en un sentido.
 *
 * Integración (BD de test). NO toca prod.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { crearPeticionServicio } from "@/lib/dal/services/soporte/peticion-servicio.service";
import { listarBandejaPeticiones } from "@/lib/soporte/bandeja-peticiones.service";

const RAIZ = path.resolve(__dirname, "../../..");
const ENDPOINT_PUERTA = path.join(RAIZ, "src/app/api/padre/soporte/peticiones/route.ts");
const PAGINA_BANDEJA = path.join(RAIZ, "src/app/dashboard/admin/soporte/peticiones/page.tsx");

describe("SPEC-824 · 🚨 alcanzabilidad puerta ⟹ bandeja", { timeout: 30_000 }, () => {
    beforeEach(async () => resetDatabase());
    afterAll(async () => prisma.$disconnect());

    it("(1) lo que entra por la puerta se VE en la bandeja (DATOS_PERSONALES y un motivo simple)", async () => {
        const padre = await crearUsuario("PARENT", `padre.824alc.${Date.now()}@ejemplo.local`);
        await crearPeticionServicio({
            usuarioId: padre.id,
            motivo: "DATOS_PERSONALES",
            habeasData: { tipo: "CONSULTA", sujeto: { calidad: "TITULAR_CUENTA" }, clasesSolicitadas: [] },
        });
        await crearPeticionServicio({ usuarioId: padre.id, motivo: "CITA" });

        const bandeja = await listarBandejaPeticiones();
        expect(bandeja.legales.length, "la habeas data DEBE verse en la bandeja (lo legal)").toBe(1);
        expect(bandeja.otras.length, "el motivo simple también se ve").toBe(1);
        expect(bandeja.resumen.total).toBe(2);
    });

    it("(2) si existe el endpoint que crea el reloj legal, existe la página de la bandeja", () => {
        // Implicación en UN sentido: puerta alcanzable ⟹ bandeja. Si la puerta no existe, no se exige bandeja.
        if (!existsSync(ENDPOINT_PUERTA)) return;
        expect(
            existsSync(PAGINA_BANDEJA),
            "la puerta crea un término de ley: sin la bandeja del operador nadie lo ve — esto DEBE existir",
        ).toBe(true);
    });
});
