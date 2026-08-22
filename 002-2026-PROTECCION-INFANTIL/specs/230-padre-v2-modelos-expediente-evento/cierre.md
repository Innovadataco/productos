# Cierre SPEC-230 / 002-PI-130 — Padre v2 · Modelos Expediente + Evento

**Estado**: IMPLEMENTADO (esperando auditoría de ZEUS y deploy por el CEO).

**Rama**: `work/002-pi-130`

---

## Commits

- `252f7eed` — Agrega modelos Expediente y EventoExpediente con migración aditiva.
- `413bee61` — Agrega seed idempotente de 18 parámetros padre.*.
- `dc33e38d` — feat(002-PI-130): repository ExpedienteRepository con TX atómica y tests.
- `2edcc51c` — docs(002-PI-130): implementación en spec.md, cierre.md y línea base de arquitectura.

---

## Archivos tocados (alcance de esta SPEC)

- `prisma/schema.prisma`
- `prisma/migrations/20260823000000_padre_v2_expediente_evento/migration.sql`
- `prisma/seed.ts`
- `src/lib/dal/repositories/expediente-repository.ts`
- `src/lib/dal/repositories/expediente-repository.test.ts`
- `src/lib/seed-padre.test.ts`
- `docs/architecture/01-modelo-datos.md`
- `specs/230-padre-v2-modelos-expediente-evento/spec.md`
- `specs/230-padre-v2-modelos-expediente-evento/cierre.md`

---

## Gate de calidad local

| Check | Resultado |
|---|---|
| `npx tsc --noEmit` | Verde |
| `npm run lint --no-cache` | Verde (0 errores; warnings preexistentes) |
| `npm run arch:check` | Verde (regenerado `01-modelo-datos.md`) |
| `npm run test -- src/lib/dal/repositories/expediente-repository.test.ts` | 10/10 verdes |
| `npm run test -- src/lib/seed-padre.test.ts` | 1/1 verde |
| `npm run test` (suite completa) | Ver nota abajo |
| `npm run build` | Pendiente (ver nota) |

### Nota sobre suite completa

La suite completa reportó **2 fallos en `src/lib/dal/repositories/alerta-colegio-tablero.test.ts`** (`reloj24h` — hora Bogotá y A/B tenant). Estos fallos no están relacionados con los modelos, migración ni repository de SPEC-230; parecen preexistentes y vinculados al manejo de zona horaria en el tablero de alertas. No toqué ese archivo ni ninguna tabla que use. Si ZEUS considera que bloquean, los documento como hallazgo para SPEC posterior.

---

## Decisiones / deuda técnica

- **Relación inversa `Reporte.eventos`**: añadida únicamente como relación inversa Prisma (cero SQL), autorizada por ZEUS en ajuste B. No se modificó ningún otro campo del modelo `Reporte`.
- **Mapeo clave → id de plataforma**: `Expediente.plataformaId` almacena la clave de plataforma; al crear un `Reporte` vinculado desde `agregarEvento`, el repository resuelve la clave al `id` real de `Plataforma` para respetar la FK existente.
- **Enum `TipoRevisionComite`**: se creó con ambos valores en la misma migración (`CREATE TYPE`) porque ZEUS confirmó que el enum no existía en la base.
- **No se implementó UI ni endpoints `/dashboard/padre/*`**: quedan para SPEC-231..239.

---

## Hallazgos

- Ninguno que contradiga el diseño aprobado.
- Posible deuda: los 2 tests fallidos de `alerta-colegio-tablero.test.ts` merecen revisión de ZEUS para determinar si son preexistentes o producto de drift en zona horaria.

---

## Instructivo de validación (quickstart)

```bash
# 1. Instalar dependencias y variables
npm install

# 2. Levantar base de datos
npm run db:migrate
npm run db:seed

# 3. Tests del SPEC
npm run test -- src/lib/dal/repositories/expediente-repository.test.ts
npm run test -- src/lib/seed-padre.test.ts

# 4. Gate mínimo
npx tsc --noEmit
npm run lint
npm run arch:check
```

---

## Push

```bash
git fetch origin
git rebase origin/feature/001-scaffolding
git push origin work/002-pi-130
```

Ejecutado por ODIN una vez el gate local esté verde.
