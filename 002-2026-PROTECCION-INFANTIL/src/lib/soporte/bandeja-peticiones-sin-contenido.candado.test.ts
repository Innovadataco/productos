/**
 * 🔒 CANDADO · SPEC-824 · la bandeja NO revela el contenido ni el SUJETO del dato del titular.
 *
 * La `SolicitudHabeasData` está despojada a propósito (enums, sin narrativa) para sobrevivir a una supresión;
 * leer la bandeja no puede revelar qué se pidió borrar NI de quién. El punto fino: `sujetoDelDato` guarda el
 * `hijoId` cuando la petición es «de mi hijo» — eso es «DE QUIÉN», y NO debe llegar a la bandeja.
 *
 * Conducta (no palabras): se planta una SUPRESIÓN sobre un hijo concreto y se afirma que el `hijoId` NO
 * aparece en NINGÚN lado del DTO de la bandeja. Control positivo exacto: si alguien agrega `sujetoDelDato`
 * (u otra cara del sujeto) al SELECT/DTO, el hijoId filtra y este candado se pone ROJO.
 *
 * Integración (BD de test). NO toca prod.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { crearPeticionServicio } from "@/lib/dal/services/soporte/peticion-servicio.service";
import { listarBandejaPeticiones } from "@/lib/soporte/bandeja-peticiones.service";

describe("SPEC-824 · 🔒 bandeja sin contenido/sujeto del titular", { timeout: 30_000 }, () => {
    beforeEach(async () => resetDatabase());
    afterAll(async () => prisma.$disconnect());

    it("una supresión sobre un hijo se VE (la acción) pero NO revela DE QUIÉN (el hijoId no filtra)", async () => {
        const padre = await crearUsuario("PARENT", `padre.824priv.${Date.now()}@ejemplo.local`);
        const hijo = await prisma.hijo.create({ data: { usuarioId: padre.id, nombre: "Ana", apellidos: "Pérez" } });
        await crearPeticionServicio({
            usuarioId: padre.id,
            motivo: "DATOS_PERSONALES",
            habeasData: { tipo: "SUPRESION", sujeto: { calidad: "REPRESENTANTE_LEGAL", hijoId: hijo.id }, clasesSolicitadas: ["RELATO_CITA"] },
        });

        const bandeja = await listarBandejaPeticiones();
        // Triage útil: la petición SÍ se ve (es legal y la ACCIÓN es supresión).
        expect(bandeja.legales.length).toBe(1);
        expect(bandeja.legales[0].tipoHabeas).toBe("SUPRESION");
        // 🔒 Pero NO revela DE QUIÉN: el hijoId (sujetoDelDato) no puede aparecer en NINGÚN campo del DTO.
        expect(JSON.stringify(bandeja).includes(hijo.id), "el hijoId (sujeto) NO puede filtrar a la bandeja").toBe(false);
    });
});
