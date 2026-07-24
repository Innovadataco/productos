# Contracts — 090-clasificacion-rubrica-multimodelo

## GET /api/reportes/mis-reportes/[id] (PRIVADO, PARENT dueño)

200: reporte info + `estadoVisual` + `clasificacion` (o null) + `votosModelos` (matriz categoría×modelo×0/1 con preguntas cumplidas) + `porcentajes` + `analisis` (plantilla determinista). 401 sin sesión · 403 no dueño · 404 inexistente/eliminado. Sin score ni "% de riesgo".

## GET /api/admin/ia/rubrica (ADMIN + módulo ia_rubrica)

```jsonc
{ "preguntas": { "EXTORSION": [{ "texto": "…", "activo": true }] },
  "modelos": ["gemma2:27b", "qwen2.5:14b", "aya-expanse:32b"],
  "temperatura": 0.2, "umbralPresencia": 0.6, "modeloEmbudo": "qwen2.5:14b" }
```

## PUT /api/admin/ia/rubrica/preguntas

Body `{ categoria: <CategoriaConducta>, preguntas: [{ texto: string (10..300), activo: boolean }] }` (1..10). Reemplaza el set de esa categoría en `ia.rubrica.preguntas`. 400 validación · 403 sin módulo.

## PATCH /api/admin/ia/rubrica/config

Body parcial `{ modelos?: string[1..5], temperatura?: 0..2, umbralPresencia?: 0..1, modeloEmbudo?: string }` (al menos un campo). Actualiza los parámetros `ia.rubrica.*` con AuditLog por clave. 400 validación · 403 sin módulo.

## Resultado del motor (interno, `clasificarConRubrica`)

```jsonc
{ "categoria": "SOLICITUD_ENCUENTRO",      // principal: mayor gravedad entre presentes
  "confianza": 0.67,                        // % de la principal (1s/N)
  "categoriasPresentes": ["SOLICITUD_ENCUENTRO", "CONTACTO_INSISTENTE"],
  "categoriasSecundarias": [{ "categoria": "CONTACTO_INSISTENTE", "score": 1 }],
  "porcentajes": { "SOLICITUD_ENCUENTRO": 0.67, "CONTACTO_INSISTENTE": 1 },
  "estado": "CLASIFICADO",                  // ninguna presente → REVISION_MANUAL; OTRO → revisión
  "votosModelos": [{ "modelo": "gemma2:27b", "categorias": { "…": { "cumple": true, "preguntasCumplidas": ["…"] } } }] }
```
