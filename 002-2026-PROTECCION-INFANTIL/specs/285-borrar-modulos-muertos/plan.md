# Plan SPEC-285 — Borrar módulos muertos + revocación explícita

## Tarea 1 — Quitar `padre` del catálogo

**Archivo**: `src/lib/permisos-catalogo.ts:24`

```ts
// eliminar esta línea
{ clave: "padre", nombre: "Área del padre", categoria: "padre", orden: 40 },
```

`ia_eval` y `apelaciones` no están en el catálogo desde SPEC-068/SPEC-109 (ver spec.md §Verificación previa). No hay más que hacer en el catálogo.

---

## Tarea 2 — Script de revocación

**Archivo nuevo**: `scripts/revocar-grants-modulos-muertos.ts`

Patrón exacto de `scripts/revocar-grants-pagos-operador.ts` (incluye la extensión SPEC-266 `revocarGrantsComiteIndebidos`).

```ts
const MODULOS_MUERTOS = ["ia_eval", "apelaciones", "padre"] as const;

export async function revocarGrantsModulosMuertos(client = prisma) {
  const modulos = await client.moduloPermisible.findMany({
    where: { clave: { in: [...MODULOS_MUERTOS] } },
    select: { id: true, clave: true },
  });
  // Nota: si el catálogo prod no tiene alguna clave, el findMany devuelve menos.
  // Distinto de scripts previos: aquí NO exigimos que existan todas (padre puede
  // no estar sembrado en algunas BD; ia_eval/apelaciones tampoco en BD limpias).
  const ids = modulos.map(m => m.id);
  if (ids.length === 0) {
    return { revocados: 0, yaInactivos: 0, modulosHallados: [] };
  }
  const yaInactivos = await client.permisoModulo.count({
    where: { moduloId: { in: ids }, activo: false },
  });
  return client.$transaction(async (tx) => {
    const res = await tx.permisoModulo.updateMany({
      where: { moduloId: { in: ids }, activo: true },
      data: { activo: false },
    });
    await tx.auditLog.create({
      data: {
        accion: "LOGS_MANTENIMIENTO_PURGA",
        tipoRecurso: "PermisoModulo",
        ipAddress: "script",
        userAgent: "scripts/revocar-grants-modulos-muertos",
        metadatos: {
          tipo: "revocacion_modulos_muertos",
          modulos: modulos.map(m => m.clave),
          filasRevocadas: res.count,
        },
      },
    });
    return { revocados: res.count, yaInactivos, modulosHallados: modulos.map(m => m.clave) };
  });
}
```

Con `main()` estándar que imprime antes/después y usa `process.argv[1]?.endsWith(...)` para no auto-ejecutar en imports.

---

## Tarea 3 — Regenerar arch:check

```bash
npx tsx scripts/arch/generar-roles-capacidades.ts
```

---

## Tarea 4 — Verificar test seed-security

`prisma/seed-security.test.ts` no aserta sobre `padre` en el catálogo (verificado en spec anterior). Si `arch:check` detecta drift, regenerar `docs/architecture/02-roles-capacidades.md`.

---

## Tarea 5 — CI guards

- `specs/285-borrar-modulos-muertos/tasks.md` (guard vacío)
- `specs/README.md` — entrada SPEC-285

---

## Verificación pre-push

```bash
npx tsc --noEmit    # cero errores nuevos
npx vitest run --config vitest.unit.config.ts prisma/seed-security.test.ts src/lib/specs-discipline.test.ts
npm run arch:check
npx eslint src/lib/permisos-catalogo.ts scripts/revocar-grants-modulos-muertos.ts
```
