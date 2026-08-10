# Modelo de datos: SPEC-160 — Dataset demo de producción

## Entidades afectadas

Todas las entidades del árbol demo deben ser marcables y purgables:

| Entidad | Uso en demo | Marcado | Purga |
|---------|-------------|---------|-------|
| `Tenant` | 1 por colegio demo | `DemoMarcado` | Borrar al final |
| `Colegio` | 5 colegios | `DemoMarcado` | Borrar luego de hijos |
| `Curso` | 10 por colegio | `DemoMarcado` (cascade) | Por borrado de colegio o manual |
| `Profesor` | 10 por colegio | `DemoMarcado` | Manual antes de colegio |
| `Estudiante` | 200 por colegio | `DemoMarcado` | Por borrado de curso |
| `AcudienteEstudiante` | 1-2 por estudiante | `DemoMarcado` (cascade) | Por borrado de estudiante |
| `IdentificadorEstudiante` | ≥5 por estudiante | `DemoMarcado` (cascade) | Por borrado de estudiante |
| `EstudianteObservacion` | opcional | `DemoMarcado` (cascade) | Por borrado de estudiante |
| `Usuario` (SCHOOL_ADMIN) | 5 | `DemoMarcado` | Manual antes de colegio |
| `Usuario` (OPERADOR/COMITE) | ≥11 | `DemoMarcado` | Manual antes de reportes |
| `Usuario` (PARENT) | ≥50 | `DemoMarcado` | Luego de reportes/círculos |
| `PerfilOperador` | ≥10 | `DemoMarcado` (cascade) | Por borrado de operador |
| `IntegranteComite` | ≥3 | `DemoMarcado` (cascade) | Por borrado de comité |
| `ContactoConfianza` | ~20 | `DemoMarcado` | Manual antes de padres |
| `IdentificadorContacto` | varios | `DemoMarcado` (cascade) | Por borrado de contacto |
| `Reporte` | varios cientos | `DemoMarcado` | Manual prioritario |
| `ClasificacionIA` | por reporte | cascade sobre `Reporte` | Automático |
| `EmbeddingReporte` | por reporte | cascade sobre `Reporte` | Automático |
| `FuenteReporte` | por reporte | cascade sobre `Reporte` | Automático |
| `TransicionReporte` | por reporte | cascade sobre `Reporte` | Automático |
| `ReintentoReporte` | por reporte | cascade sobre `Reporte` | Automático |
| `PasoProcesamiento` | por reporte | cascade sobre `Reporte` | Automático |
| `SolicitudComite` | algunos | cascade sobre `Reporte` | Automático |
| `AlertaColegio` | derivadas | `DemoMarcado` | Manual junto a reportes |
| `PatronInstitucional` | derivados | `DemoMarcado` | Manual junto a alertas |
| `IdentificadorReportado` | agregado global | Recalcular/borrar filas demo | Manual |
| `EventoMatch` | derivados | cascade sobre `IdentificadorReportado` o manual | Manual |
| `AlertaSuscripcion` | por padres demo | `DemoMarcado` | Manual |
| `SeguimientoCaso` | por alertas | cascade sobre `AlertaColegio` | Automático |
| `NotaSeguimiento` | por seguimientos | cascade sobre `SeguimientoCaso` | Automático |
| `RegistroAvisoColegio` | por alertas | `DemoMarcado` | Manual |
| `PreferenciaAlertaColegio` | por colegio | `DemoMarcado` | Manual |
| `CargaRosterSesion` | por carga | `DemoMarcado` | Manual |
| `AuditLog` | por mutaciones | `DemoMarcado` opcional | Opcional: conservar o purgar |

## Propuesta de schema: `DemoMarcado` (Opción A)

```prisma
model DemoMarcado {
  id         String   @id @default(cuid())
  entidad    String   // nombre de la tabla: Colegio, Usuario, Reporte, etc.
  entidadId  String
  metadata   Json?    // datos de trazabilidad: script, corrida, timestamp
  creadoEn   DateTime @default(now())

  @@index([entidad])
  @@index([entidadId])
  @@unique([entidad, entidadId])
  @@map("demo_marcado")
}
```

## Consideraciones de claves foráneas

- `Usuario.colegioId` → `Colegio.id`: actualmente sin `onDelete`. Para purgar sin errores se propone:
  - Opción A1: cambiar a `onDelete: SetNull` (migración segura).
  - Opción A2: en el script de purga, primero setear `colegioId = NULL` en usuarios demo antes de borrar colegios.
- `Colegio.admin` (relación inversa 1:1) también requiere manejo explícito.
- `Profesor` → `Colegio`: sin cascade; borrar antes del colegio.
- `Curso` → `Colegio`: sin cascade; borrar antes del colegio (o ajustar `onDelete: Cascade`).
- `Estudiante` → `Curso`: sin cascade; borrar cursos implica borrar estudiantes manualmente o ajustar cascade.

Dado que las relaciones actuales no usan cascade masivo, la purga en TypeScript permite control total del orden sin modificar el schema, excepto quizás el `Usuario.colegioId`.

## Alternativa: convención por email

Como defensa en profundidad, todos los usuarios demo tendrán email `soporte+*@innovadataco.com`. La purga puede usar esto como validación cruzada contra `DemoMarcado`.
