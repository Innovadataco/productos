# Data Model: SPEC-248 — Categorías Ley 2564 completas + Definiciones legales editables

Sin tablas nuevas (D-72). Cambios sobre entidades/parámetros existentes.

## 1. Enum `CategoriaConducta` (Prisma, PostgreSQL)

```prisma
enum CategoriaConducta {
  CONTACTO_INSISTENTE
  SOLICITUD_MATERIAL
  OFRECIMIENTO_REGALOS
  SUPLANTACION_IDENTIDAD
  SOLICITUD_ENCUENTRO
  COMPARTIMIENTO_SEXUAL
  OTRO
  EXTORSION
  CONTENIDO_GENERADO_IA
  DIFUSION_NO_CONSENTIDA
  DOXING
  SPAM
  CIBERACOSO        // nuevo · Ley 2564 art. 6.e
  HAPPY_SLAPPING    // nuevo · Ley 2564 art. 6.f
  STALKING          // nuevo · Ley 2564 art. 6.d
}
```

Migración: `ALTER TYPE "CategoriaConducta" ADD VALUE IF NOT EXISTS '<valor>';` × 3.

## 2. Enum `AccionAudit` (Prisma, PostgreSQL)

Se agrega `RUBRICA_DEFINICION_UPDATE` (ver plan.md Decisión 2). Migración: `ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'RUBRICA_DEFINICION_UPDATE';`.

## 3. Tipo `DefinicionCategoria` (código, `src/lib/ai/rubrica-semilla.ts`)

```typescript
export type DefinicionCategoria = {
    conductaLegal: string;        // ej. "Grooming"
    definicionLiteral: string;    // texto literal de la ley, sin paráfrasis
    referenciaNormativa: string;  // ej. "Ley 2564 de 2026 · art. 6.a"
    rolDentroDeConducta?: string; // solo para categorías que comparten conducta legal (grooming)
};

export const DEFINICIONES_CATEGORIA: Record<string, DefinicionCategoria> = {
    // 14 entradas — ver brief §6 y spec.md FR-003. Fuente: brief, copiado literal.
    // Grupo grooming (misma conductaLegal, distinto rolDentroDeConducta):
    //   CONTACTO_INSISTENTE, SOLICITUD_MATERIAL, OFRECIMIENTO_REGALOS,
    //   SUPLANTACION_IDENTIDAD, SOLICITUD_ENCUENTRO
    // Individuales: COMPARTIMIENTO_SEXUAL, EXTORSION, STALKING, CIBERACOSO,
    //   HAPPY_SLAPPING, DIFUSION_NO_CONSENTIDA, DOXING, CONTENIDO_GENERADO_IA, SPAM
    // NO tiene entrada: OTRO (categoría residual, sin conducta legal propia).
};
```

**Invariantes**:
- 14 entradas, una por cada valor del enum salvo `OTRO`.
- `definicionLiteral` es copia literal del brief §6 — cero paráfrasis, cero traducción, cero mejora editorial.
- Es la fuente **fallback**; el valor vivo lo maneja el parámetro `ia.rubrica.definiciones`.

## 4. `ParametroSistema` — parámetros tocados (tabla existente, sin cambio de esquema)

| Clave | Tipo | Patrón de seed | Cambio |
|---|---|---|---|
| `ia.rubrica.preguntas` | JSON | forzado (excepción SPEC-199) | valor completo reemplazado por `RUBRICA_SEMILLA` (14 categorías) |
| `ia.rubrica.definiciones` | JSON | idempotente-respetuoso (`update: {}`) | **nuevo** — `Record<CategoriaConducta, DefinicionCategoria>`, seed inicial = `DEFINICIONES_CATEGORIA` |
| `scoring.severity.CIBERACOSO` | INTEGER | idempotente-respetuoso | **nuevo** — valor `60` |
| `scoring.severity.HAPPY_SLAPPING` | INTEGER | idempotente-respetuoso | **nuevo** — valor `75` |
| `scoring.severity.STALKING` | INTEGER | idempotente-respetuoso | **nuevo** — valor `70` |
| `ui.grupos_categoria` | JSON | idempotente-respetuoso (`update: {}`, sin cambio de lógica) | sin cambio de comportamiento; default (solo si no existe) gana 3 categorías nuevas |
| `CATEGORIAS_LABELS` (código, `labels.ts`, no es `ParametroSistema`) | — | — | +3 entradas (`CIBERACOSO`, `HAPPY_SLAPPING`, `STALKING`) |

## 5. `AuditLog` — nuevo patrón de escritura (tabla existente)

```typescript
await prisma.auditLog.create({
    data: {
        accion: "RUBRICA_DEFINICION_UPDATE",
        tipoRecurso: "ParametroSistema",
        recursoId: `ia.rubrica.definiciones.${categoria}`,
        usuarioId: user.id,
        valorAnterior: JSON.stringify(definicionAnterior),
        valorNuevo: JSON.stringify(definicionNueva),
        ipAddress, userAgent,
        metadatos: { categoria },
    },
});
```

Mismo shape que el resto de `AuditLog` en el proyecto; sin campos nuevos en el modelo.

## 6. Relaciones / flujo

```
DEFINICIONES_CATEGORIA (constante, código)
        │  seed inicial (si el parámetro no existe)
        ▼
ia.rubrica.definiciones (ParametroSistema, JSON)  ←── PATCH .../definiciones/[categoria] (ADMIN)
        │  GET                                          │
        ▼                                                ▼
GET /api/admin/ia/rubrica (extendido)          AuditLog (RUBRICA_DEFINICION_UPDATE)
GET /api/admin/ia/rubrica/definiciones (nuevo)
        │
        ▼
RubricaTab.tsx → <DefinicionLegalCard/> (nuevo)
```

`ia.rubrica.preguntas` y `RUBRICA_SEMILLA` (motor de clasificación real) NO se cruzan con este flujo — siguen su propio camino sin cambios de comportamiento, solo más categorías en el mismo mecanismo.
