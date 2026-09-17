/**
 * CANDADO · SPEC-699 (I-424) · El pase entrega el RELATO del reporte, no el sobre vacío.
 *
 * El defecto (medido en prod): una anotación de origen reporte se crea con el sobre PROPIO
 * vacío (`texto:""`, AD-3) y el relato vive en el sobre del REPORTE; el pase descifraba el
 * sobre propio → entregaba el relato en blanco, y la huella auditada era sha-256("") =
 * e3b0c442… Ningún candado lo vio porque los tests de `/ver` sembraban la anotación CON texto
 * propio, no con "" como el alta real ([[dev-candado-no-fuga-necesita-el-dato-real]]).
 *
 * Este candado usa el ALTA REAL (`asegurarExpedienteParaReporte`, evento `texto:""`) y exige:
 *   · el pase devuelve el relato (no "");
 *   · la huella registrada en `LecturaReporte` es sha-256(relato), DISTINTA de sha-256("").
 * Control positivo integrado: con el bug (descifrar el sobre propio) la huella sería la de "".
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { crearUsuario, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { asegurarExpedienteParaReporte } from "@/lib/dal/services/expediente-automatico";
import {
    solicitarCodigoAcceso,
    canjearCodigoAcceso,
    leerExpedienteConSesion,
} from "@/lib/dal/services/codigo-acceso";

const RELATO = "RELATO REAL del reporte — esto debe salir por el pase, no el vacío";
const SHA_VACIO = createHash("sha256").update("", "utf8").digest("hex"); // e3b0c442…b855

describe("SPEC-699 (I-424) · el pase entrega el relato del reporte, no el sobre vacío", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        await crearPaisCiudad();
    });
    afterAll(async () => prisma.$disconnect());

    it("alta REAL (evento texto=''): el pase devuelve el relato y la huella != sha256('')", async () => {
        const padre = await crearUsuario("PARENT");
        const plataforma = await prisma.plataforma.findUniqueOrThrow({ where: { clave: "whatsapp" } });
        const reporte = await crearReporteFixture(prisma, {
            data: {
                identificador: `+57300R99${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
                plataformaId: plataforma.id,
                texto: RELATO,
                fechaIncidente: new Date("2026-09-01T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: false,
                usuarioId: padre.id,
                estado: "REVISION_MANUAL",
            },
        });

        // Alta REAL: el evento sella su PROPIO sobre con texto="" y el relato vive en el reporte.
        const res = await prisma.$transaction((tx) => asegurarExpedienteParaReporte(tx, reporte.id));
        const expedienteId = res!.expedienteId;
        const evento = await prisma.eventoExpediente.findFirstOrThrow({ where: { reporteId: reporte.id } });

        // Pase completo: solicita el padre dueño → canjea el profesional → lee.
        const { codigo } = await solicitarCodigoAcceso({ expedienteId, solicitadoPorId: padre.id });
        const prof = await crearUsuario("PROFESIONAL");
        const { tokenSesion } = await canjearCodigoAcceso({
            codigoCrudo: codigo,
            canjeadoPor: { id: prof.id, nombre: prof.nombre, rol: "PROFESIONAL" },
        });
        const { eventos } = await leerExpedienteConSesion({ tokenSesion, ip: "1.1.1.1" });

        const ev = eventos.find((e) => e.eventoId === evento.id);
        expect(ev?.texto, "el pase debe devolver el RELATO, no el vacío").toBe(RELATO);

        // La huella auditada prueba QUÉ vio el lector: sha-256(relato), nunca la de "".
        const lectura = await prisma.lecturaReporte.findFirstOrThrow({
            where: { eventoId: evento.id, codigoAccesoId: { not: null } },
        });
        expect(lectura.hashContenido).toBe(createHash("sha256").update(RELATO, "utf8").digest("hex"));
        expect(lectura.hashContenido, "con el bug daba sha256('') = e3b0c442…").not.toBe(SHA_VACIO);
    });
});
