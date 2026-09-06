/**
 * 002-PI-345 · POBLADOR de datos demo para BI.
 *
 *   dry-run (por defecto — solo cuenta lo que crearía):
 *     node --env-file=.env --import tsx scripts/demo/poblar-demo.ts \
 *       --motivo="poblar demo BI campaña septiembre 2026"
 *   real:
 *     node --env-file=.env --import tsx scripts/demo/poblar-demo.ts \
 *       --motivo="poblar demo BI campaña septiembre 2026" --confirm
 *
 * Volumen (spec 002-PI-345):
 *   50 colegios · 300 profesores · 2000 alumnos · ~2000 reportes en 12 meses.
 *
 * Candados innegociables (spec 002-PI-345 §"Candados"):
 *   1) ClasificacionIA se INSERTA DIRECTA — jamás pg-boss ni Ollama (R16).
 *   2) Cero correos: PreferenciaAlertaColegio de cada colegio demo con
 *      habilitado=false, ningún job encolado.
 *   3) Reversible por marca: ids con prefijo `demo-`, NIT en la serie,
 *      emails `+demo-`. INTOCABLES: sagrado corazón, "Colegio Prueba Calidad"
 *      (cmticor7l000kglr93d1ypox6), soporte@innovadataco.com.
 *   4) Idempotente: upsert por id determinístico → re-correr no duplica.
 *   5) Textos sintéticos inocuos, cifrados por camino normal (cifrarTextoReporte).
 *   6) Inserts por lotes (createMany skipDuplicates) y todo < 10 min.
 *
 * Adendo CEO 01-09-2026 03:00 → 80–85% de los reportes apuntan a identificadores
 * DE los sujetos demo (alumnos, profesores Y acudientes) para que AlertaColegio
 * nazca de los 3 tipos; 15–20% a nicks externos por realismo. AlertaColegio se
 * inserta DIRECTA con estados variados (nueva|vista|gestionada|escalada|cerrada).
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { hashPassword } from "../../src/lib/auth";
import { cifrarTextoReporte } from "../../src/lib/texto-reporte-cifrado";
import {
    DEMO,
    DEMO_PLATAFORMAS,
    DEMO_CATEGORIAS_REPORTE,
    type CategoriaDemo,
    rng,
    pick,
    fechaAtras,
    parseArgs,
    requerirMotivo,
    log,
    registrarAuditoriaDemo,
    emailAdmin,
    emailComite,
    nitColegio,
    nombreColegio,
    id,
} from "./_common";

const prisma = new PrismaClient();

// Textos sintéticos inocuos — nada gráfico, solo "sabor" para BI y para la UI.
const TEXTOS_INOCUOS = [
    "Contacto insistente por mensaje directo, no responde al bloqueo.",
    "Pide fotos personales sin explicación clara del pedido.",
    "Ofrece regalos o dinero a cambio de información privada.",
    "Se hace pasar por un compañero del colegio para pedir contacto.",
    "Insiste en encontrarse fuera del horario escolar sin autorización.",
    "Envía material inapropiado sin consentimiento previo.",
    "Extorsiona con contenido íntimo grabado sin permiso.",
    "Publica información personal (dirección, teléfono) sin autorización.",
    "Acoso persistente por varios canales — mismo perfil recurre.",
    "Reenvío no consentido a grupos ajenos a la conversación original.",
    "Presunto acoso escolar coordinado por un grupo pequeño.",
    "Seguimiento de rutinas y ubicaciones fuera de la conversación.",
    "Publicidad automatizada, sin acción real de un humano detrás.",
    "Suplantación de identidad de un docente para pedir tareas.",
    "Contenido generado por IA usado para simular otra persona.",
];

// Nicks externos para el ~15–20% que no apunta a demo (realismo BI).
const NICKS_EXTERNOS = [
    "anon_x_2019", "sombra_del_valle", "vecino24h", "clovergirl_", "el_faroh",
    "quipuxx", "usuario0492", "nautilus.mnl", "camino.10", "otoyo_x", "silvia.jrz",
    "matte_gtz", "diego__1998", "profe_incognito", "ml_1207", "fibra33",
];

// Ciudades del catálogo real — CO y algunas afuera para variedad geográfica.
const CIUDAD_CODIGOS = ["CO:Bogotá", "CO:Medellín", "CO:Cali", "CO:Barranquilla", "CO:Cartagena",
    "CO:Bucaramanga", "CO:Pereira", "CO:Ibagué", "CO:Manizales", "CO:Cúcuta",
    "MX:Ciudad de México", "MX:Guadalajara", "AR:Buenos Aires", "AR:Córdoba",
    "PE:Lima", "CL:Santiago", "EC:Quito", "UY:Montevideo"];

async function ejecutar(motivo: string, confirm: boolean, semilla: number) {
    const r = rng(semilla);
    const ahora = new Date();

    log("poblar", `INICIO — dry-run=${!confirm}, semilla=${semilla}, motivo="${motivo}"`);

    // ── 0. Chequeo de INTOCABLES (candado 3) — si aparecen, aborta ───────────
    const chocaId = await prisma.colegio.findMany({
        where: { id: { in: [...DEMO.intocables.colegios] } },
        select: { id: true },
    });
    for (const c of chocaId) log("poblar", `intocable OK: colegio ${c.id} respetado (no se toca).`);

    // ── 1. Catálogos existentes (seed debe haber corrido) ────────────────────
    const [plataformas, ciudades, plan] = await Promise.all([
        prisma.plataforma.findMany({ where: { clave: { in: [...DEMO_PLATAFORMAS] } } }),
        prisma.ciudad.findMany({
            where: { pais: { codigo: { in: ["CO", "MX", "AR", "PE", "CL", "EC", "UY"] } } },
            select: { id: true, paisId: true, nombre: true, pais: { select: { codigo: true, nombre: true } } },
        }),
        prisma.plan.findFirst({ where: { activo: true }, orderBy: { createdAt: "asc" } }),
    ]);
    if (plataformas.length === 0) throw new Error("[poblar] Sin plataformas en BD — corre el seed antes.");
    if (ciudades.length === 0) throw new Error("[poblar] Sin ciudades en BD — corre el seed antes.");
    if (!plan) log("poblar", "AVISO: sin Plan activo → no se crearán suscripciones (BI se conforma con el resto).");

    // Índices por (codigoPais:nombreCiudad) para elegir por catálogo.
    const ciudadesPorCodigo = new Map(ciudades.map((c) => [`${c.pais.codigo}:${c.nombre}`, c]));
    const ciudadesCO = ciudades.filter((c) => c.pais.codigo === "CO");
    const conteos = {
        colegios: 0, tenants: 0, admins: 0, comites: 0, onboarding: 0, suscripciones: 0,
        preferencias: 0, cursos: 0, profesores: 0, alumnos: 0, acudientes: 0,
        identProf: 0, identEst: 0, identAcu: 0, reportes: 0, clasificaciones: 0,
        alertas: 0,
    };

    if (!confirm) {
        // Dry-run: estimación
        log("poblar", "Estimación (dry-run):");
        log("poblar", `  · colegios: ${DEMO.nColegios}`);
        log("poblar", `  · tenants:  ${DEMO.nColegios}`);
        log("poblar", `  · admins+comité: ${DEMO.nColegios * 2}`);
        log("poblar", `  · profesores: ${DEMO.nProfesoresTotal}`);
        log("poblar", `  · alumnos: ${DEMO.nAlumnosTotal}`);
        log("poblar", `  · reportes: ${DEMO.nReportesTotal}`);
        log("poblar", `  · clasificaciones IA: ${DEMO.nReportesTotal} (directas)`);
        log("poblar", `  · alertas colegio: ~${Math.round(DEMO.nReportesTotal * DEMO.reportesADemoPct)}`);
        log("poblar", "Pasa --confirm para ejecutar de verdad.");
        return;
    }

    const passwordHash = await hashPassword(DEMO.passwordSimulada);

    // ── 2. Colegios · tenants · admin · comité · onboarding · suscripción ────
    // Un colegio a la vez, cada uno transaccional (mantener boundary conocida).
    type NickSujeto = { nick: string; plataformaId: string; colegioId: string; identId: string };
    const nicksPorTipo = {
        estudiante: [] as NickSujeto[],
        profesor: [] as NickSujeto[],
        acudiente: [] as NickSujeto[],
    };
    // Alias tipado — los CreateManyInput de Prisma dejan `id` opcional (default cuid),
    // pero acá SIEMPRE lo forzamos (idempotencia). Requerido para el flow.
    type ConId<T> = T & { id: string };

    for (let c = 1; c <= DEMO.nColegios; c++) {
        const ciudad = pick(r, ciudadesCO); // sede en CO — realismo del target
        const inicioServicio = fechaAtras(r, 24, ahora);
        const finServicio = r() < 0.15 ? new Date(inicioServicio.getTime() + 365 * 24 * 3600 * 1000) : null; // 15% vencidos

        await prisma.$transaction(async (tx) => {
            // Tenant
            await tx.tenant.upsert({
                where: { id: id.tenant(c) },
                create: { id: id.tenant(c), nombre: `demo-tenant-${String(c).padStart(2, "0")}`, estado: "activo" },
                update: {},
            });
            conteos.tenants++;

            // Colegio
            await tx.colegio.upsert({
                where: { id: id.colegio(c) },
                create: {
                    id: id.colegio(c),
                    nombre: nombreColegio(c),
                    nit: nitColegio(c),
                    paisId: ciudad.paisId,
                    ciudadId: ciudad.id,
                    representanteLegalNombre: `Rector Demo ${c}`,
                    representanteLegalIdentificacion: `100${String(c).padStart(6, "0")}`,
                    representanteLegalEmail: emailAdmin(c),
                    representanteLegalTelefono: `+57 300 555${String(1000 + c)}`,
                    inicioServicio,
                    finServicio,
                    tipoPeriodo: "ANUAL",
                    estado: "activo",
                    tenantId: id.tenant(c),
                },
                update: {},
            });
            conteos.colegios++;

            // Admin del colegio
            await tx.usuario.upsert({
                where: { id: id.admin(c) },
                create: {
                    id: id.admin(c),
                    email: emailAdmin(c),
                    nombre: `Rector Demo ${c}`,
                    passwordHash,
                    rol: "SCHOOL_ADMIN",
                    estado: "activo",
                    estadoActivacion: "ACTIVO",
                    tenantId: id.tenant(c),
                    colegioId: id.colegio(c),
                },
                update: {},
            });
            conteos.admins++;

            // Comité de convivencia (cuenta compartida por colegio, SPEC-168)
            await tx.usuario.upsert({
                where: { id: id.comite(c) },
                create: {
                    id: id.comite(c),
                    email: emailComite(c),
                    nombre: `Comité Convivencia ${c}`,
                    passwordHash,
                    rol: "COMITE_CONVIVENCIA",
                    estado: "activo",
                    estadoActivacion: "ACTIVO",
                    tenantId: id.tenant(c),
                    comiteColegioId: id.colegio(c),
                },
                update: {},
            });
            conteos.comites++;

            // Onboarding — completado (para que el colegio aparezca "listo" en BI)
            await tx.onboardingColegio.upsert({
                where: { id: id.onboarding(c) },
                create: {
                    id: id.onboarding(c),
                    colegioId: id.colegio(c),
                    estado: "completado",
                    pasoActual: 5,
                    completadoEn: inicioServicio,
                },
                update: {},
            });
            conteos.onboarding++;

            // Suscripción activa (o vencida si finServicio pasó) — solo si hay Plan
            if (plan) {
                await tx.suscripcion.upsert({
                    where: { id: id.suscripcion(c) },
                    create: {
                        id: id.suscripcion(c),
                        tipoTitular: "COLEGIO",
                        colegioId: id.colegio(c),
                        estado: finServicio && finServicio < ahora ? "CANCELADA" : "ACTIVA",
                        planActualId: plan.id,
                        fechaInicio: inicioServicio,
                        fechaFin: finServicio ?? new Date(inicioServicio.getTime() + 365 * 24 * 3600 * 1000),
                        codigoReferidoPropio: `DEMO${String(c).padStart(2, "0")}${Math.floor(r() * 9000 + 1000)}`,
                    },
                    update: {},
                });
                conteos.suscripciones++;
            }

            // Preferencias de aviso — TODAS deshabilitadas (candado 2 · cero correos)
            for (const evento of ["REPORTE_NUEVO", "UMBRAL_CURSO", "ESTUDIANTE_REPETIDO", "RESUMEN_SEMANAL"] as const) {
                await tx.preferenciaAlertaColegio.upsert({
                    where: { id: id.preferencia(c, evento) },
                    create: {
                        id: id.preferencia(c, evento),
                        colegioId: id.colegio(c),
                        tipoEvento: evento,
                        habilitado: false,
                        emailDestino: null,
                    },
                    update: { habilitado: false },
                });
                conteos.preferencias++;
            }
        });

        if (c % 10 === 0) log("poblar", `colegios listos: ${c}/${DEMO.nColegios}`);
    }

    // ── 3. Cursos por colegio (4 cursos: grados 5–11 al azar) ────────────────
    const cursosPorColegio = 4;
    for (let c = 1; c <= DEMO.nColegios; c++) {
        const gradosDisponibles = ["5", "6", "7", "8", "9", "10", "11"];
        const cursosPlanned: ConId<Prisma.CursoCreateManyInput>[] = [];
        for (let k = 1; k <= cursosPorColegio; k++) {
            const grado = pick(r, gradosDisponibles);
            cursosPlanned.push({
                id: id.curso(c, k),
                colegioId: id.colegio(c),
                nombre: `${grado}°-${String.fromCharCode(64 + k)}`,
                grado,
                anioLectivo: "2026",
                estado: "activo",
            });
        }
        await prisma.curso.createMany({ data: cursosPlanned, skipDuplicates: true });
        conteos.cursos += cursosPlanned.length;
    }
    log("poblar", `cursos: ${conteos.cursos}`);

    // ── 4. Profesores (300 repartidos ~6/colegio) + identificadores ─────────
    const profPorColegio = Math.ceil(DEMO.nProfesoresTotal / DEMO.nColegios);
    for (let c = 1; c <= DEMO.nColegios; c++) {
        const profs: ConId<Prisma.ProfesorCreateManyInput>[] = [];
        const kMax = Math.min(profPorColegio, DEMO.nProfesoresTotal - conteos.profesores);
        for (let k = 1; k <= kMax; k++) {
            const nn = String(k).padStart(3, "0");
            profs.push({
                id: id.profesor(c, k),
                colegioId: id.colegio(c),
                nombre: `Profe${k}`,
                apellidos: `Demo${c}`,
                tipoDocumento: "CC",
                numeroDocumento: `20${String(c).padStart(2, "0")}${nn}`,
                anioNacimiento: 1970 + Math.floor(r() * 30),
                sexo: r() < 0.5 ? "M" : "F",
                email: `profe${nn}@demo-c${String(c).padStart(2, "0")}.local`,
                telefono: `+57 310 ${String(4000000 + c * 1000 + k)}`,
                estado: "activo",
            });
        }
        if (profs.length) {
            await prisma.profesor.createMany({ data: profs, skipDuplicates: true });
            conteos.profesores += profs.length;

            // Identificadores del profesor: ~35% tiene una plataforma
            const identsProf: ConId<Prisma.IdentificadorProfesorCreateManyInput>[] = [];
            for (const p of profs) {
                if (r() < 0.35) {
                    const pl = pick(r, plataformas);
                    const nick = `prof_${c}_${p.id.slice(-3)}`;
                    identsProf.push({
                        id: id.identProf(p.id, 1),
                        profesorId: p.id,
                        colegioId: id.colegio(c),
                        tipo: "usuario",
                        valor: nick,
                        plataformaId: pl.id,
                        estado: "activo",
                    });
                    nicksPorTipo.profesor.push({ nick, plataformaId: pl.id, colegioId: id.colegio(c), identId: id.identProf(p.id, 1) });
                }
            }
            if (identsProf.length) {
                await prisma.identificadorProfesor.createMany({ data: identsProf, skipDuplicates: true });
                conteos.identProf += identsProf.length;
            }

            // Un titular por curso (usa el primer profesor del colegio si hay)
            const cursos = await prisma.curso.findMany({ where: { colegioId: id.colegio(c) }, select: { id: true } });
            for (let i = 0; i < cursos.length && i < profs.length; i++) {
                await prisma.curso.update({ where: { id: cursos[i].id }, data: { profesorTitularId: profs[i].id } });
            }
        }
    }
    log("poblar", `profesores: ${conteos.profesores} (identificadores: ${conteos.identProf})`);

    // ── 5. Alumnos (2000 repartidos ~40/colegio) + acudientes + identificadores ─
    const alumnosPorColegio = Math.ceil(DEMO.nAlumnosTotal / DEMO.nColegios);
    for (let c = 1; c <= DEMO.nColegios; c++) {
        const cursosC = await prisma.curso.findMany({ where: { colegioId: id.colegio(c) }, select: { id: true } });
        if (cursosC.length === 0) continue;

        const restante = DEMO.nAlumnosTotal - conteos.alumnos;
        const nEste = Math.min(alumnosPorColegio, restante);
        const coberturaIdent = 0.4 + r() * 0.55; // 40–95% (candado spec §Volumen)

        const alumnos: ConId<Prisma.EstudianteCreateManyInput>[] = [];
        for (let k = 1; k <= nEste; k++) {
            alumnos.push({
                id: id.estudiante(c, k),
                cursoId: pick(r, cursosC).id,
                colegioId: id.colegio(c),
                nombre: `Alumno ${k}`,
                apellidos: `Demo${c}`,
                documentoTipo: "TI",
                documentoNumero: `10${String(c).padStart(2, "0")}${String(k).padStart(4, "0")}`,
                estado: "activo",
            });
        }
        await prisma.estudiante.createMany({ data: alumnos, skipDuplicates: true });
        conteos.alumnos += alumnos.length;

        // Acudientes: 1–2 por alumno
        const acudientes: ConId<Prisma.AcudienteEstudianteCreateManyInput>[] = [];
        for (const a of alumnos) {
            const nAc = r() < 0.4 ? 2 : 1;
            for (let orden = 1; orden <= nAc; orden++) {
                acudientes.push({
                    id: id.acudiente(a.id, orden),
                    estudianteId: a.id,
                    orden,
                    nombre: orden === 1 ? `Madre Demo ${a.id.slice(-4)}` : `Padre Demo ${a.id.slice(-4)}`,
                    relacion: orden === 1 ? "madre" : "padre",
                    telefono: `+57 300 ${String(6000000 + Math.floor(r() * 999999))}`,
                    email: `acudiente${orden}_${a.id.slice(-4)}@demo-c${String(c).padStart(2, "0")}.local`,
                    estado: "activo",
                });
            }
        }
        if (acudientes.length) {
            await prisma.acudienteEstudiante.createMany({ data: acudientes, skipDuplicates: true });
            conteos.acudientes += acudientes.length;
        }

        // Identificadores: alumnos y acudientes (aplicando coberturaIdent)
        const identsEst: ConId<Prisma.IdentificadorEstudianteCreateManyInput>[] = [];
        const identsAcu: ConId<Prisma.IdentificadorAcudienteCreateManyInput>[] = [];
        for (const a of alumnos) {
            if (r() < coberturaIdent) {
                const pl = pick(r, plataformas);
                const nick = `alum_${c}_${a.id.slice(-4)}`;
                identsEst.push({
                    id: id.identEst(a.id, 1),
                    estudianteId: a.id,
                    colegioId: id.colegio(c),
                    tipo: "usuario",
                    valor: nick,
                    plataformaId: pl.id,
                    etiquetaRelacion: "ESTUDIANTE",
                    estado: "activo",
                });
                nicksPorTipo.estudiante.push({ nick, plataformaId: pl.id, colegioId: id.colegio(c), identId: id.identEst(a.id, 1) });
            }
        }
        const acudsInsertados = acudientes;
        for (const ac of acudsInsertados) {
            if (r() < coberturaIdent * 0.6) { // los acudientes con menos cobertura
                const pl = pick(r, plataformas);
                const nick = `acu_${c}_${ac.id.slice(-6)}`;
                identsAcu.push({
                    id: id.identAcu(ac.id, 1),
                    acudienteId: ac.id,
                    colegioId: id.colegio(c),
                    tipo: "usuario",
                    valor: nick,
                    plataformaId: pl.id,
                    estado: "activo",
                });
                nicksPorTipo.acudiente.push({ nick, plataformaId: pl.id, colegioId: id.colegio(c), identId: id.identAcu(ac.id, 1) });
            }
        }
        if (identsEst.length) {
            await prisma.identificadorEstudiante.createMany({ data: identsEst, skipDuplicates: true });
            conteos.identEst += identsEst.length;
        }
        if (identsAcu.length) {
            await prisma.identificadorAcudiente.createMany({ data: identsAcu, skipDuplicates: true });
            conteos.identAcu += identsAcu.length;
        }

        if (c % 10 === 0) log("poblar", `alumnos+acudientes al colegio ${c}: alumnos=${conteos.alumnos} acud=${conteos.acudientes}`);
    }
    log("poblar", `alumnos: ${conteos.alumnos} · acudientes: ${conteos.acudientes} · idents [est=${conteos.identEst}, acu=${conteos.identAcu}]`);

    // ── 6. Reportes + ClasificacionIA (directa, candado 1) + AlertaColegio ──
    // Distribución 83% a demo / 17% externos. Reincidencia deliberada.
    const objDemo = Math.round(DEMO.nReportesTotal * DEMO.reportesADemoPct);
    const identsDemo = [
        ...nicksPorTipo.estudiante.map((n) => ({ ...n, tipoSujeto: "ESTUDIANTE" as const })),
        ...nicksPorTipo.profesor.map((n) => ({ ...n, tipoSujeto: "PROFESOR" as const })),
        ...nicksPorTipo.acudiente.map((n) => ({ ...n, tipoSujeto: "ACUDIENTE" as const })),
    ];
    if (identsDemo.length === 0) {
        log("poblar", "AVISO: 0 identificadores demo — ningún reporte apuntará a un sujeto demo.");
    }

    // Preparo por lotes de 500 para no reventar memoria ni el pool.
    const LOTE = 500;
    for (let base = 0; base < DEMO.nReportesTotal; base += LOTE) {
        const reportes: ConId<Prisma.ReporteCreateManyInput>[] = [];
        const clasifs: ConId<Prisma.ClasificacionIACreateManyInput>[] = [];
        const alertas: ConId<Prisma.AlertaColegioCreateManyInput>[] = [];

        for (let n = base + 1; n <= Math.min(base + LOTE, DEMO.nReportesTotal); n++) {
            const rId = id.reporte(n);
            const esDemo = n <= objDemo && identsDemo.length > 0;

            const objetivo = esDemo ? pick(r, identsDemo) : null;
            const nick = objetivo?.nick ?? pick(r, NICKS_EXTERNOS);
            const plataformaId = objetivo?.plataformaId ?? pick(r, plataformas).id;

            // Reincidencia: si es demo y toca, uso el mismo identificador para varios
            // (createMany no permite duplicar id, así que la reincidencia sale
            // naturalmente porque muchos reportes distintos pueden apuntar al mismo
            // valor + plataforma).

            const ciudadCod = pick(r, CIUDAD_CODIGOS);
            const ciudad = ciudadesPorCodigo.get(ciudadCod);
            const paisCodigo = ciudadCod.split(":")[0];
            const nombreCiudad = ciudad?.nombre ?? ciudadCod.split(":")[1];

            const fecha = fechaAtras(r, 12, ahora);
            const texto = pick(r, TEXTOS_INOCUOS);
            const esSpam = r() < 0.08; // ~8% spam
            const esRM = !esSpam && r() < 0.06; // ~6% revisión manual
            const estado = esSpam ? "POSIBLE_SPAM" : esRM ? "REVISION_MANUAL" : "CLASIFICADO";
            const cat: CategoriaDemo = esSpam ? "SPAM" : pick(r, DEMO_CATEGORIAS_REPORTE);

            reportes.push({
                id: rId,
                identificador: nick,
                plataformaId,
                texto: cifrarTextoReporte(texto),
                textoOriginal: null,
                fechaIncidente: fecha,
                ciudad: nombreCiudad,
                pais: paisCodigo,
                paisId: ciudad?.paisId ?? null,
                ciudadId: ciudad?.id ?? null,
                estado: estado as never,
                esAnonimo: r() < 0.6,
                edadVictima: 10 + Math.floor(r() * 8),
                usuarioId: null,
                origenRol: null,
                tenantId: null,
                prioridadAlta: !esSpam && r() < 0.05,
                keywordsDetectadas: [],
                esRafaga: false,
                fuenteConfianza: 0.4 + r() * 0.6,
                eliminado: false,
                creadoEn: fecha,
                actualizadoEn: fecha,
            });

            clasifs.push({
                id: id.clasificacion(rId),
                reporteId: rId,
                categoria: cat as never,
                confianza: esSpam ? 0.6 + r() * 0.35 : 0.55 + r() * 0.44,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "demo-seed-345",
                latenciaMs: 0,
                usoCascada: false,
                posibleAgresorPar: false,
                creadoEn: fecha,
            });

            if (objetivo && estado === "CLASIFICADO") {
                // AlertaColegio directa (candado adendo)
                const estadoAlerta = pick(r, ["nueva", "vista", "gestionada", "escalada", "cerrada"]);
                const prioridad = pick(r, ["alta", "media", "baja"]);
                const vencSla = new Date(fecha.getTime() + 48 * 3600 * 1000);
                alertas.push({
                    id: id.alerta(rId, objetivo.tipoSujeto[0]),
                    colegioId: objetivo.colegioId,
                    reporteId: rId,
                    tipoSujeto: objetivo.tipoSujeto,
                    identificadorEstudianteId: objetivo.tipoSujeto === "ESTUDIANTE" ? objetivo.identId : null,
                    identificadorProfesorId: objetivo.tipoSujeto === "PROFESOR" ? objetivo.identId : null,
                    identificadorAcudienteId: objetivo.tipoSujeto === "ACUDIENTE" ? objetivo.identId : null,
                    estado: estadoAlerta,
                    prioridad,
                    vencimientoSla: vencSla,
                    creadoEn: fecha,
                    actualizadoEn: fecha,
                });
            }
        }

        await prisma.$transaction([
            prisma.reporte.createMany({ data: reportes, skipDuplicates: true }),
            prisma.clasificacionIA.createMany({ data: clasifs, skipDuplicates: true }),
            ...(alertas.length ? [prisma.alertaColegio.createMany({ data: alertas, skipDuplicates: true })] : []),
        ]);
        conteos.reportes += reportes.length;
        conteos.clasificaciones += clasifs.length;
        conteos.alertas += alertas.length;
        log("poblar", `reportes+IA+alertas al lote ${base + LOTE}: r=${conteos.reportes} cl=${conteos.clasificaciones} al=${conteos.alertas}`);
    }

    await prisma.$transaction(async (tx) => {
        const total = Object.values(conteos).reduce((a, b) => a + b, 0);
        await registrarAuditoriaDemo(tx, "demo_poblar", motivo, total, conteos);
    });

    log("poblar", "LISTO — resumen:");
    for (const [k, v] of Object.entries(conteos)) log("poblar", `  · ${k}: ${v}`);
}

async function main() {
    const args = parseArgs(process.argv, ["motivo", "confirm", "semilla"]);
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    const confirm = args.confirm === true;
    const semilla = typeof args.semilla === "string" ? Number.parseInt(args.semilla, 10) : 20260901;
    if (!Number.isFinite(semilla)) throw new Error("[poblar] --semilla debe ser entero.");
    await ejecutar(motivo, confirm, semilla);
}

if (process.argv[1]?.endsWith("poblar-demo.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[poblar] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
