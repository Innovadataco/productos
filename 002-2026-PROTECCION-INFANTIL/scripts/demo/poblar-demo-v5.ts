/**
 * SPEC-412 · POBLADOR v5 — el primero que marca lo que siembra.
 *
 *   dry-run (por defecto — dice qué haría, no escribe):
 *     node --env-file=.env.test --import tsx scripts/demo/poblar-demo-v5.ts \
 *       --motivo="poblar demo v5 para recorrer el comité"
 *   real:
 *     ... --confirm
 *
 * Las tres diferencias con v1…v4, que son toda la spec:
 *
 *  1) **Las llaves primarias son `cuid()` de verdad.** Este archivo no escribe
 *     ni un `id:` — las pone Prisma y se recuperan con `createManyAndReturn`.
 *     v1 las fabricaba (`demo-c-01`, `demo3-sol-…`) y por eso 254 casos del
 *     comité no abren: `cuidIdSchema` los rechaza, con razón (I-292).
 *  2) **Todo lo que se crea queda en `demo_marcado`**, en la MISMA transacción.
 *  3) **La idempotencia la da la corrida, no el id.** Si la corrida ya está
 *     sembrada, esto aborta y dice qué correr para limpiar.
 *
 * Candados heredados de v1 que siguen vigentes:
 *  · Cero correos: `PreferenciaAlertaColegio.habilitado = false` para todas.
 *  · `ClasificacionIA` insertada DIRECTA — jamás pg-boss ni Ollama (R16).
 *  · INTOCABLES verificados antes de escribir.
 *  · Textos sintéticos sin PII, cifrados por el camino normal.
 *  · Sin fechas futuras.
 *
 * NO siembra profesionales de la Red de Apoyo: orden de Jelkin del 03-09-2026,
 * esperan a que el módulo esté probado.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../../src/lib/auth";
import { rng, pick, parseArgs, requerirMotivo, log, registrarAuditoriaDemo, fechaAtras } from "./_common";
import { marcar, existeCorrida, CORRIDA_V5, INTOCABLES } from "./_marcado";
import {
    DEMO5,
    CIUDADES_DEMO4,
    PAISES_DEMO4,
    nitColegioV5,
    nombreColegioV5,
    emailAdminV5,
    emailComiteV5,
    emailPadreV5,
} from "./_common-v5";
import { sembrarCasos, type SujetoSembrado, type CiudadResuelta } from "./_poblar-v5-casos";
import { asegurarPlanes, sembrarPagos, verificarCuadre, type PlanUsable } from "./_poblar-v5-pagos";

const prisma = new PrismaClient();
const SCRIPT = "poblar-demo-v5";
const OPC = { corrida: CORRIDA_V5, script: SCRIPT };

export interface ConteosV5 {
    tenants: number; colegios: number; admins: number; comites: number;
    onboarding: number; suscripciones: number; preferencias: number;
    cursos: number; profesores: number; identProf: number;
    alumnos: number; identEst: number; acudientes: number; identAcu: number;
    padres: number; contactos: number; identContacto: number;
    reportes: number; clasificaciones: number; alertas: number;
    transiciones: number; solicitudes: number;
    reincidentes: number; encadenados: number;
    planesCreados: number; pagos: number; pagosAutorizados: number;
}

function conteosVacios(): ConteosV5 {
    return {
        tenants: 0, colegios: 0, admins: 0, comites: 0, onboarding: 0, suscripciones: 0,
        preferencias: 0, cursos: 0, profesores: 0, identProf: 0, alumnos: 0, identEst: 0,
        acudientes: 0, identAcu: 0, padres: 0, contactos: 0, identContacto: 0,
        reportes: 0, clasificaciones: 0, alertas: 0, transiciones: 0, solicitudes: 0,
        reincidentes: 0, encadenados: 0,
        planesCreados: 0, pagos: 0, pagosAutorizados: 0,
    };
}

/**
 * La idempotencia del v5. v1 la conseguía con ids deterministas + upsert; acá
 * la da la corrida marcada, porque las llaves ya no las elige el script.
 */
async function guardiaDeCorrida(): Promise<void> {
    if (!(await existeCorrida(prisma, CORRIDA_V5))) return;
    throw new Error(
        `[poblar-v5] La corrida "${CORRIDA_V5}" ya está sembrada. ` +
        "Borrala primero con scripts/demo/borrar-demo-marcado.ts --motivo=\"...\" --confirm. " +
        "No hay --force: borrar es un acto separado y explícito.",
    );
}

/** Los INTOCABLES nunca se tocan; se verifica que sigan ahí antes de escribir. */
async function verificarIntocables(): Promise<void> {
    const colegios = await prisma.colegio.findMany({
        where: { id: { in: [...INTOCABLES.colegios] } },
        select: { id: true },
    });
    for (const c of colegios) log("poblar-v5", `intocable OK: colegio ${c.id} respetado.`);
    const usuarios = await prisma.usuario.findMany({
        where: { email: { in: [...INTOCABLES.emailsUsuario] } },
        select: { email: true },
    });
    for (const u of usuarios) log("poblar-v5", `intocable OK: usuario ${u.email} respetado.`);
}

/**
 * Catálogos reales. BI pidió **10 plataformas y 12+ países / 30+ ciudades**, así
 * que se toman TODAS las plataformas del catálogo y la geografía completa que ya
 * traía v4 (18 países · 100+ ciudades), resuelta contra la BD.
 */
async function cargarCatalogos() {
    const [plataformas, ciudadesBd] = await Promise.all([
        prisma.plataforma.findMany({ select: { id: true, clave: true } }),
        prisma.ciudad.findMany({
            where: { pais: { codigo: { in: [...PAISES_DEMO4] } } },
            select: { id: true, paisId: true, nombre: true, pais: { select: { codigo: true } } },
        }),
    ]);
    if (plataformas.length === 0) throw new Error("[poblar-v5] Sin plataformas en BD — corre el seed antes.");
    if (ciudadesBd.length === 0) throw new Error("[poblar-v5] Sin ciudades en BD — corre el seed antes.");

    const ciudades = new Map<string, CiudadResuelta>(
        ciudadesBd.map((c) => [
            `${c.pais.codigo}:${c.nombre}`,
            { id: c.id, paisId: c.paisId, nombre: c.nombre, codigoPais: c.pais.codigo },
        ]),
    );

    // Igual que v4: si una ciudad del catálogo no está en BD, el reporte quedaría
    // con `paisId=null` — dato sucio para BI. Se aborta antes de escribir nada.
    const faltantes = CIUDADES_DEMO4.filter((c) => !ciudades.has(c));
    if (faltantes.length > 0) {
        log("poblar-v5", `Ciudades del catálogo que NO están en la BD (${faltantes.length}):`);
        for (const c of faltantes.slice(0, 10)) log("poblar-v5", `    · ${c}`);
        throw new Error("[poblar-v5] Corre el seed antes: ningún reporte puede quedar con paisId=null.");
    }

    const ciudadesCO = [...ciudades.values()].filter((c) => c.codigoPais === "CO");
    log("poblar-v5", `catálogos: ${plataformas.length} plataformas · ${ciudades.size} ciudades de ${PAISES_DEMO4.length} países.`);
    return { plataformas, ciudades, ciudadesCO };
}

/**
 * Colegio completo: tenant, colegio, admin, comité, onboarding, suscripción y
 * preferencias de aviso (todas apagadas). Un colegio por transacción: cuando la
 * transacción cierra, ninguna de sus filas quedó sin marcar.
 */
async function sembrarColegio(
    indice: number,
    ciudad: { id: string; paisId: string },
    plan: PlanUsable,
    passwordHash: string,
    r: () => number,
    ahora: Date,
    conteos: ConteosV5,
): Promise<{ colegioId: string; tenantId: string; comiteId: string; suscripcionId: string | null }> {
    const inicioServicio = fechaAtras(r, 24, ahora);
    const vencido = r() < 0.15;
    const finServicio = vencido ? new Date(inicioServicio.getTime() + 365 * 24 * 3600 * 1000) : null;
    const nn = String(indice).padStart(2, "0");

    return prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
            data: { nombre: `tenant-${DEMO5.etiquetaHumana.toLowerCase()}-${nn}`, estado: "activo" },
            select: { id: true },
        });
        await marcar(tx, "Tenant", [tenant.id], OPC);
        conteos.tenants++;

        const colegio = await tx.colegio.create({
            data: {
                nombre: nombreColegioV5(indice),
                nit: nitColegioV5(indice),
                paisId: ciudad.paisId,
                ciudadId: ciudad.id,
                representanteLegalNombre: `Rector ${DEMO5.etiquetaHumana} ${nn}`,
                representanteLegalIdentificacion: `${DEMO5.documentoProfesorBase + indice}`,
                representanteLegalEmail: emailAdminV5(indice),
                representanteLegalTelefono: `+57 300 555${String(2000 + indice)}`,
                inicioServicio,
                finServicio,
                tipoPeriodo: "ANUAL",
                estado: "activo",
                tenantId: tenant.id,
            },
            select: { id: true },
        });
        await marcar(tx, "Colegio", [colegio.id], OPC);
        conteos.colegios++;

        const admin = await tx.usuario.create({
            data: {
                email: emailAdminV5(indice),
                nombre: `Rector ${DEMO5.etiquetaHumana} ${nn}`,
                passwordHash,
                rol: "SCHOOL_ADMIN",
                estado: "activo",
                estadoActivacion: "ACTIVO",
                tenantId: tenant.id,
                colegioId: colegio.id,
            },
            select: { id: true },
        });
        await marcar(tx, "Usuario", [admin.id], { ...OPC, notas: "SCHOOL_ADMIN" });
        conteos.admins++;

        const comite = await tx.usuario.create({
            data: {
                email: emailComiteV5(indice),
                nombre: `Comité Convivencia ${nn}`,
                passwordHash,
                rol: "COMITE_CONVIVENCIA",
                estado: "activo",
                estadoActivacion: "ACTIVO",
                tenantId: tenant.id,
                comiteColegioId: colegio.id,
            },
            select: { id: true },
        });
        await marcar(tx, "Usuario", [comite.id], { ...OPC, notas: "COMITE_CONVIVENCIA" });
        conteos.comites++;

        const onboarding = await tx.onboardingColegio.create({
            data: { colegioId: colegio.id, estado: "completado", pasoActual: 5, completadoEn: inicioServicio },
            select: { id: true },
        });
        await marcar(tx, "OnboardingColegio", [onboarding.id], OPC);
        conteos.onboarding++;

        const suscripcion = await tx.suscripcion.create({
            data: {
                tipoTitular: "COLEGIO",
                colegioId: colegio.id,
                estado: finServicio && finServicio < ahora ? "CANCELADA" : "ACTIVA",
                planActualId: plan.id,
                fechaInicio: inicioServicio,
                fechaFin: finServicio ?? new Date(inicioServicio.getTime() + 365 * 24 * 3600 * 1000),
                codigoReferidoPropio: `D5C${nn}${Math.floor(r() * 9000 + 1000)}`,
                monedaLocal: "COP",
                paisCliente: "CO",
            },
            select: { id: true },
        });
        await marcar(tx, "Suscripcion", [suscripcion.id], OPC);
        conteos.suscripciones++;

        // Candado "cero correos": todas apagadas.
        const prefs = await tx.preferenciaAlertaColegio.createManyAndReturn({
            data: (["REPORTE_NUEVO", "UMBRAL_CURSO", "ESTUDIANTE_REPETIDO", "RESUMEN_SEMANAL"] as const).map(
                (tipoEvento) => ({ colegioId: colegio.id, tipoEvento, habilitado: false, emailDestino: null }),
            ),
            select: { id: true },
        });
        await marcar(tx, "PreferenciaAlertaColegio", prefs.map((p) => p.id), OPC);
        conteos.preferencias += prefs.length;

        return { colegioId: colegio.id, tenantId: tenant.id, comiteId: comite.id, suscripcionId: suscripcion.id };
    });
}

/**
 * El aula del colegio: cursos, profesores y alumnos con sus acudientes, más los
 * identificadores de plataforma que después harán nacer las alertas.
 *
 * `createManyAndReturn` devuelve las filas creadas con el `cuid()` que Prisma
 * les puso; se pide junto a una clave de negocio única (`documentoNumero`,
 * `valor`…) para no depender del orden de retorno al colgar los hijos.
 */
async function sembrarAula(
    indice: number,
    colegioId: string,
    plataformas: { id: string }[],
    r: () => number,
    conteos: ConteosV5,
): Promise<SujetoSembrado[]> {
    const nn = String(indice).padStart(2, "0");
    const sujetos: SujetoSembrado[] = [];

    return prisma.$transaction(async (tx) => {
        // ── Cursos ──────────────────────────────────────────────────────────
        const grados = ["5", "6", "7", "8", "9", "10", "11"];
        const cursos = await tx.curso.createManyAndReturn({
            data: Array.from({ length: DEMO5.cursosPorColegio }, (_, k) => ({
                colegioId,
                nombre: `${pick(r, grados)}°-${String.fromCharCode(65 + k)}`,
                grado: pick(r, grados),
                anioLectivo: "2026",
                estado: "activo",
            })),
            select: { id: true },
        });
        await marcar(tx, "Curso", cursos.map((c) => c.id), OPC);
        conteos.cursos += cursos.length;

        // ── Profesores ──────────────────────────────────────────────────────
        const profesores = await tx.profesor.createManyAndReturn({
            data: Array.from({ length: DEMO5.profesoresPorColegio }, (_, k) => ({
                colegioId,
                nombre: `Profe${k + 1}`,
                apellidos: `${DEMO5.etiquetaHumana}${nn}`,
                tipoDocumento: "CC",
                numeroDocumento: String(DEMO5.documentoProfesorBase + indice * 1000 + k + 1),
                anioNacimiento: 1970 + Math.floor(r() * 30),
                sexo: r() < 0.5 ? "M" : "F",
                email: `profe${k + 1}@demo5-c${nn}.local`,
                telefono: `+57 310 ${String(5000000 + indice * 1000 + k)}`,
                estado: "activo",
            })),
            select: { id: true },
        });
        await marcar(tx, "Profesor", profesores.map((p) => p.id), OPC);
        conteos.profesores += profesores.length;

        // Titular de cada curso — ahora sí con el cuid real del profesor.
        for (let i = 0; i < cursos.length && i < profesores.length; i++) {
            await tx.curso.update({ where: { id: cursos[i].id }, data: { profesorTitularId: profesores[i].id } });
        }

        const identsProf = profesores.filter(() => r() < 0.35);
        if (identsProf.length) {
            const filas = await tx.identificadorProfesor.createManyAndReturn({
                data: identsProf.map((p, k) => ({
                    profesorId: p.id,
                    colegioId,
                    tipo: "usuario",
                    valor: `prof5_${nn}_${k + 1}`,
                    plataformaId: pick(r, plataformas).id,
                    estado: "activo",
                })),
                select: { id: true, valor: true, plataformaId: true },
            });
            await marcar(tx, "IdentificadorProfesor", filas.map((f) => f.id), OPC);
            conteos.identProf += filas.length;
            for (const f of filas) {
                // `plataformaId` es opcional en el modelo; acá siempre se llena, y un
                // identificador sin plataforma no serviría de blanco para un reporte.
                if (!f.plataformaId) continue;
                sujetos.push({ tipoSujeto: "PROFESOR", identId: f.id, nick: f.valor, plataformaId: f.plataformaId, colegioId });
            }
        }

        // ── Alumnos ─────────────────────────────────────────────────────────
        const alumnos = await tx.estudiante.createManyAndReturn({
            data: Array.from({ length: DEMO5.alumnosPorColegio }, (_, k) => ({
                cursoId: pick(r, cursos).id,
                colegioId,
                nombre: `Alumno ${k + 1}`,
                apellidos: `${DEMO5.etiquetaHumana}${nn}`,
                documentoTipo: "TI",
                documentoNumero: String(DEMO5.documentoEstudianteBase + indice * 1000 + k + 1),
                estado: "activo",
            })),
            select: { id: true },
        });
        await marcar(tx, "Estudiante", alumnos.map((a) => a.id), OPC);
        conteos.alumnos += alumnos.length;

        const cobertura = 0.4 + r() * 0.55;
        const conIdent = alumnos.filter(() => r() < cobertura);
        if (conIdent.length) {
            const filas = await tx.identificadorEstudiante.createManyAndReturn({
                data: conIdent.map((a, k) => ({
                    estudianteId: a.id,
                    colegioId,
                    tipo: "usuario",
                    valor: `alum5_${nn}_${k + 1}`,
                    plataformaId: pick(r, plataformas).id,
                    etiquetaRelacion: "ESTUDIANTE",
                    estado: "activo",
                })),
                select: { id: true, valor: true, plataformaId: true },
            });
            await marcar(tx, "IdentificadorEstudiante", filas.map((f) => f.id), OPC);
            conteos.identEst += filas.length;
            for (const f of filas) {
                // `plataformaId` es opcional en el modelo; acá siempre se llena, y un
                // identificador sin plataforma no serviría de blanco para un reporte.
                if (!f.plataformaId) continue;
                sujetos.push({ tipoSujeto: "ESTUDIANTE", identId: f.id, nick: f.valor, plataformaId: f.plataformaId, colegioId });
            }
        }

        // ── Acudientes ──────────────────────────────────────────────────────
        // 1-2 acudientes por alumno (40 % lleva dos) → ~2.800 en total, que es
        // el volumen que pidió BI.
        const filasAcudiente = alumnos.flatMap((a, k) => {
            const cuantos = r() < DEMO5.fraccionDosAcudientes ? 2 : 1;
            return Array.from({ length: cuantos }, (_, o) => ({
                estudianteId: a.id,
                orden: o + 1,
                nombre: o === 0 ? `Madre ${DEMO5.etiquetaHumana} ${k + 1}` : `Padre ${DEMO5.etiquetaHumana} ${k + 1}`,
                relacion: o === 0 ? "madre" : "padre",
                telefono: `+57 300 ${String(6100000 + indice * 1000 + k * 2 + o)}`,
                email: `acudiente${k + 1}-${o + 1}@demo5-c${nn}.local`,
                estado: "activo",
            }));
        });
        const acudientes = await tx.acudienteEstudiante.createManyAndReturn({
            data: filasAcudiente,
            select: { id: true },
        });
        await marcar(tx, "AcudienteEstudiante", acudientes.map((a) => a.id), OPC);
        conteos.acudientes += acudientes.length;

        const acuConIdent = acudientes.filter(() => r() < cobertura * 0.6);
        if (acuConIdent.length) {
            const filas = await tx.identificadorAcudiente.createManyAndReturn({
                data: acuConIdent.map((a, k) => ({
                    acudienteId: a.id,
                    colegioId,
                    tipo: "usuario",
                    valor: `acu5_${nn}_${k + 1}`,
                    plataformaId: pick(r, plataformas).id,
                    estado: "activo",
                })),
                select: { id: true, valor: true, plataformaId: true },
            });
            await marcar(tx, "IdentificadorAcudiente", filas.map((f) => f.id), OPC);
            conteos.identAcu += filas.length;
            for (const f of filas) {
                // `plataformaId` es opcional en el modelo; acá siempre se llena, y un
                // identificador sin plataforma no serviría de blanco para un reporte.
                if (!f.plataformaId) continue;
                sujetos.push({ tipoSujeto: "ACUDIENTE", identId: f.id, nick: f.valor, plataformaId: f.plataformaId, colegioId });
            }
        }

        return sujetos;
    });
}

/**
 * Expedientes del padre (brief §5: hoy hay 4 en producción). Padre + un contacto
 * de confianza + su identificador; un tercio de los identificadores reusa el
 * nick de un sujeto sembrado para que el flujo de círculo tenga con qué cruzar.
 */
async function sembrarPadres(
    plataformas: { id: string }[],
    sujetos: SujetoSembrado[],
    planesPadre: PlanUsable[],
    passwordHash: string,
    r: () => number,
    ahora: Date,
    conteos: ConteosV5,
): Promise<{ suscripcionId: string; plan: PlanUsable; fechaInicio: Date }[]> {
    return prisma.$transaction(async (tx) => {
        const padres = await tx.usuario.createManyAndReturn({
            data: Array.from({ length: DEMO5.nPadres }, (_, k) => ({
                email: emailPadreV5(k + 1),
                nombre: `Padre ${DEMO5.etiquetaHumana} ${k + 1}`,
                passwordHash,
                rol: "PARENT" as const,
                estado: "activo",
                estadoActivacion: "ACTIVO" as const,
                debeCambiarPassword: false,
            })),
            select: { id: true },
        });
        await marcar(tx, "Usuario", padres.map((p) => p.id), { ...OPC, notas: "PARENT" });
        conteos.padres += padres.length;

        const contactos = await tx.contactoConfianza.createManyAndReturn({
            data: padres.map((p, k) => ({
                usuarioId: p.id,
                etiqueta: `Contacto ${DEMO5.etiquetaHumana} ${k + 1}`,
                nombre: `Contacto ${DEMO5.etiquetaHumana} ${k + 1}`,
                parentesco: k % 2 === 0 ? "hijo" : "sobrino",
                activo: true,
            })),
            select: { id: true },
        });
        await marcar(tx, "ContactoConfianza", contactos.map((c) => c.id), OPC);
        conteos.contactos += contactos.length;

        const idents = await tx.identificadorContacto.createManyAndReturn({
            data: contactos.map((c, k) => {
                const sujeto = sujetos.length > 0 && k % 3 === 0 ? sujetos[k % sujetos.length] : null;
                return {
                    contactoId: c.id,
                    valor: sujeto?.nick ?? `contacto5_${String(k + 1).padStart(3, "0")}`,
                    tipo: "nick",
                    plataformaId: sujeto?.plataformaId ?? pick(r, plataformas).id,
                    activo: true,
                };
            }),
            select: { id: true },
        });
        await marcar(tx, "IdentificadorContacto", idents.map((i) => i.id), OPC);
        conteos.identContacto += idents.length;

        // Suscripción del padre — BI necesita los DOS tipos de titular en su
        // tablero comercial, no solo colegios.
        const suscripcionesPadre: { suscripcionId: string; plan: PlanUsable; fechaInicio: Date }[] = [];
        if (planesPadre.length > 0) {
            const planes = padres.map(() => pick(r, planesPadre));
            const inicios = padres.map(() => fechaAtras(r, DEMO5.mesesAtras, ahora));
            const filas = await tx.suscripcion.createManyAndReturn({
                data: padres.map((padre, k) => ({
                    tipoTitular: "PADRE" as const,
                    usuarioId: padre.id,
                    estado: "ACTIVA" as const,
                    planActualId: planes[k].id,
                    fechaInicio: inicios[k],
                    fechaFin: new Date(inicios[k].getTime() + 365 * 24 * 3600 * 1000),
                    codigoReferidoPropio: `D5P${String(k + 1).padStart(3, "0")}${Math.floor(r() * 9000 + 1000)}`,
                    monedaLocal: "COP",
                    paisCliente: "CO",
                })),
                select: { id: true },
            });
            await marcar(tx, "Suscripcion", filas.map((f) => f.id), { ...OPC, notas: "PADRE" });
            conteos.suscripciones += filas.length;
            filas.forEach((f, k) => suscripcionesPadre.push({ suscripcionId: f.id, plan: planes[k], fechaInicio: inicios[k] }));
        }
        return suscripcionesPadre;
    });
}

async function ejecutar(motivo: string, confirm: boolean, semilla: number): Promise<void> {
    const r = rng(semilla);
    const ahora = new Date();
    log("poblar-v5", `INICIO — dry-run=${!confirm}, semilla=${semilla}, motivo="${motivo}"`);

    await guardiaDeCorrida();
    await verificarIntocables();
    const { plataformas, ciudades, ciudadesCO } = await cargarCatalogos();

    if (!confirm) {
        log("poblar-v5", "Estimación (dry-run) — nada se escribió:");
        log("poblar-v5", `  · colegios: ${DEMO5.nColegios} (con tenant, admin, comité, onboarding, suscripción)`);
        log("poblar-v5", `  · cursos: ${DEMO5.nColegios * DEMO5.cursosPorColegio} · profesores: ${DEMO5.nColegios * DEMO5.profesoresPorColegio}`);
        log("poblar-v5", `  · alumnos: ${DEMO5.nColegios * DEMO5.alumnosPorColegio} (+ 1-2 acudientes cada uno ≈ ${Math.round(DEMO5.nColegios * DEMO5.alumnosPorColegio * (1 + DEMO5.fraccionDosAcudientes))})`);
        log("poblar-v5", `  · padres con expediente: ${DEMO5.nPadres}`);
        log("poblar-v5", `  · reportes: ${DEMO5.nReportes} en los últimos ${DEMO5.mesesAtras} meses (+ IA directa + alertas + transiciones + comité)`);
        log("poblar-v5", `  · con reincidencia (${Math.round(DEMO5.reincidenciaPct * 100)} %) y cadena (${Math.round(DEMO5.cadenaPct * 100)} % de los reincidentes)`);
        log("poblar-v5", `  · asignación desigual de alertas por colegio: ${DEMO5.fraccionesAsignacion.join(" · ")}`);
        log("poblar-v5", `  · suscripciones: ${DEMO5.nColegios} de colegio + ${DEMO5.nPadres} de padre, cada una con su pago AUTORIZADO`);
        log("poblar-v5", `  · TODO queda registrado en demo_marcado, corrida "${CORRIDA_V5}".`);
        log("poblar-v5", "Pasa --confirm para ejecutar de verdad.");
        return;
    }

    const conteos = conteosVacios();
    const passwordHash = await hashPassword(DEMO5.passwordSimulada);
    const sujetos: SujetoSembrado[] = [];
    const colegios: { colegioId: string; comiteId: string }[] = [];
    const suscripciones: { suscripcionId: string; plan: PlanUsable; fechaInicio: Date }[] = [];

    const admin = await prisma.usuario.findFirst({ where: { rol: "ADMIN" }, select: { id: true } });
    if (!admin) throw new Error("[poblar-v5] No hay usuario ADMIN — corre el seed antes.");
    const planes = await asegurarPlanes(prisma, ahora.getUTCFullYear(), conteos, OPC);
    const planesColegio = planes.filter((p) => p.tipoTitular === "COLEGIO");
    const planesPadre = planes.filter((p) => p.tipoTitular === "PADRE");

    for (let c = 1; c <= DEMO5.nColegios; c++) {
        const ciudad = pick(r, ciudadesCO);
        const planColegio = pick(r, planesColegio);
        const { colegioId, comiteId, suscripcionId } = await sembrarColegio(c, ciudad, planColegio, passwordHash, r, ahora, conteos);
        if (suscripcionId) suscripciones.push({ suscripcionId, plan: planColegio, fechaInicio: fechaAtras(r, DEMO5.mesesAtras, ahora) });
        sujetos.push(...(await sembrarAula(c, colegioId, plataformas, r, conteos)));
        colegios.push({ colegioId, comiteId });
        log("poblar-v5", `colegio ${c}/${DEMO5.nColegios} listo (sujetos acumulados: ${sujetos.length})`);
    }

    const suscripcionesPadre = await sembrarPadres(plataformas, sujetos, planesPadre, passwordHash, r, ahora, conteos);
    suscripciones.push(...suscripcionesPadre);
    log("poblar-v5", `padres con expediente: ${conteos.padres}`);

    // Capa comercial. Ver la nota de `_poblar-v5-pagos.ts`: producción NO llena
    // `Pago`; se siembra para que BI pueda ejercitar su tablero.
    await sembrarPagos({ prisma, r, ahora, adminId: admin.id, suscripciones, conteos, opciones: OPC });

    await sembrarCasos({ prisma, r, ahora, plataformas, ciudades, sujetos, colegios, conteos, opciones: OPC });

    await prisma.$transaction(async (tx) => {
        const total = Object.values(conteos).reduce((a, b) => a + b, 0);
        await registrarAuditoriaDemo(tx, "demo_poblar", motivo, total, { ...conteos, corrida: CORRIDA_V5 });
    });

    const cuadre = await verificarCuadre(prisma, suscripciones.map((s) => s.suscripcionId));
    log("poblar-v5", `cuadre pagos ↔ suscripciones: ${cuadre.cuadran} cuadran · ${cuadre.descuadran} descuadran`);
    if (cuadre.descuadran > 0) {
        log("poblar-v5", "AVISO: hay suscripciones cuyo montoRealPagado no coincide con sus pagos AUTORIZADO.");
    }

    const marcadas = await prisma.demoMarcado.count();
    log("poblar-v5", "LISTO — resumen:");
    for (const [k, v] of Object.entries(conteos)) log("poblar-v5", `  · ${k}: ${v}`);
    log("poblar-v5", `demo_marcado tiene ahora ${marcadas} filas. Se borra con borrar-demo-marcado.ts.`);
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv, ["motivo", "confirm", "semilla"]);
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    const semilla = typeof args.semilla === "string" ? Number(args.semilla) : 412;
    if (!Number.isFinite(semilla)) throw new Error("[poblar-v5] --semilla debe ser un número");
    await ejecutar(motivo, args.confirm === true, semilla);
}

if (process.argv[1]?.endsWith("poblar-demo-v5.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[poblar-v5] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}

