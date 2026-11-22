/**
 * Lo común de los CLI que corren por la vía B (docs/despliegue/produccion.md §11: `cargar-prod.sh` → `inv-cargar`).
 * En producción (NODE_ENV=production, la imagen del migrador), toda salida distinta de 0 termina con esta frase: si un
 * paso no sale bien, se para y se avisa. src/cli/salida-escision.ts tiene hoy su propia copia (lo toca otro frente):
 * tests/unit/cli/via-b.test.ts exige que digan lo mismo.
 */
export const PARE_VIA_B = "⚠️  Vía B: pare la carga y avise al CEO de 008 (§11 del runbook).";
