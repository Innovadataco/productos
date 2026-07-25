# Contracts — 096-expediente-reporte

## GET /api/admin/reportes/[id]/expediente

Auth: sesión admin con módulo `bandeja_reportes` (`verifyAuth` → `assertModulo(user,"bandeja_reportes")`) → rate limit `admin_read` → `idSchema` (Zod).

**Query params**

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `revelar` | `"true"` | ausente = false | Solicita incluir campos gated (textoOriginal, ipHash/fingerprintHash, rawResponse). Solo efectivo si el rol tiene el módulo `expediente_revelar_original`; registra AuditLog `TEXTO_ORIGINAL_REVELADO`. |

**Respuesta 200**

```jsonc
{
  "reporte": {
    "id": "clx…",
    "numeroSeguimiento": "PI-2026-000123",
    "estado": "CLASIFICADO",
    "creadoEn": "2026-07-24T18:03:11.000Z",
    "plataforma": "WhatsApp",
    "pais": "Colombia",
    "ciudad": "Bogotá",
    "esAnonimo": true
  },
  "etapas": [                          // SIEMPRE 10, ordenadas por `orden` del parámetro
    {
      "orden": 5,
      "fase": "B",
      "faseNombre": "Preparación",
      "clave": "guardas",
      "nombre": "Guardas baratas",     // del parámetro admin.expediente.etapas (nada quemado)
      "icono": "shield",
      "capa": 2,
      "actividad": "Guardas de ráfaga, doxing y keywords sobre el texto anonimizado",
      "evaluacion": "Sin ráfaga · 1 keyword detectada · prioridad alta",
      "fechaHora": "2026-07-24T18:03:14.210Z",   // null si no hay dato
      "campos": { "esRafaga": false, "keywordsDetectadas": ["amenaza"], "prioridadAlta": true },
      "gated": false,                  // true si la etapa tiene camposGated NO revelados en esta respuesta
      "sinInstrumentar": false         // true en etapas Capa 2 sin filas en PasoProcesamiento (degradación elegante)
    }
    // … etapas 1-10
  ],
  "clasificacion": {                   // null si el reporte no tiene ClasificacionIA
    "categorias": ["GROOMING"],
    "confianza": 0.87,
    "usoCascada": true,
    "modeloCascada": "qwen2.5:14b",
    "latenciaMs": 1240,
    "promptTokens": 3210,
    "responseTokens": 96,
    "matriz": {                        // modelo × categoría desde ClasificacionRubricaVoto
      "GROOMING": { "gemma2:27b": 1, "qwen2.5:14b": 1, "aya-expanse:32b": 0 }
    },
    "detallePorCategoria": [
      {
        "categoria": "GROOMING",
        "preguntas": [                 // texto y tipo EN VIVO de ia.rubrica.preguntas
          {
            "texto": "¿El adulto pide mantener la conversación en secreto?",
            "tipo": "decisiva",        // "decisiva" | "contexto"
            "votosPorModelo": { "gemma2:27b": 1, "qwen2.5:14b": 1, "aya-expanse:32b": 0 }
          }
        ]
      }
    ]
  },
  "sintesis": {
    "analisisInterno": "Consenso 2/3 en GROOMING (gravedad interna: alta). Señales: … Disparador: … Confianza 0.87 · peso de fuente 0.8. Conclusión: …",  // determinista, sin LLM; uso interno
    "mensajePadre": "Gracias por reportar. Revisamos el caso y encontramos señales de… Te recomendamos… Línea 141 ICBF…"                            // plantillas; SIN score ni nivel de riesgo; borrador, no se envía
  },
  "revelado": false,                   // true solo si se incluyeron campos gated en ESTA respuesta
  "puedeRevelar": true                 // true si el rol tiene el módulo expediente_revelar_original
}
```

**Notas de contrato**

- Los campos gated (`textoOriginal`, `ipHash`, `fingerprintHash`, `rawResponse`) nunca aparecen en `campos` salvo `revelar=true` + permiso; entonces `revelado:true` y existe AuditLog.
- Sin permiso y `revelar=true`: NO es error — responde 200 con campos omitidos, `revelado:false` (decisión R2: omisión REST-friendly, no 403).
- `etapas[].nombre`, `icono`, `orden`, `campos` visibles los gobierna `admin.expediente.etapas`; editar el parámetro cambia el expediente sin desplegar (ADR_004).
- El texto/tipo de las preguntas refleja el parámetro `ia.rubrica.preguntas` al momento de la consulta, no el de la clasificación (decisión R4).
- Reportes procesados con el motor legacy (sin `ClasificacionRubricaVoto`): `matriz` y `detallePorCategoria` vacíos, `clasificacion` con lo persistido en `ClasificacionIA`.

**Errores** — shape `{ "error": { "message": string, "code": string } }`

| HTTP | code | Caso |
|------|------|------|
| 401 | `UNAUTHORIZED` | Sin sesión o token inválido |
| 403 | `FORBIDDEN` | Sin módulo `bandeja_reportes` (o rol fuera de la bandeja admin) |
| 404 | `NOT_FOUND` | Reporte inexistente |
| 429 | `RATE_LIMITED` | Límite `admin_read` excedido |
| 400 | `VALIDATION_ERROR` | `id` inválido |
