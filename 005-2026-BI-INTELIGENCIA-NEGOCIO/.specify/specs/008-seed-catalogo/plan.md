# PLAN-008 · Seed idempotente catálogo BI

## Pre-requisito

SPEC-007 CUMPLE — `npx prisma generate` corrió sin errores y los 6 modelos existen en BD.

## Pasos de implementación

### Paso 1 · Crear `prisma/seed-catalogo.ts`

Estructura del archivo:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await seedTablas();
  await seedColumnas();
  await seedMetricas();
  await seedEjemplos();
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Paso 2 · Implementar seedTablas() — 15 tablas

```typescript
async function seedTablas() {
  const tablas = [
    { nombreFuente: "Reporte", nombreLegible: "Reportes de riesgo", descripcion: "Reportes de conducta potencialmente peligrosa detectados por PI", rolesPermitidos: ["ADMIN", "SCHOOL_ADMIN"] },
    { nombreFuente: "ClasificacionIA", nombreLegible: "Clasificaciones motor IA", descripcion: "Resultados del clasificador de conducta (categoría · confianza · latencia)", rolesPermitidos: ["ADMIN"] },
    { nombreFuente: "ClasificacionRubricaVoto", nombreLegible: "Votos rúbrica humana", descripcion: "Votos de validación humana sobre clasificaciones IA", rolesPermitidos: ["ADMIN"] },
    { nombreFuente: "TransicionReporte", nombreLegible: "Transiciones de estado", descripcion: "Historial de cambios de estado de reportes", rolesPermitidos: ["ADMIN", "SCHOOL_ADMIN"] },
    { nombreFuente: "SolicitudComite", nombreLegible: "Solicitudes de comité", descripcion: "Solicitudes de revisión por comité de un reporte", rolesPermitidos: ["ADMIN", "SCHOOL_ADMIN"] },
    { nombreFuente: "Colegio", nombreLegible: "Colegios", descripcion: "Instituciones educativas registradas en PI", rolesPermitidos: ["ADMIN", "SCHOOL_ADMIN"] },
    { nombreFuente: "Subscription", nombreLegible: "Suscripciones", descripcion: "Suscripciones de tenants al plan PI", rolesPermitidos: ["ADMIN"] },
    { nombreFuente: "BillingCycle", nombreLegible: "Ciclos de facturación", descripcion: "Ciclos de cobro por suscripción · monto · estado", rolesPermitidos: ["ADMIN"] },
    { nombreFuente: "Plan", nombreLegible: "Planes comerciales", descripcion: "Planes de servicio disponibles (precio · nombre)", rolesPermitidos: ["ADMIN"] },
    { nombreFuente: "Tenant", nombreLegible: "Tenants", descripcion: "Clientes multi-tenant del sistema PI", rolesPermitidos: ["ADMIN"] },
    { nombreFuente: "Alumno", nombreLegible: "Alumnos", descripcion: "Estudiantes monitoreados por PI", rolesPermitidos: ["ADMIN", "SCHOOL_ADMIN"] },
    { nombreFuente: "AuditLog", nombreLegible: "Log de auditoría", descripcion: "Registro de acciones administrativas del sistema", rolesPermitidos: ["ADMIN"] },
    { nombreFuente: "FuenteReporte", nombreLegible: "Fuentes de reporte", descripcion: "Origen del reporte (app · extensión · API)", rolesPermitidos: ["ADMIN"] },
    { nombreFuente: "AlertaColegio", nombreLegible: "Alertas de colegio", descripcion: "Alertas generadas a nivel de colegio", rolesPermitidos: ["ADMIN", "SCHOOL_ADMIN"] },
    { nombreFuente: "CorreccionAdmin", nombreLegible: "Correcciones admin", descripcion: "Correcciones manuales de clasificación IA por admin", rolesPermitidos: ["ADMIN"] },
  ];

  for (const t of tablas) {
    await prisma.bICatalogoTabla.upsert({
      where: { nombreFuente: t.nombreFuente },
      create: t,
      update: {},
    });
  }
}
```

### Paso 3 · Implementar seedColumnas() — ≥80 columnas

Columnas de las tablas más relevantes. Formato:

```typescript
async function seedColumnas() {
  // Para cada tabla: obtener el id desde BD · luego upsert columnas
  const reporte = await prisma.bICatalogoTabla.findUnique({ where: { nombreFuente: "Reporte" } });

  const columnas = [
    // Reporte
    { tablaId: reporte!.id, nombreFuente: "pais", nombreLegible: "País", descripcion: "País del reporte (código ISO)", tipo: "String" },
    { tablaId: reporte!.id, nombreFuente: "ciudad", nombreLegible: "Ciudad", descripcion: "Ciudad del reporte", tipo: "String" },
    { tablaId: reporte!.id, nombreFuente: "estado", nombreLegible: "Estado", descripcion: "Estado del reporte (PENDIENTE·REVISION·CERRADO·RECHAZADO·COMITE)", tipo: "EstadoReporte" },
    { tablaId: reporte!.id, nombreFuente: "prioridadAlta", nombreLegible: "Prioridad alta", descripcion: "Si el reporte fue marcado como prioridad alta", tipo: "Boolean" },
    { tablaId: reporte!.id, nombreFuente: "esRafaga", nombreLegible: "Es ráfaga", descripcion: "Si el reporte es parte de una ráfaga detectada", tipo: "Boolean" },
    { tablaId: reporte!.id, nombreFuente: "esAnonimo", nombreLegible: "Es anónimo", descripcion: "Si el reporte fue enviado anónimamente", tipo: "Boolean" },
    { tablaId: reporte!.id, nombreFuente: "eliminado", nombreLegible: "Eliminado", descripcion: "Soft-delete del reporte", tipo: "Boolean" },
    { tablaId: reporte!.id, nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de creación del reporte (UTC)", tipo: "DateTime" },
    // ... más columnas por tabla (total ≥80 en implementación)
  ];

  for (const c of columnas) {
    await prisma.bICatalogoColumna.upsert({
      where: { tablaId_nombreFuente: { tablaId: c.tablaId, nombreFuente: c.nombreFuente } },
      create: c,
      update: {},
    });
  }
}
```

### Paso 4 · Implementar seedMetricas() — 15 métricas

```typescript
async function seedMetricas() {
  const metricas = [
    { nombre: "reportes_dia", nombreLegible: "Reportes por día", formulaSQL: "SELECT date(\"creadoEn\"), count(*) FROM \"Reporte\" WHERE \"eliminado\"=false GROUP BY 1", categoria: "operativo" },
    { nombre: "tasa_clasificacion_correcta", nombreLegible: "Tasa clasificación correcta", formulaSQL: "SELECT count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM \"CorreccionAdmin\" ca WHERE ca.\"reporteId\"=c.\"reporteId\"))::float / count(*) FROM \"ClasificacionIA\" c", categoria: "motor_ia" },
    // ... 13 métricas más
  ];

  for (const m of metricas) {
    await prisma.bICatalogoMetrica.upsert({
      where: { nombre: m.nombre },
      create: m,
      update: {},
    });
  }
}
```

### Paso 5 · Implementar seedEjemplos() — 30 ejemplos NL→SQL

```typescript
async function seedEjemplos() {
  const ejemplos = [
    { preguntaNL: "¿Cuántos reportes se crearon hoy?", sql: "SELECT count(*) FROM \"Reporte\" WHERE date(\"creadoEn\")=current_date AND \"eliminado\"=false", categoriaConsulta: "reportes" },
    { preguntaNL: "¿Cuáles son los 5 países con más reportes este mes?", sql: "SELECT pais, count(*) as total FROM \"Reporte\" WHERE date_trunc('month',\"creadoEn\")=date_trunc('month',now()) AND \"eliminado\"=false GROUP BY pais ORDER BY total DESC LIMIT 5", categoriaConsulta: "geografico" },
    // ... 28 ejemplos más
  ];

  for (const e of ejemplos) {
    await prisma.bICatalogoEjemplo.upsert({
      where: { preguntaNL: e.preguntaNL },
      create: e,
      update: {},
    });
  }
}
```

### Paso 6 · Configurar script seed en package.json

```json
"prisma": {
  "seed": "tsx prisma/seed-catalogo.ts"
}
```

Verificar que `tsx` está instalado:
```bash
npm list tsx || npm install -D tsx
```

### Paso 7 · Test de idempotencia

```bash
npx prisma db seed
COUNT_1=$(psql $DATABASE_URL -tAc "SELECT count(*) FROM bi_catalogo_tabla")
npx prisma db seed
COUNT_2=$(psql $DATABASE_URL -tAc "SELECT count(*) FROM bi_catalogo_tabla")
[ "$COUNT_1" = "$COUNT_2" ] && echo "IDEMPOTENTE OK" || echo "FALLO: $COUNT_1 → $COUNT_2"
```

---

## Árbol de archivos resultante

```
prisma/
├── schema.prisma              (de SPEC-007)
├── seed-catalogo.ts           (NUEVO)
└── migrations/                (de SPEC-007)
package.json                   (modificado · "prisma": {"seed": "..."})
```

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
