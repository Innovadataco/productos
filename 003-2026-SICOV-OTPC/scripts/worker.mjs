// Worker table-driven ÚNICO del 003: TRES pasadas por ciclo (despachos + llegadas +
// mantenimientos, spec 005-A) bajo UN SOLO advisory lock. NO usa pg-boss. Reintentos/backoff
// por env (COLA_MAX_REINTENTOS/COLA_BACKOFF_MIN — D-019b). Ejecutar vía `npm run worker`.
import { prisma } from "../src/lib/prisma.ts";
import { procesarLote } from "../src/lib/despachos/cola.ts";
import { procesarLoteLlegadas } from "../src/lib/llegadas/cola.ts";
import { procesarLoteMantenimientos } from "../src/lib/mantenimientos/cola.ts";

// ID de advisory lock PROPIO del 003 (distinto al de 002) → coexistencia entre workers.
const LOCK_ID = 30032026;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const filas = await prisma.$queryRaw`SELECT pg_try_advisory_lock(${LOCK_ID}) as locked`;
  const locked = filas?.[0]?.locked === true;
  if (!locked) {
    console.error("[worker] Otra instancia ya tiene el lock; saliendo.");
    process.exit(2);
  }

  const autostart = (process.env.DESPACHOS_WORKER_AUTOSTART ?? "true") === "true";
  if (!autostart || process.env.NODE_ENV === "test") {
    console.log("[worker] autostart deshabilitado; saliendo.");
    process.exit(0);
  }

  let corriendo = true;
  const parar = async (sig) => {
    corriendo = false;
    console.log(`[worker] ${sig} recibido; liberando lock.`);
    try {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(${LOCK_ID})`;
      await prisma.$disconnect();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGTERM", () => parar("SIGTERM"));
  process.on("SIGINT", () => parar("SIGINT"));

  console.log("[worker] iniciado (modo integración:", process.env.INTEGRACIONES_MODO ?? "stub", ")");
  while (corriendo) {
    try {
      // Pasada 1: despachos. Pasada 2: llegadas. Pasada 3: mantenimientos. Mismo proceso, mismo lock.
      const d = await procesarLote({});
      const l = await procesarLoteLlegadas({});
      const m = await procesarLoteMantenimientos({});
      const hubo =
        d.procesados + d.reprogramados + d.fallidos +
        l.procesados + l.reprogramados + l.fallidos +
        m.procesados + m.reprogramados + m.fallidos;
      if (hubo === 0) {
        await sleep(1000); // idle backoff
      } else {
        console.log(
          `[worker] despachos:${JSON.stringify(d)} llegadas:${JSON.stringify(l)} mantenimientos:${JSON.stringify(m)}`,
        );
      }
    } catch (e) {
      console.error("[worker] error de ciclo:", e?.message ?? e);
      await sleep(2000);
    }
  }
}

main().catch((e) => {
  console.error("[worker] fatal:", e);
  process.exit(1);
});
