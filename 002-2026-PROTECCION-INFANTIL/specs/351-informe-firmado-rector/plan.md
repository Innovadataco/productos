# Implementation Plan: SPEC-351 · Informe firmado del rector (A-69 · C5)

**Branch**: `work/pi-SPEC-351-informe-firmado-rector` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

## Summary

Genera un PDF membreteado del caso con secciones seleccionables, escudo del
colegio (nueva columna en `Colegio`), correlativo `INF-AAAA-NNNN` serializado
con advisory-lock (patrón I-208), firma del rector (nombre + documento del
`Usuario`) y código de verificación pública que reusa el mecanismo de sello
de SPEC-234/341 (hash del buffer final, verificable por
`/verificar/[codigo]`). Historial inmutable — mismo estilo que `InformePadre`.

## Technical Context

- **Prisma 5.22**, **pdfmake** (ya en uso por SPEC-234 para el PDF del padre),
  **Next.js App Router**, **Vitest**.
- Reuso: helper de generación PDF (`generarPdfExpediente` como referencia,
  no como base directa — el layout del rector es distinto), sello de código +
  hash de SPEC-234, ruta pública `/api/publico/verificar-pdf` (SPEC-346).
- Nuevo modelo `InformeCaso`, nueva columna `Colegio.escudoAssetKey`,
  endpoints POST/GET/GET-pdf, componente cliente `PanelGenerarInforme`.

## Constitution Check

- §1.3 (voz sin acusación) — el informe describe hechos + actuación; no
  incluye texto crudo del reporte comunitario si no lo generó el colegio. **PASA.**
- §1.4 (parametrizables) — no se agregan umbrales; el tope de tamaño del
  escudo es constante razonable (500 KB) documentada. **PASA.**
- §3.6 (validación) — upload del escudo con validación de tipo/tamaño; el
  hash del PDF es SHA-256 canónico. **PASA.**
- §4.5 (Prisma conventions) — nuevo modelo con `@@unique`, `@@index`, FK
  con Cascade en el caso. **PASA.**

## Project Structure

```
002-2026-PROTECCION-INFANTIL/
├── prisma/
│   ├── schema.prisma                                            # +Colegio.escudoAssetKey String? · +model InformeCaso
│   └── migrations/<ts>_informe_caso/                            # aditiva
├── src/
│   ├── lib/
│   │   ├── dal/services/
│   │   │   └── informes-caso.ts                                 # NUEVO — registrarInformeCaso() con pg_advisory_xact_lock por caso; listarInformesCaso(); buscarInformeCasoPorHash/Codigo
│   │   ├── caso/
│   │   │   └── pdf-informe-caso.ts                              # NUEVO — generarPdfInformeCaso(datos): Buffer (pdfmake, membrete con escudo)
│   │   └── colegio/
│   │       └── escudo-storage.ts                                # NUEVO — subir/leer el escudo (mismo patrón que otros uploads)
│   ├── app/api/colegio/casos/[id]/informes/
│   │   ├── route.ts                                             # POST (genera + persiste) + GET (historial)
│   │   ├── route.test.ts                                        # NUEVO
│   │   └── [hash]/pdf/route.ts                                  # GET del PDF por hash (caché servidor-side)
│   ├── app/api/publico/verificar-pdf/[hash]/route.ts            # extendido: resuelve InformeCaso además de InformePadre/InformeConsolidado
│   ├── app/verificar/[codigo]/page.tsx                          # extendido: buscarInformeCasoPorCodigo + rama de renderizado con firma del rector
│   └── components/modules/colegio/casos/
│       ├── PanelGenerarInforme.tsx                              # NUEVO — client component con selección de secciones
│       └── HistorialInformes.tsx                                # NUEVO — lista con descarga por hash
└── src/app/dashboard/colegio/configuracion/
    └── EscudoColegioUploader.tsx                                # NUEVO (o extensión de la página existente) — upload del escudo
```

## Fases

### Phase 0 — Research
- **R-1**: `pdfmake` en uso — verificar dónde vive el layout del padre y si
  algún helper es reutilizable (`src/lib/expediente/pdf-expediente.ts`).
- **R-2**: Escudo como asset — hay `pi_apelaciones_storage` en Docker.
  Verificar si el mismo mount sirve para escudos o hay que agregar uno
  aparte. Decisión: reusar el mismo volumen con carpeta `escudos/`.
- **R-3**: Hash del PDF — el patrón de SPEC-234 dice "hash del buffer FINAL,
  código impreso decidido antes". Test de humo con un PDF de prueba local.
- **R-4**: Rango de anio para el correlativo — TZ Bogota con
  `Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota" })` para
  extraer el año al momento de generar.

### Phase 1 — Design & contratos
- `data-model.md`: `InformeCaso` completo + `Colegio.escudoAssetKey`.
- `contracts/informes-endpoint.md`: POST (body `{ secciones: string[] }`),
  GET historial (paginado), GET pdf por hash.
- `quickstart.md`: subir escudo → escalar caso → agregar bitácora →
  generar informe con 3 secciones → descargar → verificar código en
  incógnito.

## Complexity Tracking

Sin violaciones. Un modelo nuevo y una columna nueva es lo mínimo para el
alcance funcional.
