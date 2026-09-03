# Plan · SPEC-412 — El poblador que marca lo que siembra

## Análisis en fuente, antes de codificar

Leído línea por línea antes de escribir nada (candado 15 v5):

| Archivo | Qué se sacó |
|---|---|
| `prisma/schema.prisma:2602` | `DemoMarcado` ya existe: `entidad` + `entidadId` + `metadata Json?`, `@@unique([entidad, entidadId])`. No hace falta migración. |
| `src/lib/validators.ts:38` | `idSchema` = 25 alfanuméricos o UUID. No se toca. |
| `src/lib/schemas/base.ts:10` | `cuidIdSchema` = `z.string().cuid()` → regex `^c[^\s-]{8,}$`. **Los guiones de `demo3-sol-…` son la causa exacta de I-292.** |
| `src/app/api/colegio/comite/solicitudes/[id]/route.ts:38` | Es el punto donde muere el caso del comité. |
| `src/lib/dal/services/inicio-admin.ts:186` | Ya hace `LEFT JOIN "DemoMarcado"` para descontar. Le falta contenido, no lógica. |
| `scripts/demo/_common.ts:166-181` | El mapa `id` completo de v1: 16 formas de prefijo sobre 16 tablas. De ahí sale la lista de tablas que recorre el marcado retroactivo. |
| `scripts/demo/_common-v2.ts:29`, `_common-v3.ts:37`, `_common-v4.ts:33` | Prefijos `demo2-`/`demo3-`/`demo4-` y qué tabla escribe cada uno. |
| `scripts/demo/poblar-demo.ts:86-578` | La estructura completa de siembra que hay que replicar bien. Los catálogos y candados se reusan. |
| `scripts/demo-prod/sembrar-demo.ts` + `lib/marcar.ts` | La arquitectura correcta (cuid + `DemoMarcado`) ya existía desde SPEC-160 y nunca se usó. Se le copia el patrón; **no se le copia el `upsert` fila por fila**. |
| `scripts/demo-prod/purgar-demo.ts` | Borrado por `DemoMarcado` con `--dry-run`. Se le toma el orden FK-safe; se le agrega motivo, `--confirm` y auditoría. |
| `scripts/limpieza/reset-piloto.ts` | Hoy borra todo. Se le agrega una bandera, no se le cambia el camino actual. |
| `eslint.config.mjs:41-56` | `max-lines: 500` aplica a `scripts/**/*.ts`. Por eso el poblador va partido en tres módulos (orquestador · casos · comercial). |
| `src/lib/specs-discipline.test.ts` | Status canónico, `plan.md` + `tasks.md`, fila en `specs/README.md`, línea `Impacto en arquitectura:`. |

**Decisión de diseño que se tomó por esa lectura:** no se parchea la cadena v1→v4. Sus ids deterministas *son* la falla, y su idempotencia depende de ellos: cambiarles la llave rompe el `skipDuplicates` que las hace re-ejecutables. Se escribe el sucesor v5 con la idempotencia apoyada en la corrida de `demo_marcado`, y v1…v4 quedan como están para que `marcar-retroactivo` pueda reconocer lo que ya sembraron.

## Arquitectura de la entrega

```
scripts/demo/
  _marcado.ts            (nuevo)  marcar por lotes · leer marcado · orden FK-safe
  _borrado-marcado.ts    (nuevo)  planDeBorrado() + ejecutarBorrado(), sin CLI
  _common-v5.ts          (nuevo)  volúmenes, corrida, catálogos (reusa v1/v2/v4)
  poblar-demo-v5.ts      (nuevo)  CLI + colegios/aula/padres
  _poblar-v5-casos.ts    (nuevo)  reportes, IA, alertas, transiciones, comité
  _poblar-v5-pagos.ts    (nuevo)  planes, suscripciones y pagos (capa comercial de BI)
  borrar-demo-marcado.ts (nuevo)  CLI del borrado por marcado (v5 y retroactivo)
  marcar-retroactivo.ts  (nuevo)  inventario + marcado de lo ya sembrado
  demo-v5.test.ts        (nuevo)  candados, sin BD
scripts/limpieza/
  reset-piloto.ts        (editado) bandera --solo-sembrado
```

## Cómo se resuelve el `cuid()` con inserción por lotes

El problema: si Prisma genera la llave, el script no la conoce, y sin la llave no puede marcarla ni colgarle hijos.

Solución: `createManyAndReturn` (Prisma 5.22, disponible en PostgreSQL — verificado en el cliente generado). Devuelve las filas creadas; se pide `select` con el `id` **y una clave de negocio única** (`numeroSeguimiento` para `Reporte`, `nit` para `Colegio`, `email` para `Usuario`, `documentoNumero` para `Estudiante`…) para mapear sin depender del orden de retorno.

Con eso, el ciclo de cada bloque es siempre el mismo:

```
planear filas (sin id)  →  createManyAndReturn  →  mapear por clave de negocio
                        →  marcar(entidad, ids) →  usar los ids para los hijos
```

Todo dentro de una `$transaction` por lote, para que no exista jamás una fila sembrada sin su marca.

## Orden de trabajo

1. `_marcado.ts` y su test — el mecanismo primero, porque todo lo demás depende de él.
2. `_common-v5.ts` — configuración y reuso de catálogos.
3. `poblar-demo-v5.ts` + `_poblar-v5-casos.ts`.
4. `_borrado-marcado.ts` + `borrar-demo-marcado.ts`.
5. `marcar-retroactivo.ts`.
6. `reset-piloto.ts --solo-sembrado`.
7. Tests, gate (`tsc`, `eslint`, unit), y prueba real contra una base propia de desarrollo.

## Riesgos y cómo se acotan

| Riesgo | Cómo se acota |
|---|---|
| Borrar un dato real | El borrado lee **solo** `demo_marcado.entidadId`. Además excluye INTOCABLES aunque aparecieran marcados, y reporta antes de tocar nada. |
| El marcado retroactivo marca de más | Va por prefijo de id (`demo`, que cubre las cuatro generaciones de una), no por fecha ni por nombre. Un `cuid()` siempre empieza por `c`, así que no hay falsos positivos. Dry-run por defecto y contraste contra `modeloUsado LIKE 'demo-seed%'`. |
| Alguien ablanda el validador para que abran los casos viejos | Test-candado que exige que `cuidIdSchema` siga rechazando `demo3-sol-…`. |
| Volumen: 9.000 marcas | `createMany` en lotes de 1.000. |
| Ejecutar contra producción por accidente | Este PR no corre nada en producción. La prueba es en dev, y todos los CLI son dry-run por defecto y exigen `--motivo` de 20 caracteres. |
| `.env` equivocado en las pruebas | `--env-file` explícito siempre. La prueba con datos se hizo en una base creada para eso (`pi_spec412`) y destruida al terminar: ni producción, ni la base de pruebas que comparten Calidad y los demás Devs. |
