# Data Model: SPEC-143 — DTO `HomeRector` (sin cambio de schema)

**Fecha**: 2026-08-03 · **Spec**: [spec.md](./spec.md)

Esta SPEC NO modifica `prisma/schema.prisma` ni crea migraciones. Toda la lectura es
sobre modelos existentes (`Estudiante`, `Curso`, `Profesor`, `AlertaColegio`,
`IdentificadorEstudiante`, `AcudienteEstudiante`, `Colegio`, `Usuario`).

## DTO de salida de `ColegioResumenRepository.homeRector(colegioId)`

```typescript
type EstadoSistema = "pino" | "ambar" | "rubi";   // definido en ui/Anillo.tsx (SPEC-157)

interface HomeRector {
  colegio: { nombre: string; vigenciaFin: Date | null };
  kpis: {
    estudiantes: number;        // activos
    cursos: number;             // activos
    profesores: number;         // activos
    reportesMes: number;        // métrica D2, mes en curso
    reportesSemana: number;     // métrica D2, últimos 7 días
    deltaSemana: number;        // reportesSemana - reportesSemanaAnterior
  };
  cobertura: {
    vigilancia: number;         // 0..1 — % estudiantes con ≥1 identificador activo
    reaccion: number;           // 0..1 — % con ≥1 acudiente
    sinRedes: number;           // personas (hueco vigilancia)
    sinContacto: number;        // personas (hueco reacción)
  };
  semaforo: { alertasNuevas: number; alertas72h: number };  // → resolverEstado (D1: ámbar = 72 h)
  ultimaSenal: Date | null;        // max(AlertaColegio.creadoEn) — D3(a), por colegio
  latidoSistema: Date | null;      // heartbeat del worker (worker.heartbeat) — D3(b), global
  tendencia: {
    semanal: Array<{ periodo: string; reportes: number }>;   // 12 semanas
    mensual: Array<{ periodo: string; reportes: number }>;   // 12 meses
    anual: Array<{ periodo: string; reportes: number }>;     // 3 años
  };
  cursosMirada: Array<{
    cursoId: string;
    nombre: string;             // ej. "8-B"
    profesorTitular: string | null;   // "María López" o null → "sin titular asignado"
    alertas30d: number;
  }>;                          // top 3 por alertas30d desc
}
```

## Reglas de cálculo

- **Tenant**: cada conteo filtra `colegioId` (directo o vía `estudiante.colegioId` /
  raw con tenant en ambos lados, patrón existente de `alerta-colegio.ts`).
- **Solo activos**: estudiantes/cursos/profesores con `estado = "activo"`;
  identificadores con `estado = "activo"`.
- **Acudiente**: solo vía `estudiante.acudientes` (D1 de SPEC-144 — jamás por id
  suelto).
- **División por cero**: `estudiantes = 0` ⇒ vigilancia/reacción = 0 y los huecos
  = 0 (la pantalla muestra el estado "sin datos aún" / empty state si 0 cursos).
- **Fechas**: `creadoEn` en UTC; semana = últimos 7 días, semana anterior = días
  8-14, mes = mes calendario en curso, 30 días para cursosMirada. Series con groupBy
  por semana/mes/año en SQL o agregación en memoria sobre rows `(creadoEn)` —
  decisión de implementación por simplicidad del groupBy en Prisma (raw con
  `date_trunc`, tenant en el where).
- **PII (I-29)**: el DTO no contiene scores, categorías técnicas, textos ni datos de
  reportes individuales — solo conteos y nombres de curso/profesor del propio
  colegio.
