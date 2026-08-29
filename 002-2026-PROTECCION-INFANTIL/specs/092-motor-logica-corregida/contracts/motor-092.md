# Contracts — 092-motor-logica-corregida

## Resultado del motor (`clasificarConRubrica`) — cambios de la 092

```jsonc
{
  "categoria": "CONTACTO_INSISTENTE",   // la de MAYOR % entre presentes (solo por schema; ya no por gravedad)
  "confianza": 1.0,                     // % de esa categoría
  "categoriasPresentes": ["CONTACTO_INSISTENTE", "SOLICITUD_ENCUENTRO"],  // TODAS las que superan el umbral
  "categoriasSecundarias": [{ "categoria": "SOLICITUD_ENCUENTRO", "score": 0.67 }],
  "porcentajes": { "CONTACTO_INSISTENTE": 1, "SOLICITUD_ENCUENTRO": 0.67 },
  "estado": "CLASIFICADO"               // ≥1 presente → CLASIFICADO; ninguna → REVISION_MANUAL
}
```

## Sets de preguntas (`ia.rubrica.preguntas`) — formato con tipo

```jsonc
{
  "SOLICITUD_MATERIAL": [
    { "texto": "¿Alguien pide fotos, videos o material visual a otra persona?", "activo": true, "tipo": "decisiva" },
    { "texto": "¿La persona a quien se le pide es menor de edad?", "activo": true, "tipo": "contexto" }
  ]
}
```

- `tipo: "decisiva"` — obligatoria: TODAS deben cumplirse para marcar 1 ("ante la duda, 0").
- `tipo: "contexto"` (o ausente, formato viejo) — se reporta, no bloquea.

## Embudo (contrato de comportamiento)

- Permisivo: "ante la duda, INCLUYE" (la versión estricta descartó la correcta en 70/200 casos del banco, 35%).
- Red de seguridad: `plausibles < 2` → se evalúan todas las categorías.

## POST /api/reportes (creación) — longitud mínima

- 400 si `texto.trim().length < reportes.spam.min_text_length` (parámetro, default 20). El mensaje incluye el valor actual del parámetro.

## Sin cambios de schema

La migración de la 090 (`clasificacion_rubrica_votos`) sigue siendo la persistencia de la matriz; la 092 no añade tablas.
