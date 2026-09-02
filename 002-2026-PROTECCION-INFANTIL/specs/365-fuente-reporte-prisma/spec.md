# SPEC-365 · I-263 — La señal de fuente anti-abuso nunca se guardaba en producción

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1 · **Origen**: I-263 (CEO verificó en prod al validar A-72)

## Qué estaba roto

En producción `FuenteReporte` tenía **0 filas** con 2046 reportes: la señal de
fuente anti-abuso (hash de IP, huella, peso de la fuente) **nunca se persistía**.
Consecuencia: la ráfaga por origen (A-72) y el peso de fuente pre-existente
quedaban inertes — siempre "origen desconocido".

## Causa raíz (verificada en fuente + logs de prod)

`crearFuenteReporte` lanzaba `ReferenceError: prisma is not defined` en **cada
POST** de `/api/reportes`, tragado por el `try/catch` de la ruta (que loguea y no
falla la creación del reporte). Log de prod: `[REPORTES] Error registrando
fuente: prisma is not defined`.

El módulo `src/lib/anti-abuso/fuente-reporte.ts` tenía `const db = tx ?? prisma;`
en tres funciones (líneas 93/130/205) referenciando un `prisma` **global sin
importarlo**. `src/lib/prisma.ts` solo asigna `globalThis.prisma` cuando
`NODE_ENV !== "production"` (singleton de dev). En prod ese global no existe → al
llamar la ruta **sin `tx`**, `tx ?? prisma` evalúa `prisma` → ReferenceError,
antes de cualquier insert. Y `db` era **variable muerta**: las queries ya iban por
los repositorios con `tx`, que importan el singleton correctamente.

**Por qué el CI verde no lo cazó:** `tsc` pasa por la `declare global { var
prisma }` (ambiental); los tests corren en `NODE_ENV=test` → el global existe; y
el test del POST no verificaba que se creara `FuenteReporte`. Clásico
"verde ≠ funciona".

## El arreglo

Se borran las tres líneas muertas `const db = tx ?? prisma;`. Cero cambio de
comportamiento: las funciones ya operaban por `new FuenteReporteRepository(tx)` /
`new ParametroRepository(tx)`, cuyos constructores hacen `tx ?? prisma` con el
`prisma` **importado** (no el global). Sin la referencia al global, el
ReferenceError desaparece y la fila se persiste en prod.

**Barrido candado 22v5:** se buscó el mismo patrón (`?? prisma` sin importar el
singleton) en todo `src/`. Único archivo afectado: este. Los 100+ usos restantes
de `?? prisma` importan el singleton legítimamente (`db` sí se usa).

## Impacto en arquitectura: no

Sin cambios de modelo, ruta ni contrato. Solo se elimina una referencia muerta a
un global inexistente en prod dentro de un módulo de servicio.

## Cómo se probó

- `fuente-reporte.test.ts` — regresión que **reproduce prod**: borra
  `globalThis.prisma` y afirma que `crearFuenteReporte` persiste la fila.
  Verificado que con el bug presente lanza exactamente `ReferenceError: prisma is
  not defined`, y con el arreglo pasa.
- `api/reportes/route.test.ts` — cierra el hueco: un POST exitoso ahora afirma
  que se creó la `FuenteReporte` (con `ipHash` y `pesoAplicado`).
