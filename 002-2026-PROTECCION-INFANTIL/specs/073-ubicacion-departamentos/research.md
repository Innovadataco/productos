# Research: Módulo Colegios — Fase 0: Ubicación (País → Departamento → Ciudad) (Spec 073)

**Date**: 2026-07-21
**Feature**: specs/073-ubicacion-departamentos/spec.md

---

## Decisions

### D1: Fuente de la división territorial de Colombia

**Decision**: Usar la División Político-Administrativa de Colombia reconocida oficialmente: 32 departamentos + Bogotá D.C. (Distrito Capital), con sus respectivas capitales y principales municipios.

**Rationale**: La fuente es estable y pública. Para el seed se incluirán al menos las capitales de cada departamento y las principales ciudades ya existentes en el seed (Bogotá, Medellín, Cali, Barranquilla, Cartagena, Bucaramanga, Pereira, Manizales, Cúcuta, Ibagué).

**Listado de 32 departamentos + Bogotá D.C. (con capital)**:

| Departamento | Capital |
|---|---|
| Amazonas | Leticia |
| Antioquia | Medellín |
| Arauca | Arauca |
| Atlántico | Barranquilla |
| Bolívar | Cartagena |
| Boyacá | Tunja |
| Caldas | Manizales |
| Caquetá | Florencia |
| Casanare | Yopal |
| Cauca | Popayán |
| Cesar | Valledupar |
| Chocó | Quibdó |
| Córdoba | Montería |
| Cundinamarca | Bogotá |
| Bogotá D.C. | Bogotá |
| Guainía | Inírida |
| Guaviare | San José del Guaviare |
| Huila | Neiva |
| La Guajira | Riohacha |
| Magdalena | Santa Marta |
| Meta | Villavicencio |
| Nariño | Pasto |
| Norte de Santander | Cúcuta |
| Putumayo | Mocoa |
| Quindío | Armenia |
| Risaralda | Pereira |
| San Andrés y Providencia | San Andrés |
| Santander | Bucaramanga |
| Sucre | Sincelejo |
| Tolima | Ibagué |
| Valle del Cauca | Cali |
| Vaupés | Mitú |
| Vichada | Puerto Carreño |

### D2: Estrategia de migración aditiva

**Decision**: Crear `Departamento` como tabla nueva y agregar `departamentoId` nullable a `Ciudad`. No se elimina `Ciudad.paisId`.

**Rationale**:
- `Reporte` usa `pais`/`ciudad` como string y `paisId`/`ciudadId` opcionales. Eliminar `paisId` de `Ciudad` rompería el modelo y los reportes existentes.
- Mantener `paisId` en `Ciudad` permite que ciudades sin departamento (otros países o ciudades no mapeadas) sigan funcionando.
- La columna `departamentoId` es nullable, así que migraciones y seeds no requieren datos obligatorios.

**Modelo propuesto**:
```prisma
model Departamento {
  id         String   @id @default(cuid())
  codigo     String?  @unique
  nombre     String
  paisId     String
  esActivo   Boolean  @default(true)
  creadoEn   DateTime @default(now())
  actualizadoEn DateTime @updatedAt

  pais     Pais     @relation(fields: [paisId], references: [id])
  ciudades Ciudad[]

  @@index([paisId])
  @@index([esActivo])
  @@map("departamentos")
}

model Ciudad {
  id             String        @id @default(cuid())
  nombre         String
  paisId         String
  departamentoId String?
  lat            Float?
  lng            Float?
  esActivo       Boolean       @default(true)
  creadoEn       DateTime      @default(now())

  pais          Pais          @relation(fields: [paisId], references: [id])
  departamento  Departamento? @relation(fields: [departamentoId], references: [id])
  reportes      Reporte[]

  @@unique([nombre, paisId])
  @@index([paisId])
  @@index([departamentoId])
  @@index([esActivo])
  @@map("ciudades")
}

model Pais {
  id          String        @id @default(cuid())
  codigo      String        @unique
  nombre      String
  esActivo    Boolean       @default(true)
  creadoEn    DateTime      @default(now())

  ciudades      Ciudad[]
  departamentos Departamento[]
  reportes      Reporte[]

  @@index([codigo])
  @@index([esActivo])
  @@map("paises")
}
```

### D3: Idempotencia del seed

**Decision**: Usar `upsert` para países, departamentos y ciudades, con claves naturales estables.

**Rationale**:
- País: `upsert` por `codigo` (ej. `"CO"`).
- Departamento: `upsert` por `(nombre, paisId)`.
- Ciudad: `upsert` por `(nombre, paisId)` (índice unique existente). Se actualiza `departamentoId` si cambia.

### D4: No se tocan endpoints ni UI en esta fase

**Decision**: El endpoint `/api/ciudades` sigue devolviendo `id, nombre, paisId`. No se agrega `departamentoId` al select ni a la respuesta en esta fase.

**Rationale**: Mantener el contrato actual asegura no-regresión. Expander el endpoint es trivial en una fase posterior si se necesita selector de departamento.

---

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Eliminar `Ciudad.paisId` y forzar relación solo vía `Departamento` | Rompe compatibilidad con reportes y ciudades sin departamento |
| Crear `Departamento` como campo string en `Ciudad` | No permite relaciones ni escalabilidad a futuro |
| Cargar todos los municipios de Colombia (~1.123) | Fuera de alcance de Fase 0; con capitales + principales ciudades es suficiente |
| Modificar `/api/ciudades` para incluir `departamentoId` | No es necesario en esta fase y aumenta superficie de regresión |
| Hacer `departamentoId` obligatorio | No, porque hay ciudades de otros países sin datos de departamento |

---

## Open Questions (0 remaining)

All NEEDS CLARIFICATION resolved. El modelo, la fuente de datos y la estrategia de migración están definidos.
