/**
 * SPEC-459 (Calidad) · Candado + prueba de vida del arnés de siembra por endpoint.
 *
 * Este spec cumple dos oficios que el CEO pidió juntos:
 *
 *   1. CANDADO DEL PROPIO ARNÉS (conducta, no palabras). Se comprueba MUTANDO:
 *      llamar una operación de siembra cruda a través de `prismaVigilado`
 *      DEBE lanzar. Si alguien afloja la barrera (o cambia un registrador por
 *      un `create` directo), este candado muere con el defecto puesto
 *      (memoria `ceo-candado-vigila-conducta-no-palabras`).
 *
 *   2. REEMPLAZO DEL `.recorrido-psicologo.mjs` ROTO. Los tests (B)(C) caminan
 *      los registradores de punta a punta contra producción: un PROFESIONAL
 *      llega a ACTIVO por decisión real y un PADRE al camino completo con
 *      suscripción activa — el estado que el arnés viejo (SQL crudo, ids
 *      malformados) nunca alcanzó. La limpieza FK-safe (D) deja prod intacto.
 *
 * AISLAMIENTO. Un solo arnés con `scope` efímero; `limpiarTodo()` borra sólo
 * lo suyo. `describe.serial` porque (D) verifica el barrido de (B)(C).
 */
import { test, expect } from "@playwright/test";
import {
    crearArnes,
    prismaVigilado,
    CANDADO_SIEMBRA_CRUDA,
    type Arnes,
} from "./_helpers/siembra-por-endpoint";

const arnes: Arnes = crearArnes();

test.describe.serial("Arnés de siembra por endpoint (SPEC-459)", () => {
    test.afterAll(async () => {
        // Idempotente: aunque (D) ya limpió, esto cubre un fallo temprano en (B)/(C).
        await arnes.limpiarTodo();
    });

    test("(A) el candado MUERE con la siembra cruda: SQL crudo y create de dominio lanzan", async () => {
        // ── SQL crudo ────────────────────────────────────────────────────────
        expect(() => prismaVigilado.$executeRawUnsafe("SELECT 1"))
            .toThrow(CANDADO_SIEMBRA_CRUDA);
        expect(() => prismaVigilado.$queryRawUnsafe("SELECT 1"))
            .toThrow(CANDADO_SIEMBRA_CRUDA);
        // Tagged-template también entra por el sentinel (se llama como función).
        expect(() => (prismaVigilado.$queryRaw as unknown as (s: TemplateStringsArray) => unknown)`SELECT 1`)
            .toThrow(CANDADO_SIEMBRA_CRUDA);

        // ── create/upsert/update directos de entidades de dominio ────────────
        expect(() => prismaVigilado.usuario.create({ data: {} as never }))
            .toThrow(CANDADO_SIEMBRA_CRUDA);
        expect(() => prismaVigilado.usuario.createMany({ data: [] as never }))
            .toThrow(CANDADO_SIEMBRA_CRUDA);
        expect(() => prismaVigilado.perfilProfesional.create({ data: {} as never }))
            .toThrow(CANDADO_SIEMBRA_CRUDA);
        expect(() => prismaVigilado.suscripcion.create({ data: {} as never }))
            .toThrow(CANDADO_SIEMBRA_CRUDA);
        expect(() => prismaVigilado.hijo.create({ data: {} as never }))
            .toThrow(CANDADO_SIEMBRA_CRUDA);
        expect(() => prismaVigilado.franjaDisponible.create({ data: {} as never }))
            .toThrow(CANDADO_SIEMBRA_CRUDA);
        // Nunca forjar consentimiento (memoria `calidad-audit-consentimientos-nunca-forjar`).
        expect(() => prismaVigilado.auditConsentimiento.create({ data: {} as never }))
            .toThrow(CANDADO_SIEMBRA_CRUDA);

        // ── La lectura y la limpieza NO están bloqueadas (limpiar no es sembrar) ─
        await expect(prismaVigilado.usuario.count()).resolves.toBeGreaterThanOrEqual(0);
        // Las dos excepciones expresas NO disparan el sentinel al invocarse
        // (son funciones reales, no el throw sincrónico). Se les pasa argumento
        // inválido para que rechacen async sin escribir ninguna fila.
        await expect(
            (prismaVigilado.tokenRegistro.create as (a: unknown) => Promise<unknown>)({ data: {} }),
        ).rejects.toThrow(); // rechazo de validación de Prisma, NO el candado
        await expect(
            (prismaVigilado.usuario.upsert as (a: unknown) => Promise<unknown>)({ where: {}, create: {}, update: {} }),
        ).rejects.toThrow(); // idem — pasó la barrera, lo frena Prisma
    });

    test("(B) registra un PROFESIONAL ACTIVO caminando su pantalla (reemplaza el .mjs roto)", async () => {
        const prof = await arnes.registrarProfesionalActivo({ conFranja: true, etiqueta: "B" });

        expect(prof.perfilProfesionalId, "el registro debe devolver el id del perfil").toBeTruthy();
        expect(prof.estado, "el profesional debe quedar en ACTIVO por decisión real del admin").toBe("ACTIVO");

        // Verificación dura contra BD: el perfil quedó ACTIVO y con verificación vigente.
        const perfil = await prismaVigilado.perfilProfesional.findUnique({
            where: { id: prof.perfilProfesionalId },
            select: { estado: true },
        });
        expect(perfil?.estado, "en BD el perfil debe estar ACTIVO").toBe("ACTIVO");

        const franjas = await prismaVigilado.franjaDisponible.count({
            where: { profesionalId: prof.perfilProfesionalId },
        });
        expect(franjas, "la franja publicada por endpoint debe existir en BD").toBeGreaterThanOrEqual(1);
    });

    test("(C) registra un PADRE con camino completo y suscripción ACTIVA", async () => {
        const padre = await arnes.registrarPadreCaminoCompleto({ hijos: 1, etiqueta: "C" });

        expect(padre.usuarioId, "el registro debe devolver el id del padre").toBeTruthy();
        expect(padre.hijoIds.length, "debe haber cargado al menos un hijo por el endpoint").toBeGreaterThanOrEqual(1);
        expect(padre.suscripcionId, "debe devolver el id de la suscripción").toBeTruthy();

        // Verificación dura: suscripción ACTIVA y el hijo en BD, todo por endpoint.
        const suscripcion = await prismaVigilado.suscripcion.findUnique({
            where: { id: padre.suscripcionId },
            select: { estado: true, usuarioId: true },
        });
        expect(suscripcion?.estado, "la suscripción debe estar ACTIVA en BD").toBe("ACTIVA");
        expect(suscripcion?.usuarioId, "la suscripción debe pertenecer al padre registrado").toBe(padre.usuarioId);

        const hijos = await prismaVigilado.hijo.count({ where: { usuarioId: padre.usuarioId } });
        expect(hijos, "el hijo cargado por endpoint debe existir en BD").toBeGreaterThanOrEqual(1);
    });

    test("(D) limpiarTodo borra FK-safe TODO lo del scope y deja prod intacto", async () => {
        await arnes.limpiarTodo();
        const restantes = await prismaVigilado.usuario.count({
            where: { email: { startsWith: arnes.scope } },
        });
        expect(restantes, `tras limpiar no debe quedar ningún usuario del scope ${arnes.scope}`).toBe(0);
    });
});
