/**
 * CANDADO · SPEC-785 — el rastro de accesos del titular no filtra otra familia y no trae crudos.
 * Integración (BD real): siembra accesos con dato REAL y verifica el filtro en las dos direcciones.
 *
 * Invariantes (veredicto CEO — fallar en cualquiera de las dos es grave):
 *  · De MÁS: nunca aparece un acceso al dato de OTRA familia (control positivo: el propio sí).
 *  · De MENOS: aparecen TODOS los accesos de terceros (vía reporte y vía expediente), incluidos
 *    los de lectores ya anonimizados (usuarioId null); solo se excluye el autoacceso del titular.
 *  · Sin CRUDOS: el DTO no lleva identidad del lector, ni hash, ni ip, ni ids — solo rol/calidad/
 *    campo/momento (lista blanca por construcción).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { sellarTextoNuevo } from "@/lib/reporte-texto-contenido";
import { rastroDeAccesosDelTitular } from "./rastro-accesos-titular";

const HASH = "c".repeat(64);
const EMAIL_LECTOR = "lector-interno-secreto-785@interno.local";

async function plataformaId() {
    const p = await prisma.plataforma.upsert({
        where: { clave: "whatsapp" },
        update: {},
        create: { clave: "whatsapp", nombre: "WhatsApp" },
    });
    return p.id;
}

async function reporteDe(padreId: string, plat: string) {
    return crearReporteFixture(prisma, {
        data: {
            identificador: `+57300${Math.floor(Math.random() * 1e9)}`,
            plataformaId: plat,
            texto: "relato de prueba SPEC-785",
            fechaIncidente: new Date("2026-09-01T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            keywordsDetectadas: [],
            estado: "REVISION_MANUAL",
            esAnonimo: false,
            usuarioId: padreId,
        },
    });
}

describe("SPEC-785 · rastro de accesos del titular (filtro por titular + sin crudos)", () => {
    beforeEach(async () => resetDatabase());
    afterAll(async () => prisma.$disconnect());

    it("C-fuga (vía reporte): el acceso a OTRA familia no aparece; el propio sí, con rol/calidad/campo", async () => {
        const plat = await plataformaId();
        const padreA = await crearUsuario("PARENT");
        const padreB = await crearUsuario("PARENT");
        const lector = await crearUsuario("OPERADOR", EMAIL_LECTOR);
        const repA = await reporteDe(padreA.id, plat);
        const repB = await reporteDe(padreB.id, plat);
        await prisma.lecturaReporte.create({
            data: { reporteId: repA.id, contenidoId: repA.contenidoId, campo: "textoOriginal", tipoActor: "PLATAFORMA", rol: "OPERADOR", usuarioId: lector.id, hashContenido: HASH },
        });
        await prisma.lecturaReporte.create({
            data: { reporteId: repB.id, contenidoId: repB.contenidoId, campo: "texto", tipoActor: "PLATAFORMA", rol: "OPERADOR", usuarioId: lector.id, hashContenido: HASH },
        });

        const rastroA = await rastroDeAccesosDelTitular(padreA.id);
        expect(rastroA).toHaveLength(1);
        expect(rastroA[0]).toEqual({ momento: expect.any(String), rol: "OPERADOR", tipoActor: "PLATAFORMA", campo: "textoOriginal" });
        // Control positivo: la familia B SÍ ve su propio acceso (el filtro no es vacuo).
        const rastroB = await rastroDeAccesosDelTitular(padreB.id);
        expect(rastroB.map((r) => r.campo)).toEqual(["texto"]);
    });

    it("C-fuga (vía expediente): el acceso al evento del expediente del padre aparece en SU rastro y no en el de otro", async () => {
        const padreA = await crearUsuario("PARENT");
        const padreB = await crearUsuario("PARENT");
        const expA = await prisma.expediente.create({
            data: { padreUsuarioId: padreA.id, identificadorReportado: `+57300EXP${Date.now()}`, fechaApertura: new Date("2026-09-01T09:00:00Z"), estado: "ACTIVO", scoreGravedadActual: "AMARILLO" },
        });
        const contenido = await prisma.$transaction((tx) => sellarTextoNuevo(tx, { texto: "relato evento", textoOriginal: "orig" }));
        const evento = await prisma.eventoExpediente.create({
            data: { expedienteId: expA.id, ordenSecuencial: 1, contenidoId: contenido.contenidoId, fechaEvento: new Date("2026-09-01T10:05:00Z") },
        });
        await prisma.lecturaReporte.create({
            data: { eventoId: evento.id, contenidoId: contenido.contenidoId, campo: "textoOriginal", tipoActor: "EXTERNO", rol: "PROFESIONAL", usuarioId: null, hashContenido: HASH },
        });

        expect(await rastroDeAccesosDelTitular(padreA.id)).toHaveLength(1);
        expect(await rastroDeAccesosDelTitular(padreB.id)).toHaveLength(0);
    });

    it("C-autoacceso: el acceso del propio titular NO aparece; el de lector anonimizado (usuarioId null) SÍ", async () => {
        const plat = await plataformaId();
        const padreA = await crearUsuario("PARENT");
        const repA = await reporteDe(padreA.id, plat);
        await prisma.lecturaReporte.create({
            data: { reporteId: repA.id, contenidoId: repA.contenidoId, campo: "texto", tipoActor: "PLATAFORMA", rol: "PARENT", usuarioId: padreA.id, hashContenido: HASH },
        });
        await prisma.lecturaReporte.create({
            data: { reporteId: repA.id, contenidoId: repA.contenidoId, campo: "textoOriginal", tipoActor: "PLATAFORMA", rol: "COMITE_VALIDACION", usuarioId: null, hashContenido: HASH },
        });

        const rastroA = await rastroDeAccesosDelTitular(padreA.id);
        expect(rastroA).toHaveLength(1); // solo el anonimizado; el autoacceso queda fuera
        expect(rastroA[0].rol).toBe("COMITE_VALIDACION");
    });

    it("C-sin-crudos: el DTO no trae identidad/hash/ids — solo momento/rol/tipoActor/campo", async () => {
        const plat = await plataformaId();
        const padreA = await crearUsuario("PARENT");
        const lector = await crearUsuario("OPERADOR", EMAIL_LECTOR);
        const repA = await reporteDe(padreA.id, plat);
        await prisma.lecturaReporte.create({
            data: { reporteId: repA.id, contenidoId: repA.contenidoId, campo: "texto", tipoActor: "PLATAFORMA", rol: "OPERADOR", usuarioId: lector.id, hashContenido: HASH },
        });

        const rastroA = await rastroDeAccesosDelTitular(padreA.id);
        expect(rastroA).toHaveLength(1);
        expect(Object.keys(rastroA[0]).sort()).toEqual(["campo", "momento", "rol", "tipoActor"]);
        const serial = JSON.stringify(rastroA);
        expect(serial, "se filtró el id del lector").not.toContain(lector.id);
        expect(serial, "se filtró el correo del lector").not.toContain(EMAIL_LECTOR);
        expect(serial, "se filtró el hash del contenido").not.toContain(HASH);
        expect(serial, "se filtró el id del contenido").not.toContain(repA.contenidoId);
    });
});
