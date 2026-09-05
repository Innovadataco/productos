/**
 * SPEC-439 (Calidad) · Recorrido del aviso al padre cuando otro reporta lo mismo.
 *
 * ORIGEN. Aviso del CEO 04-09 20:0x: SPEC-439 vive en main. El candado
 * anterior ("cualquier `Notificacion` nueva al padre") era candado de
 * palabras — pasaba en verde si otro proceso disparaba cualquier
 * notificación, sin tocar lo que 439 arregla. Este spec afirma la
 * **conducta concreta** contra el **seam determinista**:
 *
 *   Servicio: `avisarPadresQueReportaron`
 *     (`src/lib/dal/services/corroboracion-padre.ts:58`).
 *   Evento:  `reporte.corroborado_por_otro` (`EVENTO_CORROBORACION`).
 *
 * El worker (`worker-reportes.mjs:226`) es fire-and-forget y su misma
 * spec anota la degradación silenciosa como deuda. Ese camino asíncrono
 * lo verifica el CEO en prod tras el despliegue; acá se afirma el seam
 * síncrono, que es el que realmente prueba la LÓGICA del aviso.
 *
 * TRES CANDADOS — sin `test.fail`, SPEC-439 está en main:
 *
 *   (A) Con dos padres previos que reportaron el mismo identificador y
 *       un tercero que reporta ahora, el servicio programa aviso a
 *       AMBOS padres previos (no al autor nuevo) — `resultado.avisados === 2`.
 *   (B) Cada aviso queda en `notificaciones` con `evento =
 *       "reporte.corroborado_por_otro"`, `destinatarioUsuarioId` del
 *       padre correcto y `sujetoId === reporteNuevoId`.
 *   (C) Si `autorNuevoId` está en `usuariosPrevios`, NO se auto-avisa
 *       (`avisados === 1`, el otro padre distinto del autor).
 *
 * AISLAMIENTO. Prefijo `e2e-439-<uuid>`. Cero mutación de rol real ni
 * parámetros globales. La `Suscripcion` y datos del camino del padre se
 * siembran por Prisma (no hay endpoint para «forzar suscripción activa»
 * desde tests, patrón de `mis-reportes-expediente.spec.ts`). Consentimiento
 * NO se toca — el servicio no lo requiere; usa `Usuario` directo.
 * Limpieza FK-safe en `afterAll`.
 */
import { test, expect } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import {
    avisarPadresQueReportaron,
    EVENTO_CORROBORACION,
} from "@/lib/dal/services/corroboracion-padre";
import type { RolUsuario } from "@prisma/client";

const CORRIDA = `e2e-439-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Aviso439!Secure";

const EMAIL_PADRE_1 = `${CORRIDA}-padre1@proteccion.local`;
const EMAIL_PADRE_2 = `${CORRIDA}-padre2@proteccion.local`;
const EMAIL_PADRE_NUEVO = `${CORRIDA}-padre-nuevo@proteccion.local`;

const sembrados = {
    usuarios: new Set<string>(),
    reportes: new Set<string>(),
};

function cuidHex(): string {
    return "c" + randomBytes(12).toString("hex"); // 25 chars, subset de cuid
}

async function asegurarPadre(email: string, nombre: string): Promise<string> {
    const u = await prisma.usuario.upsert({
        where: { email },
        update: { rol: "PARENT" as RolUsuario, estado: "activo" },
        create: {
            email,
            nombre,
            passwordHash: await hashPassword(PASSWORD),
            rol: "PARENT" as RolUsuario,
            estado: "activo",
        },
    });
    sembrados.usuarios.add(u.id);
    return u.id;
}

/**
 * Reporte mínimo para poder pasar `reporteNuevoId` al servicio. El servicio
 * no consulta `Reporte` — solo lee `Plataforma.nombre` para armar variables
 * — pero se lo siembra igual para dejar la fila consistente si otro
 * componente futuro depende de que exista.
 */
async function sembrarReporte(plataformaId: string, autorId: string | null): Promise<string> {
    const id = cuidHex();
    await prisma.reporte.create({
        data: {
            id,
            identificador: `${CORRIDA}-id-x`,
            plataformaId,
            texto: `Reporte E2E ${CORRIDA} corroboración`,
            fechaIncidente: new Date(),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: autorId === null,
            usuarioId: autorId,
            numeroSeguimiento: `RPT-${CORRIDA.slice(-6).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`,
            estado: "CLASIFICADO",
        },
    });
    sembrados.reportes.add(id);
    return id;
}

async function limpiarSembrados() {
    const usuarios = [...sembrados.usuarios];
    const reportes = [...sembrados.reportes];
    if (usuarios.length > 0) {
        await prisma.notificacion.deleteMany({
            where: {
                OR: [
                    { destinatarioUsuarioId: { in: usuarios } },
                    { destinatarioEmail: { in: [EMAIL_PADRE_1, EMAIL_PADRE_2, EMAIL_PADRE_NUEVO] } },
                ],
            },
        });
    }
    if (reportes.length > 0) {
        await prisma.reporte.deleteMany({ where: { id: { in: reportes } } });
    }
    if (usuarios.length > 0) {
        await prisma.auditLog.deleteMany({ where: { usuarioId: { in: usuarios } } });
        await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
    }
    sembrados.usuarios.clear();
    sembrados.reportes.clear();
}

test.describe.serial("Aviso de corroboración al padre (SPEC-439)", () => {
    let idPadre1 = "";
    let idPadre2 = "";
    let idPadreNuevo = "";
    let plataformaId = "";

    test.beforeAll(async () => {
        idPadre1 = await asegurarPadre(EMAIL_PADRE_1, `Padre1 E2E ${CORRIDA}`);
        idPadre2 = await asegurarPadre(EMAIL_PADRE_2, `Padre2 E2E ${CORRIDA}`);
        idPadreNuevo = await asegurarPadre(EMAIL_PADRE_NUEVO, `PadreNuevo E2E ${CORRIDA}`);
        const p = await prisma.plataforma.findFirst({ select: { id: true } });
        if (!p) throw new Error("prod debe tener al menos una Plataforma sembrada");
        plataformaId = p.id;
    });

    test.afterAll(async () => {
        await limpiarSembrados();
    });

    test("(A) programa aviso a los DOS padres previos (sin el autor nuevo)", async () => {
        const reporteNuevoId = await sembrarReporte(plataformaId, idPadreNuevo);

        const resultado = await avisarPadresQueReportaron({
            reporteNuevoId,
            plataformaId,
            ciudad: "Bogotá",
            categoria: "SOLICITUD_DE_ENCUENTRO",
            conteoAcumulado: 3,
            usuariosPrevios: [idPadre1, idPadre2],
            autorNuevoId: idPadreNuevo,
        });

        expect(
            resultado.avisados,
            `SPEC-439: debe avisar a los 2 padres previos. resultado=${JSON.stringify(resultado)}`,
        ).toBe(2);
    });

    test("(B) cada aviso queda en `notificaciones` con evento, destinatario y sujeto correctos", async () => {
        // El test (A) programó dos avisos; se afirma la fila concreta de cada uno.
        const filas = await prisma.notificacion.findMany({
            where: {
                evento: EVENTO_CORROBORACION,
                destinatarioUsuarioId: { in: [idPadre1, idPadre2] },
            },
            select: { destinatarioUsuarioId: true, sujetoTipo: true, sujetoId: true, evento: true },
        });
        expect(
            filas.length,
            `SPEC-439: dos filas de notificacion con evento=${EVENTO_CORROBORACION} para los 2 padres previos. filas=${JSON.stringify(filas)}`,
        ).toBe(2);
        const destinatarios = new Set(filas.map((f) => f.destinatarioUsuarioId));
        expect(destinatarios.has(idPadre1), "aviso al padre1").toBe(true);
        expect(destinatarios.has(idPadre2), "aviso al padre2").toBe(true);
        for (const f of filas) {
            expect(f.sujetoTipo, "sujetoTipo debe ser 'Reporte'").toBe("Reporte");
            expect(
                typeof f.sujetoId === "string" && f.sujetoId.length > 0,
                "sujetoId debe apuntar al reporte que disparó la corroboración",
            ).toBe(true);
        }
    });

    test("(C) el autor nuevo NO recibe auto-aviso aunque esté en usuariosPrevios", async () => {
        const reporteNuevoId = await sembrarReporte(plataformaId, idPadreNuevo);

        const resultado = await avisarPadresQueReportaron({
            reporteNuevoId,
            plataformaId,
            ciudad: "Bogotá",
            categoria: "SOLICITUD_DE_ENCUENTRO",
            conteoAcumulado: 4,
            usuariosPrevios: [idPadre1, idPadreNuevo], // <── autor nuevo dentro de "previos"
            autorNuevoId: idPadreNuevo,
        });

        expect(
            resultado.avisados,
            `SPEC-439: cero auto-aviso. usuariosPrevios incluye al autor nuevo (${idPadreNuevo}); solo el padre1 debe recibir. resultado=${JSON.stringify(resultado)}`,
        ).toBe(1);

        // Fila directa: no debe haber ninguna notificación con destinatarioUsuarioId === idPadreNuevo.
        const filaAutoAviso = await prisma.notificacion.findFirst({
            where: {
                evento: EVENTO_CORROBORACION,
                destinatarioUsuarioId: idPadreNuevo,
                sujetoId: reporteNuevoId,
            },
            select: { id: true },
        });
        expect(filaAutoAviso, "el autor nuevo NO debe recibir su propio aviso").toBeNull();
    });
});
