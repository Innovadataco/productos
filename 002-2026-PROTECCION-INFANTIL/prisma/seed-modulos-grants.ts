/**
 * Backfill del catálogo de módulos y grants por rol — FUENTE ÚNICA DE VERDAD.
 * Usado por `prisma/seed.ts` y por `scripts/sync-modulos-grants.ts` (002-PI-048).
 * ADITIVO e idempotente: crea módulos y grants faltantes, NUNCA revoca ni borra.
 */
import { PrismaClient, TipoParametro, CategoriaParametro } from "@prisma/client";
import { CATALOGO_MODULOS } from "../src/lib/permisos-catalogo";

export interface ResultadoSyncModulos {
    modulosCatalogo: number;
    modulosCreados: number;
    permisosCreados: number;
}

/**
 * SPEC-435 (Jelkin vivo 04-09) · Fuente ÚNICA de grants por rol. Extraída como
 * constante exportada para permitir candados permanentes que verifiquen los
 * grants sin duplicar la lista.
 *
 * Lección I-278/I-299: el menú del VERIFICADOR no puede mostrar ítems de
 * operador, comité o padre — y el defecto que llevó a I-299 fue justamente que
 * el rol PROFESIONAL heredaba `PADRE_NAV_ITEMS`. Acá el nav se filtra por
 * `modulosPermitidosParaRol`, así que si esta lista se contamina, el menú se
 * contamina; el candado `verificador-modulos.candado.test.ts` (SPEC-435) lo
 * bloquea al PR.
 */
export const CLAVES_POR_ROL: Record<string, string[]> = {
    // SPEC-381 (I-274 · separación de poderes): quien modera NO aprueba sus
    // propias guías. `comite_guias_accion` es exclusivo del rol
    // COMITE_VALIDACION; sacarlo de la lista del ADMIN evita el descuadre
    // que dejaba la pestaña Guías visible para él y el endpoint le
    // respondía 403.
    ADMIN: CATALOGO_MODULOS.map((m) => m.clave).filter((c) => c !== "comite_guias_accion"),
    SCHOOL_ADMIN: ["colegios", "colegios_gestion", "colegios_auditoria", "colegios_comite", "colegios_comite_bandeja", "colegios_onboarding", "colegios_notificaciones"],
    // SPEC-168 (Fase F): el Comité de Convivencia accede solo a su bandeja de casos.
    // I-57 (SPEC-175): la jerarquía de módulos es AND (padre ∧ hijo) y
    // colegios_comite_bandeja tiene padre `colegios` — sin el padre el rol
    // quedaba inoperante (menú vacío, "Sin acceso al módulo").
    COMITE_CONVIVENCIA: ["colegios", "colegios_comite_bandeja"],
    // SPEC-128 (D-43): el comité solo recibe su bandeja. "comite" y "comite_auditoria"
    // mapean a rutas ADMIN_ONLY (proxy.ts) que la puerta le niega: el seed ya no dice
    // SÍ donde la puerta dice NO. Los módulos siguen en el catálogo (ADMIN los usa) y
    // las BD existentes se reconcilian con scripts/revocar-grants-comite-muertos.ts.
    // SPEC-235 (002-PI-135): el comité de validación aprueba/rechaza guías de acción.
    // SPEC-263 (002-PI-164): expediente_revelar_original otorgado al comité para revisar texto en casos escalados.
    // SPEC-266 (002-PI-169): bandeja_reportes y denuncia_formal eran indebidos (I-128); revocados en BD viva por revocar-grants-pagos-operador.ts.
    // SPEC-496 (decisión CEO): `comite_auditoria` queda FUERA a propósito — el
    // comité valida y quien valida no audita su propia validación (separación de
    // funciones). No es un olvido; ver el comentario junto al tab en nav-items.ts.
    COMITE_VALIDACION: ["comite", "comite_bandeja", "comite_guias_accion", "expediente_revelar_original", "centro_control_ia", "ia_rubrica"],  // SPEC-452 (I-318): lee la rúbrica. Padre centro_control_ia + hijo ia_rubrica (jerarquía AND); abre solo la pestaña Rúbrica del Centro IA. Escritura cerrada por rol ADMIN (D-102).
    // SPEC-263 (002-PI-164): pagos_admin quitado de OPERADOR (la revocación en BD viva requiere scripts/revocar-grants-pagos-operador.ts).
    // expediente_revelar_original añadido para que el operador valide spam o dudas de contexto.
    OPERADOR: ["bandeja_reportes", "expediente_revelar_original", "revision_spam"],  // SPEC-452 (I-317): revisar spam es un resultado de clasificación del operador.
    // SPEC-408 (A-75 · brief §9): el Verificador tiene perfil equivalente al
    // Operador — un SOLO módulo cubre solicitudes por revisar + incidentes
    // de citas (Jelkin: un rol, una persona, un trabajo — lección I-278).
    // SPEC-435 (Jelkin vivo 04-09): la cuenta VERIFICADOR nace con
    // `admin_verificacion_profesionales` y NADA MÁS — no hereda módulos de
    // admin (ni pagos, ni operadores, ni comité, ni padres). El candado
    // `verificador-modulos.candado.test.ts` protege este contrato.
    VERIFICADOR: ["admin_verificacion_profesionales"],
    // SPEC-437 (A-75): el profesional trabaja con menú lateral, misma mecánica
    // que el operador. La lista es EXACTAMENTE los módulos que `PROFESIONAL_NAV_ITEMS`
    // pinta — ni uno más ni uno menos: un grant sin ítem de menú es acceso a una
    // superficie sin camino, y uno con ítem pero sin pantalla es la promesa rota
    // de I-299. `profesional_calendario` entra ahora (T013) porque SPEC-447 (#353)
    // desplegó su pantalla y su ítem ya está en el nav: cada uno de los 6 tiene
    // pantalla real, así que least-privilege se cumple igual.
    PROFESIONAL: [
        "profesional_inicio",
        "profesional_citaciones",
        "profesional_casos",
        "profesional_calendario",
        "profesional_ficha",
        "profesional_verificacion",
    ],
};

export async function syncModulosYGrants(prisma: PrismaClient): Promise<ResultadoSyncModulos> {
    // ── Permisos de módulos por rol (spec 019) ─────────────────────────────
    const modulosSeed = CATALOGO_MODULOS;
    let modulosCreados = 0;

    const moduloIds = new Map<string, string>();
    for (const m of modulosSeed.filter((x) => !x.padre)) {
        const existente = await prisma.moduloPermisible.findUnique({ where: { clave: m.clave }, select: { id: true } });
        if (!existente) modulosCreados++;
        const row = await prisma.moduloPermisible.upsert({
            where: { clave: m.clave },
            update: { nombre: m.nombre, categoria: m.categoria, esCritico: m.esCritico ?? false, orden: m.orden },
            create: { clave: m.clave, nombre: m.nombre, categoria: m.categoria, esCritico: m.esCritico ?? false, orden: m.orden },
        });
        moduloIds.set(m.clave, row.id);
    }
    for (const m of modulosSeed.filter((x) => x.padre)) {
        const padreId = moduloIds.get(m.padre!);
        if (!padreId) throw new Error(`Padre no encontrado para ${m.clave}`);
        const existente = await prisma.moduloPermisible.findUnique({ where: { clave: m.clave }, select: { id: true } });
        if (!existente) modulosCreados++;
        const row = await prisma.moduloPermisible.upsert({
            where: { clave: m.clave },
            update: { nombre: m.nombre, categoria: m.categoria, esCritico: m.esCritico ?? false, orden: m.orden, padreId },
            create: { clave: m.clave, nombre: m.nombre, categoria: m.categoria, esCritico: m.esCritico ?? false, orden: m.orden, padreId },
        });
        moduloIds.set(m.clave, row.id);
    }

    // Backfill: reproduce el acceso implícito actual por rol (denegar por defecto al resto).
    let permisosCreados = 0;
    for (const [rol, claves] of Object.entries(CLAVES_POR_ROL)) {
        for (const clave of claves) {
            const moduloId = moduloIds.get(clave)!;
            const existente = await prisma.permisoModulo.findUnique({
                where: { rol_moduloId: { rol, moduloId } },
            });
            if (!existente) {
                await prisma.permisoModulo.create({
                    data: { rol, moduloId, activo: true },
                });
                permisosCreados++;
            }
        }
    }

    await prisma.parametroSistema.upsert({
        where: { clave: "seguridad.permisos_roles_protegidos" },
        update: {},
        create: {
            clave: "seguridad.permisos_roles_protegidos",
            valor: JSON.stringify(["ADMIN"]),
            tipo: TipoParametro.STRING_ARRAY,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Roles protegidos por el anti-lockout de permisos de módulos",
        },
    });

    return { modulosCatalogo: modulosSeed.length, modulosCreados, permisosCreados };
}
