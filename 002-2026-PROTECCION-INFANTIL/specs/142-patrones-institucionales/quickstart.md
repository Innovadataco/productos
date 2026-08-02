# Quickstart: SPEC-142 — patrones institucionales (F6)

> Spec en **PLANEADO** (compuerta §4: spec+plan). Esta guía se ejecuta al cerrar la
> implementación; los comandos de tests apuntan a los archivos que la fase de tasks
> creará.

## Qué hace

Cuando un reporte APROBADO (D-08: CLASIFICADO/CORREGIDO, no SPAM/OTRO, no eliminado)
menciona un identificador vinculado a un alumno, el worker agrega +1 en
`PatronInstitucional` (colegio, grado, conducta, plataforma, trimestre). El
SCHOOL_ADMIN ve el informe en `/dashboard/colegio/patrones` con k-anonimato k=3:
grados con menos de 3 reportes no se desglosan (solo cuentan en el total).

## Probar la acumulación (semilla mínima)

1. Colegio vigente + curso con grado "7" + alumno + `IdentificadorAlumno` activo
   (p.ej. teléfono `+573001112233`).
2. Crear y procesar un reporte sobre ese identificador que termine CLASIFICADO con
   categoría de riesgo.
3. Verificar en BD: una fila `PatronInstitucional` para (colegio, "2026-Q3", "7",
   categoría, plataforma) con `conteo = 1`, y la `AlertaColegio` correspondiente con
   `patronInstitucionalId` poblado.
4. Negativos: un reporte SPAM u OTRO, o uno en REVISION_MANUAL, NO cambian el conteo;
  reprocesar el mismo reporte tampoco (idempotencia).
5. Corrección: pasar un reporte de REVISION_MANUAL a CORREGIDO → conteo +1 con la
   categoría corregida. Baja posterior → el conteo vuelve a su valor.

## Probar la vista y el k-anonimato

1. Sembrar 3 reportes aprobados en grado "7" y 2 en grado "9".
2. Login como SCHOOL_ADMIN del colegio → `/dashboard/colegio/patrones`:
   - Total del trimestre: 5.
   - Desglose por grado: solo "7" (3); "9" (2) suprimido con aviso de umbral de
     privacidad.
   - Tendencia vs. trimestre anterior.
3. Con otro SCHOOL_ADMIN (otro colegio) o sin sesión → 401/403.

## Tests

```bash
node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run src/lib/colegio/patrones.test.ts src/app/api/colegio/patrones/route.test.ts
```

## Reglas rápidas

- Sin PII en la tabla: si una fila tiene algo más que dimensiones + conteo, es un bug.
- La puerta es `esReporteAprobado` (`src/lib/reporte-aprobado.ts`), nunca
  `ESTADOS_VISIBLES`.
- k vive en `ParametroSistema` (`colegio.patrones.k_anonimato`, default 3) y se aplica
  en lectura, no en el almacenamiento.
