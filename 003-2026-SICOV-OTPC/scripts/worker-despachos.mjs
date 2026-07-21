// Worker table-driven de la cola de despachos (paridad start/despachos_queue_worker.ts del legacy).
// Sondea tbl_despachos_solicitudes; NO usa pg-boss. Instancia única por advisory lock.
// Ejecutar vía el supervisor: `npm run worker` (usa node --import tsx).
import { prisma } from "../src/lib/prisma.ts";
import { procesarLote } from "../src/lib/despachos/cola.ts";

// ID de advisory lock PROPIO del 003 (distinto al de 002) → los dos workers coexisten.
const LOCK_ID = 30032026;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const filas = await prisma.$queryRaw`SELECT pg_try_advisory_lock(${LOCK_ID}) as locked`;
  const locked = filas?.[0]?.locked === true;
  if (!locked) {
    console.error("[worker-despachos] Otra instancia ya tiene el lock; saliendo.");
    process.exit(2);
  }

  const autostart = (process.env.DESPACHOS_WORKER_AUTOSTART ?? "true") === "true";
  if (!autostart || process.env.NODE_ENV === "test") {
    console.log("[worker-despachos] autostart deshabilitado; saliendo.");
    process.exit(0);
  }

  let corriendo = true;
  const parar = async (sig) => {
    corriendo = false;
    console.log(`[worker-despachos] ${sig} recibido; liberando lock.`);
    try {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(${LOCK_ID})`;
      await prisma.$disconnect();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGTERM", () => parar("SIGTERM"));
  process.on("SIGINT", () => parar("SIGINT"));

  console.log("[worker-despachos] iniciado (modo integración:", process.env.INTEGRACIONES_MODO ?? "stub", ")");
  while (corriendo) {
    try {
      const r = await procesarLote({});
      if (r.procesados === 0 && r.reprogramados === 0 && r.fallidos === 0) {
        await sleep(1000); // idle backoff
      } else {
        console.log(`[worker-despachos] lote: ${JSON.stringify(r)}`);
      }
    } catch (e) {
      console.error("[worker-despachos] error de lote:", e?.message ?? e);
      await sleep(2000);
    }
  }
}

main().catch((e) => {
  console.error("[worker-despachos] fatal:", e);
  process.exit(1);
});
