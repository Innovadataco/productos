# Plan SPEC-266 — Hotfix grants COMITE_VALIDACION

## Tarea 1 — Desanclar `expediente_revelar_original` del catálogo

**Archivo**: `src/lib/permisos-catalogo.ts`

Quitar `, padre: "bandeja_reportes"` de la entrada `expediente_revelar_original`.

```ts
// antes
{ clave: "expediente_revelar_original", nombre: "Revelar texto original", categoria: "operador", esCritico: true, orden: 31, padre: "bandeja_reportes" },
// después
{ clave: "expediente_revelar_original", nombre: "Revelar texto original", categoria: "operador", esCritico: true, orden: 31 },
```

---

## Tarea 2 — Simplificar puerta de `revelar-original`

**Archivo**: `src/app/api/admin/reportes/[id]/revelar-original/route.ts`

Eliminar línea 21 (`await assertModulo(user, "bandeja_reportes");`). El módulo `expediente_revelar_original` (línea 24) es la verificación correcta y suficiente. OPERADOR tiene ese módulo → sigue teniendo acceso. COMITE también lo tendrá → acceso concedido sin necesitar `bandeja_reportes`.

---

## Tarea 3 — Seed: quitar grants indebidos de COMITE

**Archivo**: `prisma/seed-modulos-grants.ts`

```ts
// antes
COMITE_VALIDACION: ["comite", "comite_bandeja", "comite_guias_accion", "bandeja_reportes", "denuncia_formal", "expediente_revelar_original"],
// después
COMITE_VALIDACION: ["comite", "comite_bandeja", "comite_guias_accion", "expediente_revelar_original"],
```

---

## Tarea 4 — Extender script de revocación

**Archivo**: `scripts/revocar-grants-pagos-operador.ts`

Añadir la función exportada `revocarGrantsComiteIndebidos()` siguiendo el SPEC-128 pattern exacto del bloque OPERADOR existente. Módulos a revocar: `["bandeja_reportes", "denuncia_formal"]`, rol `"COMITE_VALIDACION"`. Extender `main()` para invocarla también, con su bloque de logging simétrico.

La función reutiliza el mismo `main()` del script y comparte la sesión Prisma.

---

## Tarea 5 — Test de regresión: 4 claves COMITE

**Archivo**: `prisma/seed-security.test.ts`

- Línea 67: actualizar descripción del test.
- Línea 80: cambiar `toEqual` a las 4 claves: `['"comite"', '"comite_bandeja"', '"comite_guias_accion"', '"expediente_revelar_original"']`.
- Actualizar comentario inline (quitar referencias a `bandeja_reportes` y `denuncia_formal`).

---

## Tarea 6 — Regenerar arch:check

```bash
npx tsx scripts/arch/generar-roles-capacidades.ts
```

---

## Tarea 7 — CI guards

- `specs/266-hotfix-grants-comite/tasks.md` — archivo vacío de guard CI.
- `specs/README.md` — añadir entrada SPEC-266.

---

## Verificación pre-push

```bash
npx tsc --noEmit
npx vitest run prisma/seed-security.test.ts
npx vitest run src/app/api/admin/reportes-revision/
npx vitest run src/app/api/admin/comite/
```
