# Plan de implementación: SPEC-195 — Motor SPAM + Aprendizaje operativo (002-PI-089)

## Resumen

Agregar capacidad de clasificación SPAM al motor, caché semántico humano exacto, detección de patrón coordinado, flujo operativo integrado y panel de análisis. Todo se construye sobre el schema existente; no hay migraciones destructivas. El RAG activo queda retirado: se calcula `ejemplosRag` para trace pero no se pasa al LLM.

## Cambios de código

### 1. Rúbrica SPAM y parámetros (Bloques A, J)

#### 1.1 `src/lib/ai/rubrica-semilla.ts`
Añadir el bloque `SPAM` con las 5 preguntas del brief:

```ts
SPAM: [
    { texto: "¿El texto ofrece dinero, premios, sorteos o beneficios sin víctima concreta identificable?", activo: true, tipo: "decisiva" },
    { texto: "¿Incluye URLs, teléfonos o cuentas para reclamar/visitar/contactar comercialmente?", activo: true, tipo: "decisiva" },
    { texto: "¿Usa lenguaje de urgencia comercial (cupos limitados, solo 24h, ya!!!, felicitaciones)?", activo: true },
    { texto: "¿Describe una situación masiva/genérica en vez de un incidente con víctima e involucrado identificables?", activo: true },
    { texto: "¿El propósito principal es vender/promover/estafar, no reportar peligro contra un menor?", activo: true, tipo: "decisiva" },
],
```

#### 1.2 `prisma/seed.ts`
- Añadir `scoring.severity.spam=0` al seed de severidades existente (ya hay un mapa; agregar la entrada).
- Añadir en `monitoreoNuevos` los 9 parámetros nuevos:
  - `motor.cache.similitud_umbral` · FLOAT · 0.98
  - `motor.cache.solo_humano_confirmado` · BOOLEAN · true
  - `patron_coordinado.min_reportes` · INTEGER · 5
  - `patron_coordinado.ventana_min` · INTEGER · 60
  - `patron_coordinado.similitud_umbral` · FLOAT · 0.90
  - `spam.sla_horas` · INTEGER · 48
  - `spam.notificacion.enabled` · BOOLEAN · true
  - `spam.notificacion.template` · STRING · template default
  - `scoring.severity.spam` · INTEGER · 0 (también cubierto en el mapa de severidades)

### 2. Caché semántico humano (Bloque B)

#### 2.1 Nuevo helper `src/lib/ai/cache-semantico.ts`

```ts
export interface CacheSemanticoResult {
    hit: true;
    categoria: CategoriaConducta;
    confianza: number;
    reporteOrigenId: string;
    motivo: string;
} | { hit: false }

export async function buscarClasificacionCache(
    embedding: number[],
    opciones: {
        similitudUmbral: number;
        soloHumanoConfirmado: boolean;
        reporteIdActual: string;
        modeloEmbedding: string;
    }
): Promise<CacheSemanticoResult>
```

Lógica:
- Query a `EmbeddingReporte` ordenada por similitud coseno, filtrando `1 - (vector <=> $1) >= umbral`.
- Join con `Reporte` y `ClasificacionIA`.
- Si `soloHumanoConfirmado=true`: requerir `Reporte.estado = CORREGIDO` con `CorreccionAdmin.confirmada = true`.
- Si `soloHumanoConfirmado=false`: también aceptar `Reporte.estado = CLASIFICADO` con `ClasificacionIA.confianza >= 0.9`.
- Excluir el `reporteIdActual`.
- Tomar el primer resultado; devolver categoría, confianza, `reporteOrigenId`.

#### 2.2 Integración en `src/lib/dal/services/reporte-processing/index.ts`
Después de guardas-previas y antes de recuperar ejemplos RAG:

```
if (!esRafaga && !duplicado && !reporteEnEstadoAntiAbuso) {
    const cache = await buscarClasificacionCache(vector, {...});
    if (cache.hit) {
        // Construir clasificacion heredada y finalizar
    }
}
```

Si hay hit:
- Construir `ClasificacionResult` con `categoria/confianza` del origen, `modeloUsado="cache:humano:<reporteOrigenId>"`, `latenciaMs=0`.
- Persistir en `ClasificacionIA`.
- Registrar paso `cache_humano_hit` en expediente.
- Saltar `clasificarReporte`.
- Continuar con anonimización/guardas/finalización (el patrón coordinado se evalúa después).

### 3. Patrón coordinado (Bloque D)

#### 3.1 Nuevo helper `src/lib/ai/patron-coordinado.ts`

```ts
export interface PatronCoordinadoResult {
    coordinado: true;
    reportesRelacionadosIds: string[];
    count: number;
} | { coordinado: false }

export async function detectarPatronCoordinado(
    reporteId: string,
    embedding: number[],
    opciones: { minReportes: number; ventanaMin: number; similitudUmbral: number; modeloEmbedding: string }
): Promise<PatronCoordinadoResult>
```

Lógica:
- Buscar en `EmbeddingReporte` reportes creados en los últimos `ventanaMin` minutos con similitud ≥ umbral.
- Excluir el propio reporte.
- Contar identificadores distintos (`Reporte.identificador`); descartar reportes contra el mismo identificador (duplicado/ráfaga ya cubren eso).
- Si count ≥ `minReportes` → coordinado. Devolver los IDs relacionados.

#### 3.2 Integración en pipeline
Después del motor/caché y antes de guardas de seguridad/finalización:

```
const patron = await detectarPatronCoordinado(...);
if (patron.coordinado) {
    estadoFinal = "REVISION_MANUAL";
    prioridadAlta = true;
    // registrar IncidenteInfra con señal "patron_coordinado:<hash-texto>"
    // registrar paso "patron_coordinado"
    // alertar admin (reusar enviarAlertaRevision o notificarIncidente)
}
```

#### 3.3 Registro en `IncidenteInfra`
Reusar `src/lib/monitoreo/incidentes.ts` y `MonitoreoRepository`:

- Buscar incidente abierto de la señal `patron_coordinado:<hash-texto>`.
- Si no existe, crear con `estado="ABIERTO"`, `detalle=JSON.stringify({ reportesRelacionadosIds, count, similitud_promedio, primer_reporte_id })`.
- Notificar admin con throttle por `ultimoEmailEn` (reusar `notificarIncidente`).
- Cierre automático: ventana de 60 min sin nuevos matches → `estado="RESUELTO"`, `fin=now()`.

### 4. Flujo operativo integrado (Bloque E)

#### 4.1 Nuevo endpoint `POST /api/admin/reportes/[id]/resolver-spam`
Crear `src/app/api/admin/reportes/[id]/resolver-spam/route.ts`:

- Auth: `verifyAuth()` + `assertModulo(user, "revision_spam")`.
- Permiso: ADMIN o OPERADOR asignado (`reporte.operadorId === user.id`).
- Rate-limit: `admin_write`.
- Body Zod:
  ```ts
  {
      decision: z.enum(["es_spam", "corregir", "procesar_como_acoso"]);
      categoria: z.string().optional(); // requerido si decision="corregir"
      motivo: z.string().max(2000).optional();
      notificarDenunciante: z.boolean().optional();
  }
  ```
- Estados válidos: `POSIBLE_SPAM` o `REVISION_MANUAL` con clasificación SPAM.

#### 4.2 Comportamientos
- **`es_spam`**:
  - `darDeBajaReporte` con `motivoBaja=RETIRO_LIMPIEZA` y `accionAudit=CASO_DADO_DE_BAJA`.
  - Crear `DatasetEntrenamiento` con `clasificacionCorrecta=SPAM`, fuente `spam_revisado`.
  - Generar embedding y guardar en `EmbeddingDataset`.
  - Notificar denunciante si `usuarioId` existe y `notificarDenunciante !== false`.
- **`corregir`**:
  - Validar `categoria` en enum de conductas.
  - Crear `CorreccionAdmin` con `categoriaOriginal=SPAM`, `categoriaCorregida=<categoria>`.
  - Actualizar `Reporte.estado=CLASIFICADO`.
  - Crear `DatasetEntrenamiento` con `clasificacionCorrecta=<categoria>`.
  - Generar embedding y guardar en `EmbeddingDataset`.
- **`procesar_como_acoso`**:
  - Mantener categoría original del motor.
  - `Reporte.estado=CLASIFICADO`.
  - No crear dataset/embedding adicional (ya existe clasificación del motor).
  - `AuditLog` con `CASO_CONFIRMADO`.

En todos los casos: descifrar texto solo con función centralizada; `AuditLog` con metadatos (sin texto completo).

#### 4.3 SLA spam
- Reusar job existente de monitoreo (`pi-monitor` o worker) para buscar reportes `POSIBLE_SPAM` con `creadoEn < ahora - spam.sla_horas`.
- Alertar admin vía `enviarAlertaRevision` o función nueva throttled.

### 5. Panel de análisis (Bloque F)

#### 5.1 Nuevo endpoint `GET /api/admin/spam/analitica`
Crear `src/app/api/admin/spam/analitica/route.ts`:

Auth ADMIN/OPERADOR/COMITE; rate-limit `admin_read`.

Métricas calculadas:
- confirmados 7/30/90d (DADO_DE_BAJA por spam)
- corregidos 7/30/90d (CLASIFICADO con CorreccionAdmin SPAM→otra)
- pendientes (POSIBLE_SPAM + REVISION_MANUAL/SPAM sin resolver)
- SLA vencidos
- precisión del motor sobre SPAM = confirmados / (confirmados + corregidos desde SPAM)
- serie temporal de entradas a POSIBLE_SPAM por día
- distribución por categoría original cuando humano corrigió a SPAM
- top identificadores reportados como spam
- top usuarios PARENT con spam confirmado
- top plataformas con spam
- keywords frecuentes en spams confirmados (extracto simple de palabras repetidas, sin PII)

#### 5.2 Rediseño UI
- `SpamRevisionPanel.tsx` pasa de cola a panel de análisis.
- Nueva ruta opcional `/dashboard/admin/spam/analitica` (decisión ODIN).
- Detalle por caso: muestra texto (con auditoría I-80 cuando aplique), votos del motor, rúbricas, categoría original, decisión humana, motivo.
- Botón "Sugerir al banco": genera JSONL y copia al portapapeles.

### 6. Retroalimentación (Bloque G)

Ya existe en el endpoint legado. En `resolver-spam` extender:
- `es_spam` → Dataset SPAM + EmbeddingDataset.
- `corregir` → Dataset con categoría real + EmbeddingDataset.
- `procesar_como_acoso` → no agrega dataset (la clasificación original ya está).

### 7. Notificación al denunciante (Bloque H)

#### 7.1 Nuevo servicio `src/lib/email/notificacion-spam.ts`

```ts
export async function notificarSpamConfirmado(reporte: {
    id: string;
    usuarioId: string | null;
    identificador: string;
}): Promise<void>
```

- Si no hay `usuarioId` → retornar sin acción.
- Leer `spam.notificacion.enabled` y `spam.notificacion.template`.
- Buscar email del usuario.
- Enviar con Resend reemplazando `{{identificador}}` en el template.
- Log: `[EMAIL] Notificación spam confirmado enviada a ...`.

#### 7.2 Estado visual usuario
Añadir `DADO_DE_BAJA` al `mapEstadoUsuario` con `estadoVisual: "Cerrado"`, `badge: "muted"`, `enProceso: false` (o reutilizar "Procesado" según decisión).

### 8. Documentación (Bloque I)

- `src/components/modules/ia/IaDocsPanel.tsx`: agregar `SPAM: "Spam"` a `CATEGORIA_LABELS`; actualizar descripción de RAG para reflejar que está calculado pero no inyectado al prompt; añadir paso "Caché humano".
- `MODELO-DE-CLASIFICACION.md` (repo gestión, ya actualizado por ZEUS en 3718a23 v1.5):
  - Ajustar §8 catálogo para incluir SPAM.
  - Ajustar §3/§6 diagramas para mostrar SPAM como categoría del pipeline.
  - No repetir deudas ya cerradas por ZEUS.

## Tareas

Ver [tasks.md](./tasks.md).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| SPAM con severidad 0 oculte acoso real | Severidad 0 + la lógica de mayor gravedad ya en `scoring.ts`; además el motor multi-etiqueta puede devolver SPAM + conducta grave. |
| Caché falso positivo por texto idéntico pero contexto distinto | Umbral 0.98 (prácticamente exacto) + solo humano-confirmado. |
| Patrón coordinado genera muchas alertas | Solo ≥5 identificadores distintos; alerta throttled. |
| Registro de patrón coordinado en `IncidenteInfra` | Reusar servicio existente; no afecta semántica de infraestructura porque la señal es específica. |
| Notificación email expone detalles internos | Template neutro, sin texto ni categorías técnicas. |
| Cambios cruzan con SPEC-192/193/194 | Cero solapamiento estructural según instructivo; coordinar solo `specs/README.md`. |

## Criterios de aceptación técnica

- Gate local completo verde.
- `arch:check` verde.
- Sin cambios en `guardas-decision.ts`, `rate-limit.ts`, `rafagas.ts`, `duplicados.ts`.
- Cero migraciones destructivas.
