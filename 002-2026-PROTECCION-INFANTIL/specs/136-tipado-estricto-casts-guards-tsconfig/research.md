# Research: SPEC-136 — reverificación en fuente (2026-08-01)

## Conteos (cambiaron desde julio)

- `as unknown as`: **29** (julio: 27). Los +2 son de `carga-roster-sesion.ts` (SPEC-132,
  propio). Comando: `grep -rn "as unknown as" src --include="*.ts" --include="*.tsx" | grep -v "\.test\."`.
- `!.`: **15** (julio: 13). Nuevos en archivos tocados por colas recientes.

## Costo del tsconfig maximal (medido, no estimado)

| Flag | Errores | Nota |
|---|---|---|
| `noFallthroughCasesInSwitch` | 0 | gratis |
| `noImplicitOverride` | 1 | gratis |
| `forceConsistentCasingInFileNames` | 0 | gratis |
| `exactOptionalPropertyTypes` | 120 | asumible aquí |
| `noPropertyAccessFromIndexSignature` | 326 | fuerza `env["X"]` en todo `process.env` — proyecto propio |
| `noUncheckedIndexedAccess` | 565 | todo acceso `arr[i]`/`record[k]` pasa a `T \| undefined` — proyecto propio |

Decisión de diseño: activar los 4 primeros; los 2 grandes quedan DIFERIDOS con conteo
(radicables). "Maximal" literal (900+ errores) rompería la regla 3 (cada commit verde).

## Hotspots de casts

- `clasificacion.ts` (10): parseo de respuestas del motor — el patrón correcto es Zod
  sobre `unknown` (el proyecto ya usa Zod en rutas) o guards; NO interfaces optimistas.
- `ia-evals.ts` (8): payloads JSON de evaluaciones.
- `pdf-estadisticas.ts` (3): definiciones de pdfmake (types de pdfmake disponibles).
- `test-setup.ts` (2): mocks — se tipan igual (disciplina de la casa).

## `!.` — patrón dominante

5 de 15 están en `GestionPageClient.tsx` (`cuenta!.id`): UN narrowing (early return si
`!cuenta`) los resuelve todos. Los demás son invariantes de BD ("este reporte tiene
clasificación") → guarda con AppError 409/500 canónico.
