/**
 * PI · Spec 678 — Hijos + identificadores activos demo5 (poblador liviano · tapa-hueco entrega 2).
 *
 * Último eslabón del camino del padre. Tras #593 (consentimiento + perfil) los 60
 * padres demo5 quedan en el paso «hijos» (estado.ts:74-77 exige ≥1 `Hijo` con
 * estado="activo"); sin eso NO llegan al tablero del padre, que es donde vive el
 * rediseño de «A quién protejo» (Fases B/C/D). Este script los destraba por el
 * CARRIL DEL POBLADOR, no a mano.
 *
 * Además siembra 1–2 IdentificadorHijo ACTIVOS por hijo: sin ellos el tablero entra
 * al estado hueco-cobertura (hijo sin cuenta vigilada) y el GRÁFICO de protección
 * sale vacío. Con ellos, Jelkin camina el rediseño poblado. Crear identificadores es
 * un create en la misma tx + logAudit — NO despierta workers: el motor de señal
 * comunitaria matchea al procesar un REPORTE (reporte-side), no al crear el
 * identificador; no hay middleware ni trigger de insert (verificado contra registrarHijo).
 *
 * SALVAGUARDA (misma que #593): SOLO usuarios marcados `demo_marcado` corrida v5.
 * Un usuario real nunca está marcado → no entra jamás. Y SOLO rol PARENT: el paso
 * «hijos» es del camino del padre; un rector (SCHOOL_ADMIN) no tiene hijos.
 *
 * MARCADO ≠ FORJADO: cada `Hijo` y cada `IdentificadorHijo` sembrado se ETIQUETA en
 * `demo_marcado` (corrida v5) vía `marcar()`. Y ambos se agregaron a ENTIDADES_ORDEN_BORRADO
 * (IdentificadorHijo → Hijo → Usuario): las filas caen por cascada al borrar el Usuario,
 * pero sus marcas son polimórficas (sin FK) y no caerían — el borrador ahora las limpia.
 *
 * `valor` del identificador pasa por `normalizarIdentificador` (trim+lowercase): la MISMA
 * forma canónica que escribe el núcleo, para que el sembrado sea estructuralmente idéntico.
 *
 * Uso (lo corre el CEO; Datos no escribe prod a mano):
 *   node --import tsx scripts/demo/sembrar-hijos-demo5.ts --dry-run
 *   node --import tsx scripts/demo/sembrar-hijos-demo5.ts
 *
 * Idempotente: salta al padre que YA tiene ≥1 hijo activo (mismo criterio que el
 * derivador). Re-correr no agrega un segundo lote.
 */
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { normalizarIdentificador } from "../../src/lib/dal/identificadores/normalizar";
import { CORRIDA_V5, enLotes, marcar } from "./_marcado";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const SCRIPT = "sembrar-hijos-demo5";
const ANIO_ACTUAL = new Date().getFullYear();

const NOMBRES_NINO = [
    "Mateo", "Emma", "Samuel", "Sofía", "Martín", "Valentina", "Tomás", "Isabella",
    "Emiliano", "Luciana", "Benjamín", "Antonella", "Gabriel", "Salomé", "Daniel", "Mariana",
];
const APELLIDOS_FALLBACK = ["Gómez", "Rodríguez", "Martínez", "López", "García", "Pérez"];

// Entero determinista por (id, sal): el dry-run muestra exactamente lo que escribirá el run real.
function hashInt(id: string, sal: string): number {
    return createHash("sha1").update(sal + id).digest().readUInt32BE(0);
}

// sexo: set cerrado en Zod (src/lib/schemas/identidad.ts:12 → "M" | "F" | "OTRO").
// Peso realista: ~10% OTRO, resto M/F repartido — un tablero con 1/3 OTRO se ve raro.
function sexoDemo(id: string, i: number): string {
    const r = hashInt(id, `sexo${i}`) % 10;
    if (r === 0) return "OTRO";
    return r % 2 === 0 ? "M" : "F";
}

interface Ficha {
    nombre: string;
    apellidos: string;
    anioNacimiento: number;
    sexo: string;
    estado: string;
}

interface IdentData {
    valor: string;
    tipo: string;
    plataformaId: string | null;
    activo: boolean;
}

// 1–2 fichas por padre, deterministas. `apellidos` reusa el del padre (familia) o cae
// a un demo si el padre no lo tiene.
function fichasDe(padreId: string, apellidosPadre: string | null): Ficha[] {
    const apellidos = apellidosPadre && apellidosPadre.trim() !== ""
        ? apellidosPadre
        : APELLIDOS_FALLBACK[hashInt(padreId, "apellidos") % APELLIDOS_FALLBACK.length];
    const cuantos = 1 + (hashInt(padreId, "cuantos") % 2); // 1 o 2
    const fichas: Ficha[] = [];
    for (let i = 0; i < cuantos; i++) {
        fichas.push({
            nombre: NOMBRES_NINO[hashInt(padreId, `nombre${i}`) % NOMBRES_NINO.length],
            apellidos,
            anioNacimiento: ANIO_ACTUAL - (6 + (hashInt(padreId, `edad${i}`) % 12)), // 6–17 años
            sexo: sexoDemo(padreId, i),
            estado: "activo",
        });
    }
    return fichas;
}

// 1–2 identificadores activos por hijo. Keyed on (padreId, hijoIdx, identIdx) para que el
// dry-run (sin hijo.id) prediga lo mismo que el run real. plataformaId sale del catálogo.
function identificadoresDe(
    padreId: string,
    hijoIdx: number,
    nombre: string,
    plataformas: { id: string }[],
): IdentData[] {
    // ~30% de los hijos quedan SIN cuenta: es el estado de hueco de cobertura
    // (BloqueHuecoCobertura, Fase D). Los dos estados tienen que convivir en la lista,
    // o el demo enseña un solo estado. Determinista por (padreId, hijoIdx) = el dry-run predice el real.
    if (hashInt(padreId, `sin-cuentas-${hijoIdx}`) % 10 < 3) return [];
    const base = nombre.toLowerCase();
    const cuantos = 1 + (hashInt(padreId, `n-ident-${hijoIdx}`) % 2); // 1 o 2
    const out: IdentData[] = [];
    for (let i = 0; i < cuantos; i++) {
        const handle = `${base}.${hashInt(padreId, `handle-${hijoIdx}-${i}`) % 1000}`;
        out.push({
            valor: normalizarIdentificador(handle), // MISMA forma canónica que el núcleo
            tipo: "usuario",
            plataformaId: plataformas.length > 0
                ? plataformas[hashInt(padreId, `plat-${hijoIdx}-${i}`) % plataformas.length].id
                : null,
            activo: true,
        });
    }
    return out;
}

async function main() {
    // SALVAGUARDA 1: solo usuarios marcados demo_marcado corrida v5.
    const marcados = await prisma.demoMarcado.findMany({
        where: { entidad: "Usuario" },
        select: { entidadId: true, metadata: true },
    });
    const idsV5 = marcados
        .filter((m) => (m.metadata as { corrida?: string } | null)?.corrida === CORRIDA_V5)
        .map((m) => m.entidadId);

    // SALVAGUARDA 2: solo PARENT (el paso «hijos» es del camino del padre).
    const padres = (
        await enLotes(idsV5, (trozo) =>
            prisma.usuario.findMany({
                where: { id: { in: trozo }, rol: "PARENT" },
                select: { id: true, email: true, apellidos: true },
            }),
        )
    ).flat();

    // Catálogo de plataformas para las cuentas vigiladas (no se siembra, se referencia).
    const plataformas = await prisma.plataforma.findMany({ where: { esActiva: true }, select: { id: true, nombre: true } });
    if (plataformas.length === 0) console.warn("[hijos-demo5] AVISO: no hay plataformas activas — los identificadores quedan sin plataformaId.");

    // Idempotencia: ¿qué padres YA tienen ≥1 hijo activo? (mismo criterio que estado.ts:74-77).
    const conHijoActivo = new Set(
        (
            await enLotes(padres.map((p) => p.id), (trozo) =>
                prisma.hijo.findMany({
                    where: { usuarioId: { in: trozo }, estado: "activo" },
                    select: { usuarioId: true },
                    distinct: ["usuarioId"],
                }),
            )
        )
            .flat()
            .map((h) => h.usuarioId),
    );

    const pendientes = padres.filter((p) => !conHijoActivo.has(p.id));
    console.log(`[hijos-demo5] padres v5 (PARENT): ${padres.length} · con hijo activo: ${conHijoActivo.size} · pendientes: ${pendientes.length} · plataformas activas: ${plataformas.length}${DRY_RUN ? "  (DRY-RUN, no escribe)" : ""}`);

    let hijosCreados = 0;
    let identsCreados = 0;
    let hijosSinCuenta = 0;
    for (const padre of pendientes) {
        const fichas = fichasDe(padre.id, padre.apellidos);

        if (DRY_RUN) {
            for (let hi = 0; hi < fichas.length; hi++) {
                const f = fichas[hi];
                const idents = identificadoresDe(padre.id, hi, f.nombre, plataformas);
                if (idents.length === 0) hijosSinCuenta++;
                const cuentas = idents.length > 0 ? idents.map((d) => d.valor).join(", ") : "SIN CUENTA (hueco de cobertura)";
                console.log(`  [dry] ${padre.email} → ${f.nombre} ${f.apellidos} (${f.sexo}, ${f.anioNacimiento}) · cuentas: ${cuentas}`);
                identsCreados += idents.length;
            }
            hijosCreados += fichas.length;
            continue;
        }

        await prisma.$transaction(async (tx) => {
            for (let hi = 0; hi < fichas.length; hi++) {
                const hijo = await tx.hijo.create({ data: { usuarioId: padre.id, ...fichas[hi] }, select: { id: true } });
                await marcar(tx, "Hijo", [hijo.id], { script: SCRIPT, notas: "hijo demo5 (camino del padre)" });

                const idents = identificadoresDe(padre.id, hi, fichas[hi].nombre, plataformas);
                if (idents.length === 0) hijosSinCuenta++;
                for (const identData of idents) {
                    const ident = await tx.identificadorHijo.create({ data: { hijoId: hijo.id, ...identData }, select: { id: true } });
                    await marcar(tx, "IdentificadorHijo", [ident.id], { script: SCRIPT, notas: "cuenta vigilada demo5" });
                    identsCreados++;
                }
            }
        });
        hijosCreados += fichas.length;
    }

    console.log(`[hijos-demo5] ${DRY_RUN ? "crearía" : "creados"}: ${hijosCreados} hijo(s) + ${identsCreados} identificador(es) para ${pendientes.length} padre(s). Hijos SIN cuenta (hueco de cobertura): ${hijosSinCuenta}.`);
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error("[hijos-demo5] FALLO:", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
});
