/**
 * PI · Spec 678 — Hijos activos demo5 (poblador liviano · tapa-hueco entrega 2).
 *
 * Último eslabón del camino del padre. Tras #593 (consentimiento + perfil) los 60
 * padres demo5 quedan en el paso «hijos» (estado.ts:74-77 exige ≥1 `Hijo` con
 * estado="activo"); sin eso NO llegan al tablero del padre, que es donde vive el
 * rediseño de «A quién protejo» (Fases B/C/D). Este script los destraba por el
 * CARRIL DEL POBLADOR, no a mano.
 *
 * SALVAGUARDA (misma que #593): SOLO usuarios marcados `demo_marcado` corrida v5.
 * Un usuario real nunca está marcado → no entra jamás. Y SOLO rol PARENT: el paso
 * «hijos» es del camino del padre; un rector (SCHOOL_ADMIN) no tiene hijos.
 *
 * MARCADO ≠ FORJADO: cada `Hijo` sembrado se ETIQUETA en `demo_marcado` (corrida v5)
 * vía `marcar()`. Además `Hijo` se agregó a ENTIDADES_ORDEN_BORRADO: la fila cae por
 * cascada al borrar el Usuario (onDelete: Cascade), pero su marca es polimórfica (sin
 * FK) y no caería — el borrador ahora la limpia (mismo patrón que AuditConsentimiento).
 *
 * NO dispara notificación: crear un `Hijo` no encola nada. `notificarHijosSiCorresponde`
 * corre en la cadena del worker al procesar un REPORTE (por reporteId), no al crear la
 * ficha; sembrar hijos es silencioso (I-402 no aplica acá, verificado).
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
    console.log(`[hijos-demo5] padres v5 (PARENT): ${padres.length} · con hijo activo: ${conHijoActivo.size} · pendientes: ${pendientes.length}${DRY_RUN ? "  (DRY-RUN, no escribe)" : ""}`);

    let hijosCreados = 0;
    for (const padre of pendientes) {
        const fichas = fichasDe(padre.id, padre.apellidos);

        if (DRY_RUN) {
            const detalle = fichas.map((f) => `${f.nombre} ${f.apellidos} (${f.sexo}, ${f.anioNacimiento})`).join(" · ");
            console.log(`  [dry] ${padre.email} → ${fichas.length} hijo(s): ${detalle}`);
            hijosCreados += fichas.length;
            continue;
        }

        await prisma.$transaction(async (tx) => {
            for (const ficha of fichas) {
                const hijo = await tx.hijo.create({ data: { usuarioId: padre.id, ...ficha }, select: { id: true } });
                // Marca en la MISMA tx que la creó (regla _marcado.ts).
                await marcar(tx, "Hijo", [hijo.id], { script: SCRIPT, notas: "hijo demo5 (camino del padre)" });
            }
        });
        hijosCreados += fichas.length;
    }

    console.log(`[hijos-demo5] ${DRY_RUN ? "crearía" : "creados"}: ${hijosCreados} hijo(s) para ${pendientes.length} padre(s).`);
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error("[hijos-demo5] FALLO:", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
});
