# Contract: Validación de rutas de mutación admin

**Feature**: specs/048-validacion-uniforme/spec.md
**Date**: 2026-07-20

---

## Rutas afectadas

| Método | Ruta | Esquema aplicado | Body | Params |
|--------|------|------------------|------|--------|
| POST | `/api/admin/ia/evals` | `emptyBodySchema` | `{}` strict | — |
| PATCH | `/api/admin/ia/evals/casos/[id]/desactivar` | `cuidIdParamsSchema` | — | `{ id: cuid }` |
| POST | `/api/admin/ia/experimentos/[id]/preparar-activacion` | `cuidIdParamsSchema` | `{}` strict | `{ id: cuid }` |
| POST | `/api/admin/ia/ollama/probar` | `ollamaProbarBodySchema` | `{ url: string }` | — |
| POST | `/api/admin/ia/sandbox` | `sandboxBodySchema` | `{ texto: string, parametrosOverride?: object, comparar?: boolean }` | — |
| POST | `/api/admin/operadores/[id]/reactivar` | `operadorIdParamsSchema` | — | `{ id: cuid }` |
| POST | `/api/admin/operadores/[id]/reenviar-email` | `operadorIdParamsSchema` | — | `{ id: cuid }` |
| POST | `/api/admin/operadores/[id]/regenerar-password` | `operadorIdParamsSchema` | — | `{ id: cuid }` |
| PATCH | `/api/config/parametros/[clave]` | `parametroClaveParamsSchema`, `parametroPatchBodySchema` | `{ valor: string, ... }` | `{ clave: string }` |
| POST | `/api/admin/apelaciones/vencer` | `emptyBodySchema` | `{}` strict | — |

---

## Formato de error de validación

**Status**: `400 Bad Request`

```json
{
  "error": {
    "message": "Datos inválidos",
    "code": "VALIDATION_ERROR",
    "details": [
      { "message": "Required", "path": "url" }
    ]
  }
}
```

Para parámetros de ruta inválidos:

```json
{
  "error": {
    "message": "Parámetros de ruta inválidos",
    "code": "VALIDATION_ERROR",
    "details": [
      { "message": "Invalid cuid", "path": "id" }
    ]
  }
}
```

---

## Reglas de validación por dominio

### IA

- `evals` POST: body debe ser objeto vacío (`{}`). Cualquier campo adicional es rechazado.
- `ollama/probar` POST: `url` es obligatorio, string, máximo 2000 caracteres.
- `sandbox` POST: `texto` es obligatorio, string de 1 a 4000 caracteres; `parametrosOverride` es opcional y debe ser objeto; `comparar` es opcional booleano.
- Parámetros `id` en rutas dinámicas: debe ser cuid válido.

### Operadores

- `reactivar`, `reenviar-email`, `regenerar-password` POST: parámetro `id` cuid válido; sin body.

### Configuración

- `parametros/[clave]` PATCH: `clave` string no vacío máximo 100 caracteres; `valor` string no vacío máximo 4000; `tipo` y `categoria` deben ser valores de enum Prisma válidos; `motivo`, `descripcion` strings opcionales con máximos.

### Apelaciones

- `vencer` POST: body debe ser objeto vacío; validación de autenticación del worker (`x-worker-secret`) se mantiene tal cual.

---

## Notas

- No se modifican los códigos de éxito ni la respuesta de negocio de las rutas.
- Los headers de rate limit y autenticación se conservan sin cambios.
- La validación ocurre antes de cualquier llamada a Prisma, Ollama o servicio externo.
