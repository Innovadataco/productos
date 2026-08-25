# Contrato API: definiciones legales de rúbrica

## `GET /api/admin/ia/rubrica` (extendido)

Auth: `verifyAuth(RolUsuario.ADMIN)` (sin cambio).

Respuesta 200 (campos previos intactos + `definiciones` nuevo):

```json
{
  "preguntas": { "CIBERACOSO": [ { "texto": "...", "activo": true, "tipo": "decisiva" } ], "...": "..." },
  "modelos": ["gemma2:27b", "qwen2.5:14b", "aya-expanse:32b"],
  "temperatura": 0.2,
  "umbralPresencia": 0.6,
  "modeloEmbudo": "qwen2.5:14b",
  "definiciones": {
    "CIBERACOSO": {
      "conductaLegal": "Ciberacoso",
      "definicionLiteral": "Comportamientos repetitivos de hostigamiento...",
      "referenciaNormativa": "Ley 2564 de 2026 · art. 6.e"
    }
  }
}
```

## `GET /api/admin/ia/rubrica/definiciones` (nuevo)

Auth: `verifyAuth(RolUsuario.ADMIN, RolUsuario.COMITE_VALIDACION)` — lectura para ambos roles.

Respuesta 200:

```json
{
  "definiciones": {
    "CONTACTO_INSISTENTE": { "conductaLegal": "Grooming", "definicionLiteral": "...", "referenciaNormativa": "Ley 2564 de 2026 · art. 6.a", "rolDentroDeConducta": "Vía de acceso · contacto reiterado que abre la relación" },
    "...": "... 14 entradas en total"
  }
}
```

Errores: `401` sin sesión, `403` rol no autorizado.

## `PATCH /api/admin/ia/rubrica/definiciones/[categoria]` (nuevo)

Auth: `verifyAuth(RolUsuario.ADMIN)` únicamente.

Path param: `categoria` — debe existir en `DEFINICIONES_CATEGORIA`/el parámetro vivo (case-sensitive, valores del enum).

Body:

```json
{
  "conductaLegal": "Ciberacoso",
  "definicionLiteral": "texto editado",
  "referenciaNormativa": "Ley 2564 de 2026 · art. 6.e",
  "rolDentroDeConducta": null
}
```

Validación: los 4 campos son strings (o `null`/ausente para `rolDentroDeConducta`); `conductaLegal`, `definicionLiteral`, `referenciaNormativa` son obligatorios y no vacíos.

Efecto: actualiza SOLO esa entrada dentro del JSON de `ia.rubrica.definiciones` (las otras 13 quedan igual); registra `AuditLog`:

```json
{
  "accion": "RUBRICA_DEFINICION_UPDATE",
  "tipoRecurso": "ParametroSistema",
  "recursoId": "ia.rubrica.definiciones.CIBERACOSO",
  "usuarioId": "<id del ADMIN>",
  "valorAnterior": "{...json anterior de esa categoría...}",
  "valorNuevo": "{...json nuevo...}",
  "metadatos": { "categoria": "CIBERACOSO" }
}
```

Respuesta 200: la `DefinicionCategoria` actualizada.

Errores:
- `400` — body inválido (campo obligatorio vacío/faltante).
- `401` — sin sesión.
- `403` — autenticado pero no `ADMIN`.
- `404` — `categoria` no existe en el enum/las definiciones.
- `500` — error interno (patrón `AppError` + `safeErrorMessage`, sin stack trace al cliente).
