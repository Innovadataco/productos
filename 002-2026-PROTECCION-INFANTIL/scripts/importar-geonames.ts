/**
 * SPEC-115: importador idempotente del catálogo geográfico GeoNames (LATAM + Centroamérica).
 *
 * Uso:
 *   node --env-file=.env --import tsx scripts/importar-geonames.ts [--force] [--paises=CO,MX]
 *
 * - Descarga https://download.geonames.org/export/dump/{ISO2}.zip (+ admin1CodesASCII.txt)
 *   a scripts/.geonames-cache/ (reutiliza zips con < 7 días; --force re-descarga).
 * - Importa feature class P (sedes administrativas PPLC/PPLA/PPLA2/PPLA3/PPLA4 o
 *   población > 0) y la capa municipal canónica A.ADM2 (centroide; cubre municipios
 *   cuya sede GeoNames registra sin población, p.ej. Girardot).
 * - UPSERT por clave estable geonameId: re-ejecutar NO duplica ni pierde nada; las FK
 *   Reporte.ciudadId quedan intactas (los ids internos nunca cambian).
 * - Enriquece las ciudades preexistentes que casan por nombre normalizado + país
 *   (les fija geonameId/lat/lng/poblacion/departamentoId) en vez de duplicarlas.
 * - Nunca borra filas. Los descartes por nombre duplicado exacto se loguean.
 *
 * Licencia de los datos: GeoNames, CC-BY 4.0 (atribución visible en privacidad y en el
 * buscador de ciudades — ver specs/115-catalogo-geografico-latam/research.md).
 */

import * as zlib from "node:zlib";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";
import { normalizarNombreGeografico } from "../src/lib/normalizar";

const prisma = new PrismaClient();

// Lista cerrada del alcance (002-PI-041/B1): México + Centroamérica + Suramérica.
// Los países existentes no listados (p.ej. DO) se conservan intactos.
const PAISES_IMPORTAR: { codigo: string; nombre: string }[] = [
    { codigo: "MX", nombre: "México" },
    { codigo: "GT", nombre: "Guatemala" },
    { codigo: "BZ", nombre: "Belice" },
    { codigo: "SV", nombre: "El Salvador" },
    { codigo: "HN", nombre: "Honduras" },
    { codigo: "NI", nombre: "Nicaragua" },
    { codigo: "CR", nombre: "Costa Rica" },
    { codigo: "PA", nombre: "Panamá" },
    { codigo: "CO", nombre: "Colombia" },
    { codigo: "VE", nombre: "Venezuela" },
    { codigo: "EC", nombre: "Ecuador" },
    { codigo: "PE", nombre: "Perú" },
    { codigo: "BR", nombre: "Brasil" },
    { codigo: "BO", nombre: "Bolivia" },
    { codigo: "PY", nombre: "Paraguay" },
    { codigo: "CL", nombre: "Chile" },
    { codigo: "AR", nombre: "Argentina" },
    { codigo: "UY", nombre: "Uruguay" },
];

const SEAT_CODES = new Set(["PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4"]);

// Capitales cuyo nombre principal GeoNames viene en inglés; el override deja el
// display en español y permite casar con la ciudad legado del seed (enriquecimiento).
const NOMBRES_OVERRIDE: Record<number, string> = {
    3530597: "Ciudad de México", // Mexico City
    3598132: "Ciudad de Guatemala", // Guatemala City
    3703443: "Ciudad de Panamá", // Panama City
};

const CACHE_DIR = path.join(__dirname, ".geonames-cache");
const CACHE_MAX_EDAD_MS = 7 * 24 * 60 * 60 * 1000;
const CHUNK_INSERT = 2000;

const FORCE = process.argv.includes("--force");
const argPaises = process.argv.find((a) => a.startsWith("--paises="));
const SOLO_PAISES = argPaises ? new Set(argPaises.slice("--paises=".length).split(",")) : null;

type FilaGeo = {
    geonameId: number;
    nombre: string;
    lat: number;
    lng: number;
    /** 3 = sede administrativa P, 2 = división municipal ADM2, 1 = localidad con población */
    prioridad: number;
    admin1: string;
    poblacion: number;
};

function descargar(url: string, destino: string): Promise<void> {
    if (!FORCE && fs.existsSync(destino) && Date.now() - fs.statSync(destino).mtimeMs < CACHE_MAX_EDAD_MS) {
        return Promise.resolve();
    }
    console.log(`[GeoNames] Descargando ${url}`);
    // 002-PI-051 (B1): fetch nativo (la imagen prod no tiene curl).
    return fetch(url).then(async (res) => {
        if (!res.ok) throw new Error(`Descarga falló (${res.status}): ${url}`);
        fs.writeFileSync(destino, Buffer.from(await res.arrayBuffer()));
    });
}

/**
 * Lee un .txt de un zip GeoNames SIN `unzip` (la imagen prod no lo trae, B1):
 * parsea el directorio central del ZIP e infla con zlib nativo (método 8) o
 * devuelve el contenido plano (método 0). Soporta un archivo por zip.
 */
function leerDump(zipPath: string, txtName: string): string {
    const buf = fs.readFileSync(zipPath);
    const eocdIdx = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocdIdx === -1) throw new Error(`ZIP inválido (sin EOCD): ${zipPath}`);
    const totalEntradas = buf.readUInt16LE(eocdIdx + 10);
    let off = buf.readUInt32LE(eocdIdx + 16);

    for (let i = 0; i < totalEntradas; i++) {
        if (buf.readUInt32LE(off) !== 0x02014b50) break;
        const metodo = buf.readUInt16LE(off + 10);
        const tamComprimido = buf.readUInt32LE(off + 20);
        const tamNombre = buf.readUInt16LE(off + 28);
        const tamExtra = buf.readUInt16LE(off + 30);
        const tamComentario = buf.readUInt16LE(off + 32);
        const localOffset = buf.readUInt32LE(off + 42);
        const nombre = buf.subarray(off + 46, off + 46 + tamNombre).toString("utf8");
        if (nombre === txtName) {
            const lhNombre = buf.readUInt16LE(localOffset + 26);
            const lhExtra = buf.readUInt16LE(localOffset + 28);
            const inicioDatos = localOffset + 30 + lhNombre + lhExtra;
            const datos = buf.subarray(inicioDatos, inicioDatos + tamComprimido);
            if (metodo === 8) return zlib.inflateRawSync(datos).toString("utf8");
            if (metodo === 0) return datos.toString("utf8");
            throw new Error(`Método de compresión no soportado (${metodo}) en ${zipPath}`);
        }
        off += 46 + tamNombre + tamExtra + tamComentario;
    }
    throw new Error(`No se pudo leer ${txtName} de ${zipPath} (¿dump corrupto o incompleto?)`);
}

function parsearDump(tsv: string): FilaGeo[] {
    const filas: FilaGeo[] = [];
    for (const linea of tsv.split("\n")) {
        if (!linea) continue;
        const c = linea.split("\t");
        if (c.length < 19) throw new Error(`Línea con ${c.length} columnas (esperadas 19): dump inválido`);
        const poblacion = parseInt(c[14], 10) || 0;
        let prioridad: number;
        if (c[6] === "P" && SEAT_CODES.has(c[7])) {
            prioridad = 3;
        } else if (c[6] === "P" && poblacion > 0) {
            prioridad = 1;
        } else if (c[6] === "A" && c[7] === "ADM2") {
            // Capa municipal canónica (CO 1122, MX 2471, SV 44…): cubre municipios cuya
            // sede GeoNames registra como PPLX con población 0 (p.ej. Girardot, CO).
            prioridad = 2;
        } else {
            continue;
        }
        const geonameId = parseInt(c[0], 10);
        filas.push({
            geonameId,
            nombre: NOMBRES_OVERRIDE[geonameId] ?? c[1],
            lat: parseFloat(c[4]),
            lng: parseFloat(c[5]),
            prioridad,
            admin1: c[10],
            poblacion,
        });
    }
    return filas;
}

/** Dedupe por nombre exacto dentro del país (única preexistente (nombre, paisId)):
 *  gana la sede administrativa, luego la división municipal ADM2, luego mayor
 *  población, luego menor geonameId. */
function deduplicar(filas: FilaGeo[]): { unicas: FilaGeo[]; descartadas: number } {
    const porNombre = new Map<string, FilaGeo>();
    let descartadas = 0;
    const ordenadas = [...filas].sort((a, b) =>
        b.prioridad - a.prioridad || b.poblacion - a.poblacion || a.geonameId - b.geonameId
    );
    for (const f of ordenadas) {
        if (porNombre.has(f.nombre)) {
            descartadas++;
            continue;
        }
        porNombre.set(f.nombre, f);
    }
    return { unicas: [...porNombre.values()], descartadas };
}

function limpiarNombreAdmin1(nombre: string): string {
    return nombre.replace(/\s+Department$/i, "").trim();
}

async function asegurarDepartamentos(
    codigoPais: string,
    paisId: string,
    admin1: Map<string, string>
): Promise<Map<string, string>> {
    // codigo GeoNames "CO.05" -> departamentoId
    const existentes = await prisma.departamento.findMany({
        where: { paisId },
        select: { id: true, nombre: true, codigo: true },
    });
    const porNorm = new Map(existentes.map((d) => [normalizarNombreGeografico(d.nombre), d]));
    const resultado = new Map<string, string>();

    for (const [codigo, nombreGeo] of admin1) {
        const nombreLimpio = limpiarNombreAdmin1(nombreGeo);
        const norm = normalizarNombreGeografico(nombreLimpio);
        const existente = porNorm.get(norm);
        if (existente) {
            if (!existente.codigo) {
                await prisma.departamento.update({ where: { id: existente.id }, data: { codigo } });
            }
            resultado.set(codigo, existente.id);
        } else {
            const creado = await prisma.departamento.upsert({
                where: { codigo },
                update: {},
                create: { nombre: nombreLimpio, codigo, paisId },
            });
            porNorm.set(norm, creado);
            resultado.set(codigo, creado.id);
        }
    }
    return resultado;
}

async function importarPais(
    pais: { codigo: string; nombre: string },
    admin1PorCodigo: Map<string, Map<string, string>>
): Promise<void> {
    const zipPath = path.join(CACHE_DIR, `${pais.codigo}.zip`);
    await descargar(`https://download.geonames.org/export/dump/${pais.codigo}.zip`, zipPath);
    const tsv = leerDump(zipPath, `${pais.codigo}.txt`);

    const filas = parsearDump(tsv);
    const { unicas, descartadas } = deduplicar(filas);

    const paisRow = await prisma.pais.upsert({
        where: { codigo: pais.codigo },
        update: {},
        create: { codigo: pais.codigo, nombre: pais.nombre },
    });

    const admin1 = admin1PorCodigo.get(pais.codigo) ?? new Map<string, string>();
    const departamentos = await asegurarDepartamentos(pais.codigo, paisRow.id, admin1);
    const depIdPorAdmin1 = new Map<string, string>();
    for (const [codigo, depId] of departamentos) {
        depIdPorAdmin1.set(codigo.split(".")[1], depId);
    }

    const antes = await prisma.ciudad.count({ where: { paisId: paisRow.id } });
    const existentes = await prisma.ciudad.findMany({
        where: { paisId: paisRow.id },
        select: { id: true, nombre: true, nombreNormalizado: true, geonameId: true, lat: true, lng: true, poblacion: true, departamentoId: true },
    });
    const legadoPorNorm = new Map<string, (typeof existentes)[number]>();
    const porGeonameId = new Map<number, (typeof existentes)[number]>();
    for (const c of existentes) {
        if (c.geonameId == null && !legadoPorNorm.has(c.nombreNormalizado || normalizarNombreGeografico(c.nombre))) {
            legadoPorNorm.set(c.nombreNormalizado || normalizarNombreGeografico(c.nombre), c);
        }
        if (c.geonameId != null) porGeonameId.set(c.geonameId, c);
    }

    let enriquecidas = 0;
    let actualizadas = 0;
    let sinCambios = 0;
    const aInsertar: {
        nombre: string;
        nombreNormalizado: string;
        paisId: string;
        departamentoId: string | null;
        lat: number;
        lng: number;
        poblacion: number;
        geonameId: number;
    }[] = [];

    for (const f of unicas) {
        const norm = normalizarNombreGeografico(f.nombre);
        const departamentoId = depIdPorAdmin1.get(f.admin1) ?? null;

        // 1) Enriquecer legado sin geonameId que casa por nombre normalizado
        const legado = legadoPorNorm.get(norm);
        if (legado) {
            legadoPorNorm.delete(norm);
            await prisma.ciudad.update({
                where: { id: legado.id },
                data: {
                    geonameId: f.geonameId,
                    lat: f.lat,
                    lng: f.lng,
                    poblacion: f.poblacion,
                    nombreNormalizado: norm,
                    departamentoId: departamentoId ?? legado.departamentoId,
                },
            });
            porGeonameId.set(f.geonameId, { ...legado, geonameId: f.geonameId, lat: f.lat, lng: f.lng, poblacion: f.poblacion, departamentoId });
            enriquecidas++;
            continue;
        }

        // 2) Ya importado antes: UPSERT por geonameId (solo si hay cambios reales)
        const previo = porGeonameId.get(f.geonameId);
        if (previo) {
            if (
                previo.lat !== f.lat ||
                previo.lng !== f.lng ||
                previo.poblacion !== f.poblacion ||
                previo.nombreNormalizado !== norm ||
                previo.departamentoId !== departamentoId
            ) {
                await prisma.ciudad.updateMany({
                    where: { geonameId: f.geonameId },
                    data: { lat: f.lat, lng: f.lng, poblacion: f.poblacion, nombreNormalizado: norm, departamentoId },
                });
                actualizadas++;
            } else {
                sinCambios++;
            }
            continue;
        }

        // 3) Nueva
        aInsertar.push({
            nombre: f.nombre,
            nombreNormalizado: norm,
            paisId: paisRow.id,
            departamentoId,
            lat: f.lat,
            lng: f.lng,
            poblacion: f.poblacion,
            geonameId: f.geonameId,
        });
    }

    let insertadas = 0;
    for (let i = 0; i < aInsertar.length; i += CHUNK_INSERT) {
        const chunk = aInsertar.slice(i, i + CHUNK_INSERT);
        const res = await prisma.ciudad.createMany({ data: chunk, skipDuplicates: true });
        insertadas += res.count;
    }
    const omitidasEnInsert = aInsertar.length - insertadas;

    // Backfill: toda ciudad del país sin nombreNormalizado (legado no enriquecido)
    const sinNorm = await prisma.ciudad.findMany({
        where: { paisId: paisRow.id, nombreNormalizado: "" },
        select: { id: true, nombre: true },
    });
    for (const c of sinNorm) {
        await prisma.ciudad.update({
            where: { id: c.id },
            data: { nombreNormalizado: normalizarNombreGeografico(c.nombre) },
        });
    }

    const despues = await prisma.ciudad.count({ where: { paisId: paisRow.id } });
    console.log(
        `[GeoNames] ${pais.codigo}: dump=${filas.length} dedupe=${descartadas} ` +
            `enriquecidas=${enriquecidas} insertadas=${insertadas} actualizadas=${actualizadas} ` +
            `sin_cambios=${sinCambios} omitidas=${omitidasEnInsert} backfill=${sinNorm.length} ` +
            `ciudades ${antes} -> ${despues}`
    );
}

async function main() {
    fs.mkdirSync(CACHE_DIR, { recursive: true });

    const admin1Path = path.join(CACHE_DIR, "admin1CodesASCII.txt");
    await descargar("https://download.geonames.org/export/dump/admin1CodesASCII.txt", admin1Path);
    const admin1PorCodigo = new Map<string, Map<string, string>>();
    for (const linea of fs.readFileSync(admin1Path, "utf8").split("\n")) {
        if (!linea) continue;
        const [codigo, nombre] = linea.split("\t");
        const cc = codigo.split(".")[0];
        if (!admin1PorCodigo.has(cc)) admin1PorCodigo.set(cc, new Map());
        admin1PorCodigo.get(cc)!.set(codigo, nombre);
    }

    const paises = SOLO_PAISES ? PAISES_IMPORTAR.filter((p) => SOLO_PAISES.has(p.codigo)) : PAISES_IMPORTAR;
    const fallidos: string[] = [];
    for (const p of paises) {
        try {
            await importarPais(p, admin1PorCodigo);
        } catch (error) {
            fallidos.push(p.codigo);
            console.error(`[GeoNames] ERROR en ${p.codigo}:`, error instanceof Error ? error.message : error);
        }
    }

    const totalCiudades = await prisma.ciudad.count();
    const conCoords = await prisma.ciudad.count({ where: { lat: { not: null } } });
    const totalPaises = await prisma.pais.count();
    const totalDepartamentos = await prisma.departamento.count();
    console.log(
        `[GeoNames] RESUMEN: paises=${totalPaises} departamentos=${totalDepartamentos} ` +
            `ciudades=${totalCiudades} con_coordenadas=${conCoords} fallidos=${fallidos.length ? fallidos.join(",") : "ninguno"}`
    );
    if (fallidos.length > 0) process.exitCode = 1;
}

main()
    .catch((error) => {
        console.error("[GeoNames] Error fatal:", error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
