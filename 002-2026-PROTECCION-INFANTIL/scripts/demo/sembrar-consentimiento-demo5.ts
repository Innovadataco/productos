/**
 * SPEC-412/v5 · TAPA-HUECO: destrabar a los titulares demo5 (rectores + padres).
 *
 * El poblador v5 dejó a rectores (SCHOOL_ADMIN) y padres (PARENT) SIN el
 * consentimiento NI los datos de perfil que su paso del camino exige, así que la
 * cookie de sesión los devuelve a `/consentimiento` o a «tus datos» y bloquea el
 * recorrido del colegio, SPEC-670 y el semáforo del comité. Se cierra por el
 * CARRIL DEL POBLADOR, no a mano.
 *
 * EL CONSENTIMIENTO NO ALCANZA: es la PRIMERA de varias condiciones del MISMO
 * paso derivado (medido en prod, no supuesto):
 *   - Rector → `estado-colegio.ts:70-71`: consentimiento vigente Y {nombre, apellidos,
 *     documentoTipo, documentoNumero, telefono} (CAMPOS_RECTOR_OBLIGATORIOS :28-34).
 *   - Padre  → `estado.ts:50-68`: consentimiento vigente Y esos 5 + {paisId, ciudadId}
 *     (CAMPOS_PERFIL_OBLIGATORIOS :27-35) Y ≥1 Hijo activo (:74-77).
 * Este script siembra consentimiento + perfil: destraba al rector por completo y
 * mueve al padre de «permiso/datos» a «hijos». El Hijo activo del padre es la
 * ENTREGA 2 (abajo): sin él el padre queda en «hijos», y eso es lo esperado.
 *
 * SOLO TITULARES DEL DATO (SPEC-416): se filtra por `ROLES_TITULARES_DEL_DATO`
 * (PARENT, SCHOOL_ADMIN), importado de la fuente única `roles-titulares.ts` — no una
 * lista nueva. El comité (COMITE_CONVIVENCIA) NO es titular: su cookie fuerza
 * requiereConsentimiento=false (`sesion-estado-emitter.ts:39`) y su pasoCamino es null
 * (:56-62), así que NO rebota. Sembrarle consentimiento no destraba nada y ADEMÁS
 * «degrada el valor probatorio del audit y contamina la evidencia» (docstring de
 * roles-titulares.ts / calidad-audit-consentimientos-nunca-forjar).
 *
 * MARCADO ≠ FORJADO (regla del CEO y de Calidad): cada AuditConsentimiento sembrado y
 * cada Usuario tocado se ETIQUETA en `demo_marcado` (corrida v5) vía `marcar()` — la
 * fuente única del borrador. Es un registro sembrado y declarado, no una aceptación
 * ni una identidad humana real. El `ip`/`userAgent` del audit son marcadores visibles.
 * (AuditConsentimiento se agregó a ENTIDADES_ORDEN_BORRADO para que el borrador limpie
 * también sus marcas: cascada borra la fila, pero la marca es polimórfica y no cae por FK.)
 *
 * NO DISPARA NOTIFICACIÓN (I-402): la aceptación real (`ConsentimientoService.aceptar`)
 * programa un aviso `consentimiento.aceptado`; sembrar 110 dispararía 110 correos sobre
 * un proveedor ya sobre-cupo. Este script escribe SOLO las filas.
 *
 * VALORES DE PERFIL: reales de prod, no inventados. documentoTipo="CC" (único valor en
 * uso); documentoNumero/telefono DISTINTOS por usuario (documentoNumero NO lleva @@unique
 * —schema.prisma:638-641— pero repetirlo 110 veces se lee como basura); paisId/ciudadId se
 * RESUELVEN leyendo `Pais`/`Ciudad` (son String? y prod no impone la FK: un id inventado
 * entra y revienta después en pantalla). Colombia + reparto sobre sus ciudades activas.
 *
 * Uso (lo corre el CEO en el VPS; Datos no escribe prod a mano):
 *   node --import tsx scripts/demo/sembrar-consentimiento-demo5.ts --dry-run
 *   node --import tsx scripts/demo/sembrar-consentimiento-demo5.ts
 *
 * Idempotente por usuario: escribe consentimiento solo si falta la versión vigente
 * (consentimiento.ts:75) y rellena solo los campos de perfil VACÍOS (misma prueba
 * `estaVacio` del derivador). Re-correr no duplica ni pisa.
 *
 * ENTREGA 2 (aparte, NO acá — «no atar lo barato a lo caro»): 1–2 Hijo activos por
 * padre. Ningún poblador crea Hijo hoy. Sin eso el padre queda en «hijos» y «A quién
 * protejo» sigue vacía. Se radica por separado.
 */
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ConsentimientoService } from "../../src/lib/dal/services/consentimiento";
import { ROLES_TITULARES_DEL_DATO } from "../../src/lib/routing/roles-titulares";
import { CORRIDA_V5, enLotes, marcar } from "./_marcado";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const IP_SEMBRADO = "demo5-seed"; // marcador visible, no una IP real
const USER_AGENT_SEMBRADO = "poblar-demo-v5:consentimiento";
const SCRIPT = "sembrar-consentimiento-demo5";
// Pista de resolución, NO un literal ciego: se VERIFICA leyendo Pais (ver resolverColombia).
const PAIS_COLOMBIA_ID = "cms2srl49003pr1n43qonerf0";

// Campos que cada paso del camino exige. Copiados de su fuente y CITADOS; no se
// importan porque los derivadores los declaran `const` sin export. Mantener en
// sincronía con: estado-colegio.ts:28-34 (rector) · estado.ts:27-35 (padre).
const CAMPOS_POR_ROL: Record<"SCHOOL_ADMIN" | "PARENT", readonly string[]> = {
    SCHOOL_ADMIN: ["nombre", "apellidos", "documentoTipo", "documentoNumero", "telefono"],
    PARENT: ["nombre", "apellidos", "documentoTipo", "documentoNumero", "telefono", "paisId", "ciudadId"],
};

// Misma definición de "vacío" que el derivador (estado.ts:37-39 / estado-colegio.ts:36-38):
// null, undefined o string en blanco. Un campo cuenta como lleno solo si pasa esto.
function estaVacio(valor: string | null | undefined): boolean {
    return valor === null || valor === undefined || valor.trim() === "";
}

// Entero determinista por usuario (estable entre dry-run y run real, y entre corridas).
function hashInt(id: string, sal: string): number {
    return createHash("sha1").update(sal + id).digest().readUInt32BE(0);
}

const NOMBRES = ["María", "José", "Ana", "Carlos", "Laura", "Andrés", "Diana", "Jorge", "Paula", "Luis", "Camila", "Santiago"];
const APELLIDOS = ["Gómez", "Rodríguez", "Martínez", "López", "García", "Pérez", "González", "Ramírez", "Torres", "Díaz", "Vargas", "Rojas"];

function nombreDemo(id: string): string {
    return NOMBRES[hashInt(id, "nombre") % NOMBRES.length];
}
function apellidosDemo(id: string): string {
    const h = hashInt(id, "apellidos");
    return `${APELLIDOS[h % APELLIDOS.length]} ${APELLIDOS[Math.floor(h / APELLIDOS.length) % APELLIDOS.length]}`;
}
function documentoNumeroDemo(id: string): string {
    return String(1_000_000_000 + (hashInt(id, "documento") % 900_000_000)); // 10 dígitos, distinto por usuario
}
function telefonoDemo(id: string): string {
    return `3${String(hashInt(id, "telefono") % 1_000_000_000).padStart(9, "0")}`; // móvil CO de 10 dígitos
}

async function resolverColombia() {
    // "No por literal": leemos Pais. El id conocido es una pista; también matcheamos por
    // nombre para ser robustos entre entornos. Abortamos si no aparece (parar es mejor que
    // escribir un paisId que reviente después en pantalla).
    const pais = await prisma.pais.findFirst({
        where: { OR: [{ id: PAIS_COLOMBIA_ID }, { nombre: { equals: "Colombia", mode: "insensitive" } }] },
        select: { id: true, nombre: true },
    });
    if (!pais) throw new Error("No se encontró Colombia en la tabla Pais — abortando (no se inventa paisId).");
    const ciudades = await prisma.ciudad.findMany({
        where: { paisId: pais.id, esActivo: true },
        select: { id: true, nombre: true },
    });
    if (ciudades.length === 0) throw new Error(`Colombia (${pais.id}) sin ciudades activas — abortando (no se inventa ciudadId).`);
    return { pais, ciudades };
}

async function main() {
    const servicio = new ConsentimientoService();
    const versionActual = await servicio.versionVigente(); // lanza si el parámetro no está

    const { pais, ciudades } = await resolverColombia();
    const ciudadNombrePorId = new Map(ciudades.map((c) => [c.id, c.nombre]));
    const ciudadDe = (id: string) => ciudades[hashInt(id, "ciudad") % ciudades.length].id;

    // SALVAGUARDA 1: solo usuarios marcados demo_marcado (corrida v5). Un real no está
    // en demo_marcado → no entra jamás.
    const marcados = await prisma.demoMarcado.findMany({
        where: { entidad: "Usuario" },
        select: { entidadId: true, metadata: true },
    });
    const idsV5 = marcados
        .filter((m) => (m.metadata as { corrida?: string } | null)?.corrida === CORRIDA_V5)
        .map((m) => m.entidadId);

    // SALVAGUARDA 2 (SPEC-416): SOLO titulares del dato — el comité queda afuera por la
    // fuente única, no por una lista nueva. enLotes: el `in:` sobre ids no-acotados se
    // parte para no reventar el límite de 32.767 parámetros (SPEC-420).
    const usuarios = (
        await enLotes(idsV5, (trozo) =>
            prisma.usuario.findMany({
                where: { id: { in: trozo }, rol: { in: [...ROLES_TITULARES_DEL_DATO] } },
                select: {
                    id: true, rol: true, email: true, consentimientoVersion: true,
                    nombre: true, apellidos: true, documentoTipo: true,
                    documentoNumero: true, telefono: true, paisId: true, ciudadId: true,
                },
            }),
        )
    ).flat();

    const porRol = usuarios.reduce<Record<string, number>>((acc, u) => {
        acc[u.rol] = (acc[u.rol] ?? 0) + 1;
        return acc;
    }, {});
    console.log(`[demo5] versión de consentimiento vigente: ${versionActual}`);
    console.log(`[demo5] país: ${pais.nombre} (${pais.id}) · ${ciudades.length} ciudades activas`);
    console.log(`[demo5] titulares v5 seleccionados: ${usuarios.length} ${JSON.stringify(porRol)}${DRY_RUN ? "  (DRY-RUN, no escribe)" : ""}`);
    console.log(`[demo5] v5 NO-titulares excluidos (comité, etc.): ${idsV5.length - usuarios.length}`);

    const hashPorTipo = new Map<string, string>();
    const hashDe = async (tipo: string) => {
        if (!hashPorTipo.has(tipo)) {
            const doc = await servicio.obtenerDocumentoVigente(tipo as never);
            hashPorTipo.set(tipo, servicio.calcularHash(doc));
        }
        return hashPorTipo.get(tipo)!;
    };

    // Valor a escribir por campo — solo se llama para los campos VACÍOS.
    const valorDe: Record<string, (id: string) => string> = {
        nombre: (id) => nombreDemo(id),
        apellidos: (id) => apellidosDemo(id),
        documentoTipo: () => "CC",
        documentoNumero: (id) => documentoNumeroDemo(id),
        telefono: (id) => telefonoDemo(id),
        paisId: () => pais.id,
        ciudadId: (id) => ciudadDe(id),
    };

    let conConsentimiento = 0;
    let conPerfil = 0;
    let saltados = 0;

    for (const u of usuarios) {
        const rol = u.rol as "SCHOOL_ADMIN" | "PARENT";
        // Consentimiento vigente = consentimientoVersion === versión vigente
        // (consentimiento.ts:75 — lo que evalúa requiereConsentimientoActual).
        const necesitaConsentimiento = u.consentimientoVersion !== versionActual;
        const camposFaltantes = CAMPOS_POR_ROL[rol].filter((c) =>
            estaVacio((u as Record<string, string | null>)[c]),
        );

        if (!necesitaConsentimiento && camposFaltantes.length === 0) {
            saltados++;
            continue;
        }

        const perfilData: Record<string, string> = {};
        for (const c of camposFaltantes) perfilData[c] = valorDe[c](u.id);

        if (DRY_RUN) {
            const detalle = camposFaltantes.map((c) =>
                c === "ciudadId" ? `ciudadId→${ciudadNombrePorId.get(perfilData[c])}` : `${c}=${perfilData[c]}`,
            );
            console.log(`  [dry] ${u.email} (${rol}) consentimiento=${necesitaConsentimiento ? "sí" : "ya"} · perfil: ${detalle.length ? detalle.join(", ") : "completo"}`);
            if (necesitaConsentimiento) conConsentimiento++;
            if (camposFaltantes.length) conPerfil++;
            continue;
        }

        const esRepresentanteLegal = rol === "SCHOOL_ADMIN"; // el rector firma como rep. legal del colegio

        await prisma.$transaction(async (tx) => {
            const usuarioData: Record<string, unknown> = { ...perfilData };

            if (necesitaConsentimiento) {
                const documentoTipo = servicio.documentoPorRol(u.rol);
                const documentoHash = await hashDe(documentoTipo); // lee el doc legal — solo en el camino real
                const aceptadoEn = new Date();
                const audit = await tx.auditConsentimiento.create({
                    data: {
                        usuarioId: u.id, version: versionActual, documentoTipo, documentoHash,
                        aceptadoEn, ip: IP_SEMBRADO, userAgent: USER_AGENT_SEMBRADO, esRepresentanteLegal,
                    },
                    select: { id: true },
                });
                usuarioData.consentimientoAceptadoEn = aceptadoEn;
                usuarioData.consentimientoVersion = versionActual;
                usuarioData.consentimientoDocumentoHash = documentoHash;
                usuarioData.consentimientoIP = IP_SEMBRADO;
                // Marca el audit sembrado, en la MISMA tx que lo creó (regla _marcado.ts).
                await marcar(tx, "AuditConsentimiento", [audit.id], {
                    script: SCRIPT, notas: "consentimiento SEMBRADO, no aceptación humana real",
                });
            }

            if (Object.keys(usuarioData).length > 0) {
                await tx.usuario.update({ where: { id: u.id }, data: usuarioData });
            }

            // Marca la fila Usuario que tocamos (idempotente: si ya estaba marcada, se salta).
            await marcar(tx, "Usuario", [u.id], { script: SCRIPT, notas: "perfil/consentimiento sembrados" });
        });

        if (necesitaConsentimiento) conConsentimiento++;
        if (camposFaltantes.length) conPerfil++;
    }

    console.log(`[demo5] ${DRY_RUN ? "haría" : "hecho"}: consentimiento ${conConsentimiento} · perfil ${conPerfil} · saltados ${saltados}`);
    console.log("[demo5] RECORDATORIO entrega 2: falta ≥1 Hijo activo por PARENT → los padres quedan en «hijos».");
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error("[demo5] FALLO:", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
});
