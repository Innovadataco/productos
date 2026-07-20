# Quickstart: Validación uniforme (zod)

**Prerequisites**: Docker, Node.js >=22, `npm` o `pnpm`, base de datos de test configurada en `.env.test`.

---

## 1. Validar esquemas y helper

```bash
npm run test -- src/lib/validation.test.ts src/lib/schemas/index.test.ts
```

**Esperado**: Todos los tests de `validation.test.ts` y `schemas/index.test.ts` pasan.

---

## 2. Validar TypeScript y lint

```bash
npx tsc --noEmit
npm run lint
```

**Esperado**: Sin errores ni nuevos warnings.

---

## 3. Ejecutar suite completa de tests

```bash
npm run test
```

**Esperado**: Todos los tests pasan; no se introducen fallos en las rutas afectadas.

---

## 4. Verificar build

```bash
rm -rf .next
npm run build
```

**Esperado**: Build compila sin errores de TypeScript.

---

## 5. Validar rutas admin afectadas (desarrollo)

Con el servidor en `http://localhost:5005`:

### 5.1. POST /api/admin/ia/ollama/probar — body inválido

```bash
curl -X POST http://localhost:5005/api/admin/ia/ollama/probar \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"url": 123}'
```

**Esperado**: `400` con `VALIDATION_ERROR`.

### 5.2. POST /api/admin/ia/evals — body inesperado

```bash
curl -X POST http://localhost:5005/api/admin/ia/evals \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"extra": true}'
```

**Esperado**: `400` porque el esquema espera body vacío.

### 5.3. PATCH /api/config/parametros/visibility.report_threshold — body inválido

```bash
curl -X PATCH http://localhost:5005/api/config/parametros/visibility.report_threshold \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"valor": ""}'
```

**Esperado**: `400` con `VALIDATION_ERROR`.

---

## 6. Usar `withValidation` en una nueva ruta

```typescript
import { withValidation } from "@/lib/validation";
import { ejemploBodySchema, ejemploParamsSchema } from "@/lib/schemas";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = withValidation.params(ejemploParamsSchema)(await context.params);
  const body = await withValidation.body(ejemploBodySchema)(request);
  // ... lógica de negocio
}
```

---

## 7. Deploy limpio

```bash
./scripts/dev-restart.sh
```

**Esperado**: Healthcheck OK, un solo worker, aplicación en puerto 5005.
