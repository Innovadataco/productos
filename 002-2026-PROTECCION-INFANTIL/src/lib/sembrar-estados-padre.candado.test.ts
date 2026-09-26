/**
 * SPEC-722 · CANDADO de la siembra de estados del padre (+e2epadre).
 *
 * Prueba de conducta, contra la BD, de lo que el CEO corre en prod:
 *  - SOLO cuentas `+e2epadre` (por construcción): un PARENT sin ese patrón NO se toca.
 *  - Los 5 estados quedan: hijo con cuenta activa+plataforma + reporte de OTRO que CRUZA
 *    (I-429, se ve por `listarCuentasReportadasPorOtros` → enciende el ámbar), círculo con
 *    2 reportados, cita CONFIRMADA, el padre marcado sembrado (ve profesionales demo), y una
 *    suscripción ACTIVA (si no, cae a /camino/plan y no alcanza Mis-citas — SPEC-730/731).
 *  - Idempotente: la 2ª corrida no duplica (yaSembrado corta).
 *  - Todo marcado en demo_marcado (corrida e2epadre-722) → purgable, no cuenta como real.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { listarCuentasReportadasPorOtros } from "@/lib/dal/services/hijos/reportes-ajenos";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { prisma as demoPrisma } from "../../scripts/demo-prod/lib/prisma";
import { purgar } from "../../scripts/demo-prod/purgar-demo";
import { marcarDemo } from "../../scripts/demo-prod/lib/marcar";
import { limpiarEstado } from "../../scripts/demo-prod/limpiar-estado-padre-e2e";
import {
    padresE2E,
    yaSembrado,
    sembrarPadre,
    resolverBase,
    asegurarOtroReportante,
    asegurarProfConFranjas,
    CORRIDA,
    CORRIDA_CUENTAS,
    HIJO_NOMBRE,
} from "../../scripts/demo-prod/sembrar-estados-padre";

async function sembrarBase() {
    // resetDatabase ya siembra la plataforma whatsapp + permisos; falta país/ciudad/admin.
    const pais = await prisma.pais.upsert({ where: { codigo: "CO" }, update: {}, create: { codigo: "CO", nombre: "Colombia" } });
    const bogota = await prisma.ciudad.findFirst({ where: { nombre: "Bogotá", paisId: pais.id }, select: { id: true } });
    if (!bogota) {
        await prisma.ciudad.create({ data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id } });
    }
    const admin = await crearUsuario("ADMIN", `admin.${Date.now()}@ejemplo.local`);
    // resetDatabase NO siembra planes; el padre necesita un plan PADRE activo para su suscripción.
    const anio = new Date().getFullYear();
    await prisma.plan.upsert({
        where: { tipoTitular_duracion_anio: { tipoTitular: "PADRE", duracion: "MES_1", anio } },
        update: {},
        // `precio` (legacy) es NOT NULL en la BD aunque el schema lo marca opcional; se pasa 0.
        create: { nombre: "Demo PADRE MES_1", tipoTitular: "PADRE", duracion: "MES_1", anio, precioBaseUSD: 0, precio: 0, activo: true, creadoPorAdminId: admin.id },
    });
}

/** Mirror del camino --confirm de main() para las cuentas pendientes. */
async function correrSiembra() {
    const padres = await padresE2E();
    const pendientes = [];
    for (const p of padres) if (!(await yaSembrado(p.id))) pendientes.push(p);
    if (pendientes.length === 0) return 0;
    const base = await resolverBase();
    const otro = await asegurarOtroReportante(base);
    const { franjasLibres } = await asegurarProfConFranjas(base, pendientes.length);
    for (let i = 0; i < pendientes.length; i++) {
        await sembrarPadre(base, pendientes[i]!, otro, franjasLibres[i]!);
    }
    return pendientes.length;
}

describe("SPEC-722 · siembra de estados del padre (+e2epadre)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await sembrarBase();
    });
    afterAll(async () => {
        await demoPrisma.$disconnect();
    });

    it("por CONSTRUCCIÓN solo toca +e2epadre: un PARENT sin ese patrón queda intacto", async () => {
        const e2e = await crearUsuario("PARENT", "cal+e2epadre@innovadataco.com");
        const ajeno = await crearUsuario("PARENT", "jelkin.personal@innovadataco.com");

        const seleccion = await padresE2E();
        expect(seleccion.map((p) => p.id)).toContain(e2e.id);
        expect(seleccion.map((p) => p.id)).not.toContain(ajeno.id);

        await correrSiembra();
        // El ajeno no recibió NADA.
        expect(await prisma.hijo.count({ where: { usuarioId: ajeno.id } })).toBe(0);
        expect(await prisma.contactoConfianza.count({ where: { usuarioId: ajeno.id } })).toBe(0);
        expect(await prisma.demoMarcado.findFirst({ where: { entidad: "Usuario", entidadId: ajeno.id } })).toBeNull();
    });

    it("deja los 5 estados; el reporte de OTRO CRUZA (I-429) y enciende el ámbar del hijo", async () => {
        const padre = await crearUsuario("PARENT", "cal+e2epadre@innovadataco.com");
        await correrSiembra();

        // (1) hijo con cuenta activa + plataforma.
        const hijo = await prisma.hijo.findFirstOrThrow({ where: { usuarioId: padre.id, nombre: HIJO_NOMBRE }, select: { id: true } });
        const ident = await prisma.identificadorHijo.findFirstOrThrow({ where: { hijoId: hijo.id }, select: { activo: true, plataformaId: true } });
        expect(ident.activo).toBe(true);
        expect(ident.plataformaId).not.toBeNull();

        // (1-clave) el reporte de OTRO se VE por reportes-ajenos → ámbar/SPEC-716A.
        const cuentas = await listarCuentasReportadasPorOtros(padre.id);
        expect(cuentas.length, "el hijo tiene al menos una cuenta con reportes de otros").toBeGreaterThan(0);
        expect(cuentas.some((h) => h.cuentas.length > 0)).toBe(true);

        // (2) círculo con 2 reportados.
        expect(await prisma.contactoConfianza.count({ where: { usuarioId: padre.id } })).toBe(2);

        // (3) una cita CONFIRMADA.
        expect(await prisma.solicitudCita.count({ where: { padreUsuarioId: padre.id, estado: "CONFIRMADA" } })).toBe(1);

        // (4) el padre marcado sembrado (ve profesionales demo) EN LA CORRIDA PERSISTENTE de cuentas,
        // no en la del estado purgable → la purga del estado NO se lleva la cuenta fija.
        const marcaPadre = await prisma.demoMarcado.findFirst({ where: { entidad: "Usuario", entidadId: padre.id } });
        expect(marcaPadre, "el padre queda marcado como visor demo (SPEC-655)").not.toBeNull();
        expect(
            (marcaPadre?.metadata as { corrida?: string } | null)?.corrida,
            "la cuenta se marca en la corrida PERSISTENTE, no en la del estado",
        ).toBe(CORRIDA_CUENTAS);

        // el ESTADO (hijo, reportes, …) va en la corrida purgable e2epadre-722.
        const marca = await prisma.demoMarcado.findFirst({ where: { entidad: "Hijo", entidadId: hijo.id } });
        expect((marca?.metadata as { corrida?: string } | null)?.corrida).toBe(CORRIDA);

        // (5) suscripción ACTIVA → /camino/plan NO dispara y Mis-citas queda alcanzable (SPEC-730/731).
        // Se prueba con la MISMA consulta que arma la cookie de vigencia: obtenerSuscripcionActivaPorUsuarioId.
        const suscActiva = await new PagosRepository().obtenerSuscripcionActivaPorUsuarioId(padre.id);
        expect(suscActiva, "el padre queda con suscripción activa (si no, cae a /camino/plan)").not.toBeNull();
        expect(suscActiva?.estado, "vigencia ACTIVA → Mis-citas alcanzable").toBe("ACTIVA");
        expect(await prisma.suscripcion.count({ where: { usuarioId: padre.id } }), "camino paso 4 exige count>0").toBe(1);
        const marcaSusc = await prisma.demoMarcado.findFirst({ where: { entidad: "Suscripcion", entidadId: suscActiva!.id } });
        expect((marcaSusc?.metadata as { corrida?: string } | null)?.corrida, "suscripción en la corrida purgable").toBe(CORRIDA);
    });

    it("IDEMPOTENTE: la 2ª corrida no duplica hijo, círculo, cita ni suscripción", async () => {
        const padre = await crearUsuario("PARENT", "cal+e2epadre@innovadataco.com");
        const n1 = await correrSiembra();
        expect(n1).toBe(1);
        expect(await yaSembrado(padre.id)).toBe(true);

        const n2 = await correrSiembra();
        expect(n2, "la 2ª corrida no siembra a nadie").toBe(0);
        expect(await prisma.hijo.count({ where: { usuarioId: padre.id, nombre: HIJO_NOMBRE } })).toBe(1);
        expect(await prisma.contactoConfianza.count({ where: { usuarioId: padre.id } })).toBe(2);
        expect(await prisma.solicitudCita.count({ where: { padreUsuarioId: padre.id } })).toBe(1);
        expect(await prisma.suscripcion.count({ where: { usuarioId: padre.id } })).toBe(1);
    });

    it("ATÓMICO: si la siembra de un padre falla a mitad, rollback COMPLETO (nada marcado) y el re-run sana", async () => {
        const padre = await crearUsuario("PARENT", "cal+e2epadre@innovadataco.com");
        const base = await resolverBase();
        const otroId = await asegurarOtroReportante(base);

        // Falla TARDÍA dentro de la transacción (franja inexistente = estado 3), ya creados el hijo +
        // reporte + círculo: si NO fuera atómico, el hijo quedaría y yaSembrado mentiría (el bug real).
        await expect(sembrarPadre(base, padre, otroId, "franja-inexistente-xyz")).rejects.toThrow();

        // Rollback COMPLETO: ni hijo, ni contactos, ni la marca del padre. yaSembrado sigue en false.
        expect(await yaSembrado(padre.id)).toBe(false);
        expect(await prisma.hijo.count({ where: { usuarioId: padre.id } })).toBe(0);
        expect(await prisma.contactoConfianza.count({ where: { usuarioId: padre.id } })).toBe(0);
        expect(await prisma.demoMarcado.findFirst({ where: { entidad: "Usuario", entidadId: padre.id } })).toBeNull();

        // Sana: con una franja real, el re-run lo siembra entero (la falla no lo dejó bloqueado).
        const { franjasLibres } = await asegurarProfConFranjas(base, 1);
        await sembrarPadre(base, padre, otroId, franjasLibres[0]!);
        expect(await yaSembrado(padre.id)).toBe(true);
        expect(await prisma.solicitudCita.count({ where: { padreUsuarioId: padre.id, estado: "CONFIRMADA" } })).toBe(1);
    });

    it("numeroSeguimiento ÚNICO por reporte: 2 cuentas +e2epadre no colisionan (bug del 25-09)", async () => {
        await crearUsuario("PARENT", "cal+e2epadre1@innovadataco.com");
        await crearUsuario("PARENT", "cal+e2epadre2@innovadataco.com");

        const n = await correrSiembra();
        expect(n, "siembra las 2 cuentas sin reventar por colisión de numeroSeguimiento").toBe(2);

        // 2 cuentas × 3 reportes (hijo + 2 del círculo) = 6, cada uno con RPT-XXXXXX ÚNICO y en formato.
        const nums = (await prisma.reporte.findMany({ select: { numeroSeguimiento: true } })).map((r) => r.numeroSeguimiento);
        expect(nums.length).toBe(6);
        expect(nums.every((x) => x !== null && /^RPT-[A-Z0-9]{6}$/.test(x))).toBe(true);
        expect(new Set(nums).size, "todos los numeroSeguimiento distintos (sin colisión)").toBe(nums.length);
    });

    it("purgar el ESTADO (corrida e2epadre-722) limpia lo sembrado pero DEJA viva la cuenta +e2epadre", async () => {
        const padre = await crearUsuario("PARENT", "cal+e2epadre@innovadataco.com");
        await correrSiembra();
        expect(await yaSembrado(padre.id)).toBe(true);

        // Lo que corre el CEO para «dejar limpio» antes del re-run.
        await purgar({ corrida: CORRIDA });

        // La cuenta fija de Calidad SIGUE viva y marcada como visor demo (SPEC-655) → el re-run puede
        // volver a sembrarla. Si el estado y la cuenta compartieran corrida, esto sería null (bug).
        expect(await prisma.usuario.findUnique({ where: { id: padre.id } }), "la cuenta +e2epadre NO se borra con el estado").not.toBeNull();
        expect(await prisma.demoMarcado.findFirst({ where: { entidad: "Usuario", entidadId: padre.id } }), "sigue marcada como visor demo").not.toBeNull();

        // El ESTADO sembrado sí se fue: sin hijo → yaSembrado false → reintentable.
        expect(await yaSembrado(padre.id)).toBe(false);
        expect(await prisma.hijo.count({ where: { usuarioId: padre.id } })).toBe(0);
        expect(await prisma.solicitudCita.count({ where: { padreUsuarioId: padre.id } })).toBe(0);
        expect(await prisma.contactoConfianza.count({ where: { usuarioId: padre.id } })).toBe(0);
    });

    it("limpieza state-only: borra el ESTADO parcial (marcado 722) pero DEJA viva la cuenta fija +e2epadre", async () => {
        // Simula el PARCIAL del código VIEJO: la cuenta +e2epadre marcada Usuario/722 + un hijo 722
        // + un actor demo (otro) 722. La limpieza debe quitar el estado y PRESERVAR la cuenta fija.
        const padre = await crearUsuario("PARENT", "cal+e2epadre@innovadataco.com");
        const otro = await crearUsuario("PARENT", "soporte+e2e-otro@innovadataco.com");
        await marcarDemo("Usuario", padre.id, { corrida: CORRIDA, script: "viejo" }); // como el código viejo
        await marcarDemo("Usuario", otro.id, { corrida: CORRIDA, script: "viejo" });
        const hijo = await prisma.hijo.create({ data: { usuarioId: padre.id, nombre: HIJO_NOMBRE, apellidos: "Demo" }, select: { id: true } });
        await marcarDemo("Hijo", hijo.id, { corrida: CORRIDA, script: "viejo" });

        await limpiarEstado({ dryRun: false });

        // La cuenta fija SIGUE viva y SIN marca (desmarcada) → el re-run la re-siembra bajo e2epadre-cuentas.
        expect(await prisma.usuario.findUnique({ where: { id: padre.id } }), "la cuenta +e2epadre NO se borra").not.toBeNull();
        expect(await prisma.demoMarcado.findFirst({ where: { entidad: "Usuario", entidadId: padre.id } }), "queda desmarcada").toBeNull();
        // El estado y los actores demo (no +e2epadre) sí se fueron.
        expect(await prisma.hijo.count({ where: { usuarioId: padre.id } })).toBe(0);
        expect(await prisma.usuario.findUnique({ where: { id: otro.id } }), "el actor demo (no +e2epadre) sí se borra").toBeNull();
        expect(await prisma.demoMarcado.count({ where: { metadata: { path: ["corrida"], equals: CORRIDA } } })).toBe(0);
    });
});
