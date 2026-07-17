# Plan F7 — Keywords críticas, priorización, ráfagas y métricas de precisión

**Estado:** aprobado — en implementación.

## Objetivo

Cerrar el rediseño del clasificador con una capa de **supervisión determinística** que:

1. Detecte situaciones de alto riesgo que el LLM puede omitir (patrones de grooming, sextorsión, deepfake/nudificación, MASNNA, etc.).
2. Marque esos reportes como **prioridad alta** sin reclasificar (mismo patrón probado de la guarda DOXING).
3. Detecte **ráfagas de reportes** contra un mismo identificador sin historial previo y los envíe a revisión humana prioritaria.
4. Priorice la cola de revisión humana, muestre términos detectados y el flag de ráfaga.
5. Entregue al admin métricas de **precisión observada en casos revisados**.
6. Genere un **reporte consolidado final** del spec 010 con la evolución baseline → F7.

---

## 1. Diccionario de keywords de riesgo

### Archivo
`src/lib/ai/keywords-riesgo.ts`

### Diseño
- Lista estática en código, versionable en git, auditable.
- Normalización **NFD** para matching insensible a tildes (lección del bug de acentos).
- No es un filtro de contenido general: se enfoca en **señales de riesgo explícitas** que justifiquen revisión prioritaria.

### Fuentes
1. **Vocabulario de la Guía Grooming LATAM**:
   - sextorsión / chantaje con material íntimo
   - deepfake / nudificación / fotos falsas
   - MASNNA (material de abuso sexual de menores)
   - propuestas de noviazgo/encuentro en juegos (Roblox, Free Fire, Minecraft)
   - secretismo / aislamiento ("no le digas a nadie", "borra los mensajes", "esto es nuestro secreto")
2. **Casos fallados del eval**:
   - DOXING no capturado ni por el LLM ni por la guarda actual
   - Fronteras críticas de F4/S3: `DIFUSION_NO_CONSENTIDA → COMPARTIMIENTO_SEXUAL`, `SOLICITUD_MATERIAL → EXTORSION`, `OTRO → CONTACTO_INSISTENTE`, `CONTENIDO_GENERADO_IA → COMPARTIMIENTO_SEXUAL`, `DOXING → OTRO`.

### API propuesta
```ts
export interface KeywordsRiesgoResult {
    tieneMatch: boolean;
    keywords: string[];      // términos concretos detectados
    categoriaSugerida?: string; // opcional, solo para enriquecer la vista admin
}

export function detectarKeywordsRiesgo(texto: string): KeywordsRiesgoResult;
```

### Tests
- `src/lib/ai/keywords-riesgo.test.ts`
- Cobertura: términos con/sin tildes, mayúsculas, negativos, frases de contexto.

---

## 2. Generalizar la guarda determinística

### Patrón (igual que DOXING, que probó 100% de precisión)
- NUNCA reclasifica el reporte.
- Si se activa: `prioridadAlta = true` y se **suman** los términos a `keywordsDetectadas` (ya puede tener fragmentos DOXING).
- El estado final (`CLASIFICADO` / `REVISION_MANUAL`) se respeta.

### Cuándo se activa
Se evalúa en `/api/reportes/procesar` **después** de la clasificación y de la guarda DOXING:

```
((estadoFinal === "CLASIFICADO" && categoriaFinal === "OTRO")
  OR estadoFinal === "REVISION_MANUAL")
  AND detectarKeywordsRiesgo(texto).tieneMatch
```

Esto captura:
- Textos que el LLM dejó como `OTRO` pero contienen señales graves.
- Textos ya en revisión manual que merecen priorización por términos críticos.

### Privacidad de alertas (R2)
- `enviarAlertaRevision` aceptará un flag `prioridadAlta`.
- Si es prioridad alta, el subject/body indicará "PRIORIDAD ALTA" pero **no incluirá el texto del reporte ni los términos detectados**.
- Los términos solo se muestran dentro del panel admin autenticado.

---

## 3. Panel admin: cola de revisión priorizada

### Backend
`/api/admin/reportes-revision`:
- `orderBy` cambia a `[{ prioridadAlta: "desc" }, { creadoEn: "desc" }]`.
- Incluir `prioridadAlta`, `keywordsDetectadas` y `esRafaga` en el select.

### Frontend
- `AdminReportesTable`:
  - Fila destacada para reportes `prioridadAlta`.
  - Badge "Prioridad alta" y badge separado "Ráfaga" cuando `esRafaga === true`.
- `AdminReporteDetalle` (modal):
  - Badge "Prioridad alta".
  - Sección "Términos detectados" con `keywordsDetectadas`.
  - Badge "Ráfaga" si aplica.
  - No mostrar el texto original del reporte en el email ni en notificaciones.

---

## 4. Métricas de precisión observada (solo casos revisados)

### Fuente
`CorreccionAdmin` (tabla `Correccion` vía relación `ClasificacionIA.correccion`).

### Nuevo campo: confirmaciones explícitas
El flujo actual solo registra correcciones. Para poder calcular la métrica se agrega:
- Acción **"Confirmar clasificación"** en el panel de revisión.
- Nuevo campo `confirmada: boolean` en `Correccion` (o tabla auxiliar) con default `false`.
  - Una corrección guarda `confirmada = false`.
  - Una confirmación guarda `confirmada = true` (misma categoría original == corregida).

> Alternativa mínima si se prefiere no tocar schema: agregar `estadoRevision: "CONFIRMADA" | "CORREGIDA"` en `Correccion`. Se optará por la que genere menos migración.

### Cálculo
Solo sobre reportes que pasaron por revisión humana:

```
precisionObservada = confirmadas / (confirmadas + corregidas)
```

- Agrupado por `categoria`.
- Si `confirmadas + corregidas < 5` → mostrar "insuficientes datos".
- Nunca interpretar como precisión global (solo casos revisados).

### Backend
`/api/admin/estadisticas` agregará:

```ts
precisionPorCategoria: Array<{
    categoria: string;
    confirmadas: number;
    corregidas: number;
    precisionObservada: number | null; // null si insuficientes datos
}>
```

### Frontend
Dashboard admin:
- Tabla "Precisión observada (solo casos revisados)".
- Leyenda visible: "Esta métrica solo incluye reportes revisados por un admin; no estima la precisión global del clasificador."
- Barras de color: rojo < 70%, amarillo 70-90%, verde > 90%.

---

## 5. Detección de ráfagas

### Parámetros configurables (ParametroSistema)
- `reportes.rafaga.n_reportes`: N (default 3).
- `reportes.rafaga.ventana_horas`: X (default 24).

### Regla
En `/api/reportes/procesar`, **antes** de clasificar o después (no importa la confianza):

```
Si existe un reporte previo contra el mismo identificador + plataformaId con creadoEn < ventana:
  → no es ráfaga.
Si no existe historial previo y en la ventana actual hay ≥ N reportes contra ese identificador + plataformaId:
  → todos los reportes de esa ventana se marcan esRafaga=true.
  → estadoFinal = "REVISION_MANUAL".
  → prioridadAlta = true.
```

### Comportamiento
- No bloquea, no oculta, no cambia categoría.
- Fuerza revisión humana antes de cualquier efecto público (score, visibilidad).
- El flag `esRafaga` se guarda en `Reporte` (nuevo campo `Boolean @default(false)`).
- Badge propio en el panel, distinto al de keywords.

### Tests
- Simular N+1 reportes en ventana contra identificador nuevo → todos en `REVISION_MANUAL` con `esRafaga=true` y `prioridadAlta=true`.
- Identificador con historial previo → no dispara ráfaga.

---

## 6. Eval de cierre y reporte consolidado final

### Eval F7
- Ejecutar el eval completo sobre los 110 ejemplos con todas las guardas activas.
- Verificación de **no-regresión** en `error_silencioso`.
- Reportar cuánto sube `revision_manual` por efecto de las guardas (ráfagas no aplican al fixture individual, pero keywords sí).
- Métricas: `error_silencioso`, `% REVISION_MANUAL`, `recall OTRO`, latencias p50/p95, segmentado limpio/ruidoso.

### Reporte consolidado del spec 010
Crear `specs/010-rediseño-clasificador-ia/final-report.md` con tabla:

| Fase | error_silencioso | % REVISION_MANUAL | recall OTRO | latencia p50 | latencia p95 | notas |
|---|---|---|---|---|---|---|
| baseline | … | … | … | … | … | llamada única original |
| F0.5 | … | … | … | … | … | anonimización en correcciones |
| F1 | … | … | … | … | … | structured output |
| F2 | … | … | … | … | … | PII determinístico + LLM |
| F3-revert | 26.3% | 10.0% | … | … | … | línea de base pre-rediseño |
| F4 | 23.3% / 21.9%* | 33.6% | … | … | … | votación + RAG (F5) |
| F5 | 21.9% | 33.6% | … | … | … | RAG sobre correcciones |
| F6 | — | — | — | — | — | descartada (P4 fallido) |
| F7 | TBD | TBD | TBD | TBD | TBD | guardas + ráfagas + métricas |

\* F4 con umbral 1.0 + RAG alcanza el mejor `error_silencioso`.

### Sección "Estado vs KPI <5%"
- Brecha restante: 21.9% → 5%.
- Camino documentado:
  - Flywheel de correcciones reales alimentando el RAG.
  - `precisionObservada` como termómetro de fronteras problemáticas.
  - Iteración de fronteras con datos de producción (no con fixture sintético).

---

## Archivos esperados a tocar

- `src/lib/ai/keywords-riesgo.ts` (nuevo)
- `src/lib/ai/keywords-riesgo.test.ts` (nuevo)
- `src/app/api/reportes/procesar/route.ts` (guarda generalizada + ráfagas)
- `src/lib/email.ts` (`enviarAlertaRevision` con flag de prioridad)
- `src/app/api/admin/reportes-revision/route.ts` (orden + select)
- `src/components/modules/AdminReportesTable.tsx` (badges prioridad y ráfaga)
- `src/components/modules/AdminReporteDetalle.tsx` (mostrar keywords + ráfaga)
- `src/app/api/admin/estadisticas/route.ts` (precisión observada)
- `src/app/dashboard/admin/estadisticas/page.tsx` (tabla de precisión)
- `src/app/api/admin/reportes-revision/[id]/confirmar/route.ts` (nuevo — acción confirmar)
- Componente del panel para confirmar clasificación.
- `prisma/schema.prisma` (`Reporte.esRafaga`, `Correccion.confirmada` o similar)
- `prisma/seed.ts` (parámetros de ráfaga y confirmaciones)
- `scripts/eval-classifier-f7.ts` (nuevo)
- `specs/010-rediseño-clasificador-ia/final-report.md` (nuevo)

---

## Criterios de aceptación

- [ ] Diccionario con ≥20 términos/frases críticas, NFD, tests verdes.
- [ ] La guarda de keywords no modifica `estado` ni `categoria` del reporte.
- [ ] Reporte `OTRO` + keyword crítico queda `prioridadAlta=true`.
- [ ] Reporte `REVISION_MANUAL` + keyword crítico queda `prioridadAlta=true`.
- [ ] Ráfaga detectada según N/X config → `REVISION_MANUAL` + `prioridadAlta=true` + `esRafaga=true`.
- [ ] Cola de revisión ordena por `prioridadAlta` primero.
- [ ] Alerta email de revisión prioritaria no incluye texto ni términos.
- [ ] Dashboard muestra precisión observada (solo casos revisados) con leyenda clara.
- [ ] Acción "Confirmar clasificación" registrada y usable desde el panel.
- [ ] Eval F7 ejecutado sin regresión de `error_silencioso`.
- [ ] Reporte consolidado final creado.
- [ ] `npm run lint`, `npm run build`, `npm test` verdes.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Diccionario demasiado sensible → muchas prioridades altas | Partir de fallos reales, no de lista teórica; revisar con datos reales antes de ampliar. |
| Falsos positivos en términos polisémicos | Requerir contexto o frases completas, no palabras sueltas. |
| Ráfagas afectan flujo normal | Solo forzar revisión; no bloquear ni ocultar. |
| Alerta email filtra contenido sensible | Nunca incluir texto ni keywords; solo indicador de prioridad + link al panel. |
| Métrica de precisión malinterpretada como global | Leyenda visible y etiqueta "solo casos revisados"; mostrar "insuficientes datos" si < 5. |

---

## Siguiente paso

Implementación F7.
