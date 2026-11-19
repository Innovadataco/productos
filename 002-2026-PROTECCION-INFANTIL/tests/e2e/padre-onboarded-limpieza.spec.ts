/**
 * SPEC-939 (Calidad) · CANDADO de limpieza del fixture del PADRE — `limpiarPadreOnboarded`
 * barre el Expediente automático y sus hijos antes de borrar al Usuario.
 *
 * CAUSA RAÍZ (hallada caminando 925/928/936, 19-11): el motor crea un Expediente automático con
 * el 1er reporte del padre (SPEC-604) y un `EventoExpediente` por reporte. Ese Expediente FK-ea al
 * Usuario con Restrict. `limpiarPadreOnboarded` borraba directo el Usuario, el delete fallaba por
 * la FK, y como cada paso está envuelto en `.catch(() => undefined)`, **fallaba en silencio**: el
 * padre y su expediente quedaban huérfanos en la BD de larga vida (medido: 2 padres + 2 expedientes).
 *
 * CONTROL POSITIVO («muere con el defecto»): este candado PLANTA el estado que deja el motor —un
 * Expediente con un hijo RESTRICT (`InformePadre`)— y afirma que tras `limpiarPadreOnboarded` quedan
 * 0 Usuario, 0 Expediente y 0 InformePadre. Si se revierte el barrido del subárbol, el Usuario no se
 * puede borrar (FK) y este candado queda ROJO. El `InformePadre` (hijo Restrict, no Cascade) prueba
 * que el barrido no es un simple `expediente.deleteMany` sino que baja por los hijos.
 *
 * Es un candado de CLEANUP, no un journey (sin prefijo `recorrido-journey-`): corre en la suite
 * e2e general. No usa navegador ni endpoints; solo Prisma contra la BD de prueba (guardia SPEC-770).
 */
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { limpiarPadreOnboarded, type PadreOnboarded } from "./fixtures/padre-onboarded";
import type { RolUsuario } from "@prisma/client";

const CORRIDA = randomUUID().slice(0, 8);

test("SPEC-939 · limpiarPadreOnboarded barre el Expediente automático y su hijo Restrict antes del Usuario", async () => {
    // Padre plantado por Prisma (el candado prueba la LIMPIEZA, no el alta; no necesita endpoints).
    const padreRow = await prisma.usuario.create({
        data: {
            email: `padre-spec939-${CORRIDA}@proteccion.local`,
            nombre: `Padre Limpieza 939 ${CORRIDA}`,
            passwordHash: await hashPassword("Spec939Limpieza!Secure"),
            rol: "PARENT" as RolUsuario,
            estado: "activo",
        },
        select: { id: true },
    });

    // El estado que deja el motor: un Expediente automático del padre + un hijo RESTRICT.
    const expediente = await prisma.expediente.create({
        data: {
            padreUsuarioId: padreRow.id,
            identificadorReportado: `+57300939${CORRIDA.slice(0, 4)}`,
            fechaApertura: new Date(),
            estado: "ACTIVO",
        },
        select: { id: true },
    });
    await prisma.informePadre.create({
        data: {
            expedienteId: expediente.id,
            numeroSecuencial: 1,
            pdfHash: `hash-939-${CORRIDA}`,
            codigoVerificacion: `VER-${CORRIDA}`,
            generadoPorId: padreRow.id,
        },
    });

    const padre: PadreOnboarded = { usuarioId: padreRow.id, _limpieza: { usuarios: [padreRow.id], tokens: [] } };
    await limpiarPadreOnboarded(padre);

    expect(await prisma.usuario.count({ where: { id: padreRow.id } }), "el Usuario del padre quedó borrado").toBe(0);
    expect(await prisma.expediente.count({ where: { id: expediente.id } }), "el Expediente automático quedó borrado").toBe(0);
    expect(await prisma.informePadre.count({ where: { expedienteId: expediente.id } }), "el hijo Restrict del Expediente quedó borrado").toBe(0);
});
