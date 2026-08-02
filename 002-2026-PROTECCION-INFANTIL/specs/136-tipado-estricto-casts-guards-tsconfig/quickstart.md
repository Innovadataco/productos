# Quickstart: SPEC-136 — tipado estricto

## Reemplazar un `as unknown as`

```ts
// ❌ const data = JSON.parse(raw) as unknown as MiTipo;
// ✅ Zod (fronteras: JSON de Ollama, payloads externos)
const data = MiTipoSchema.parse(JSON.parse(raw));
// ✅ o guard sobre unknown
function esMiTipo(v: unknown): v is MiTipo { … }
// ✅ o tipo derivado de Prisma
type Fila = Prisma.ReporteGetPayload<{ select: typeof SELECT }>;
```

## Reemplazar un `!.`

```ts
// ❌ reporte.clasificacion!.id
// ✅ invariante de BD → guarda con error canónico
if (!reporte.clasificacion) throw new AppError(409, "CONFLICT", "El reporte no tiene clasificación");
const clasificacionId = reporte.clasificacion.id;
// ✅ UI → narrowing temprano (una guarda, no cinco)
if (!cuenta) return null;
```

## Flags activos (tsconfig)

`strict` + `noFallthroughCasesInSwitch` + `noImplicitOverride` +
`forceConsistentCasingInFileNames` + `exactOptionalPropertyTypes`.
DIFERIDOS (con conteo en plan.md): `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`.
Con `exactOptionalPropertyTypes`: `{ x?: T }` NO acepta `x: undefined` explícito —
declara `{ x?: T | undefined }` si el `undefined` explícito es intencional.
