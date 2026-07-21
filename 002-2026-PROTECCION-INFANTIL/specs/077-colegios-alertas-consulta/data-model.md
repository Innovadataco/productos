# Data Model: Colegios · Fase 4 — Alertas y Consulta anonimizada

## Nueva entidad

```prisma
model AlertaColegio {
  id                   String   @id @default(cuid())
  colegioId            String
  reporteId            String
  identificadorAlumnoId String
  estado                 String   @default("nueva") // nueva | vista | gestionada
  creadoEn               DateTime @default(now())
  actualizadoEn          DateTime @updatedAt

  colegio            Colegio            @relation(fields: [colegioId], references: [id])
  reporte            Reporte            @relation(fields: [reporteId], references: [id])
  identificadorAlumno IdentificadorAlumno @relation(fields: [identificadorAlumnoId], references: [id])

  @@unique([colegioId, reporteId, identificadorAlumnoId])
  @@index([colegioId, estado])
  @@index([reporteId])
}
```

## Cambios en entidades existentes

- `Colegio` recibe relación inversa: `alertas AlertaColegio[]`.
- `Reporte` recibe relación inversa: `alertasColegio AlertaColegio[]`.
- `IdentificadorAlumno` recibe relación inversa: `alertas AlertaColegio[]`.

## Notas

- Soft delete: no se borra físicamente; si el reporte se da de baja, se filtra en la consulta.
- `estado` de alerta controla el flujo de gestión interna del colegio; no afecta el reporte.
- El matching usa `reporte.identificador` vs `IdentificadorAlumno.valor` (ambos normalizados).
