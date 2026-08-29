# RESEARCH-008 · Seed idempotente catálogo BI

## Patrón upsert idempotente (regla dura)

```typescript
await prisma.bICatalogoTabla.upsert({
  where: { nombreFuente: "Reporte" },
  create: { ...datos },
  update: {},  // NUNCA actualizar · el operador puede haber customizado
});
```

El campo `update: {}` es intencional: si el operador editó la descripción de una tabla en producción, el seed NO sobreescribe. Este patrón es exigido por el INSTRUCTIVO-006 REGLAS DURAS §4.

---

## Tablas PI verificadas (candado 15 · 2026-08-28)

### Tabla Reporte — campos relevantes para seed columnas

| Campo | Tipo | Nota |
|---|---|---|
| id | String @id | cuid |
| pais | String | ISO code |
| ciudad | String | |
| estado | EstadoReporte | Enum: PENDIENTE · REVISION · CERRADO · RECHAZADO · COMITE |
| prioridadAlta | Boolean | |
| esRafaga | Boolean | |
| esAnonimo | Boolean | |
| eliminado | Boolean | soft-delete |
| creadoEn | DateTime | |
| tenantId | String | FK Tenant |

### Tabla ClasificacionIA — campos relevantes

| Campo | Tipo | Nota |
|---|---|---|
| id | String @id | |
| reporteId | String | FK Reporte |
| categoria | CategoriaConducta | Enum |
| confianza | Float | 0.0-1.0 |
| latenciaMs | Int | ms |
| modeloUsado | String | nombre del modelo LLM |
| creadoEn | DateTime | |

### Tabla BillingCycle — campos relevantes

| Campo | Tipo | Nota |
|---|---|---|
| id | String @id | |
| tenantId | String | FK Tenant |
| monto | Float | |
| estado | String | |
| periodoInicio | DateTime | |
| periodoFin | DateTime? | |

---

## 30 ejemplos NL→SQL curados (categorías)

| Categoría | Ejemplos incluidos |
|---|---|
| reportes | 8 ejemplos (hoy · semana · país · colegio · estado · prioridad) |
| motor_ia | 6 ejemplos (accuracy · latencia · correcciones · por modelo) |
| comercial | 5 ejemplos (MRR · churn · plans · tenants activos) |
| operativo | 5 ejemplos (tiempo medio resolución · transiciones · comités) |
| salud | 4 ejemplos (audit events · alertas · tendencias) |
| general | 2 ejemplos (conteos globales) |

---

## Dependencia de orden en seed

```
seedTablas() → seedColumnas() → seedMetricas() → seedEjemplos()
```

`seedColumnas` necesita los IDs de las tablas (tablaId FK). `seedMetricas` y `seedEjemplos` referencian opcionalmente tablaId. Por eso el orden importa y las 4 funciones se llaman secuencialmente en `main()`.

---

## Test de idempotencia (regla dura del INSTRUCTIVO-006 §5)

```bash
COUNT_ANTES=$(psql $DATABASE_URL -tAc "SELECT count(*) FROM bi_catalogo_tabla")
npx prisma db seed   # segunda ejecución
COUNT_DESPUES=$(psql $DATABASE_URL -tAc "SELECT count(*) FROM bi_catalogo_tabla")
[ "$COUNT_ANTES" = "$COUNT_DESPUES" ] && echo "OK" || echo "FALLO · upsert no es idempotente"
```

El mismo test se repite para `bi_catalogo_columna`, `bi_catalogo_metrica`, `bi_catalogo_ejemplo`.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
