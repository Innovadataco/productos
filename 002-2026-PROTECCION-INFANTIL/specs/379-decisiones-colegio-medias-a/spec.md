# SPEC-379 (PR A) · Decisiones del colegio a medias — quick wins

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1 · **Origen**: D-100 (Jelkin, 31-08).

## Problema

Tres decisiones que Jelkin tomó en D-100 quedaron a medias:

- **D5b**: la carga por Excel de profesores existe (endpoints
  `/api/colegio/carga-profesores/*`) pero solo se dispara desde el camino
  inicial. Un rector que ya terminó el onboarding no tiene forma de subir
  una lista después.
- **D3**: SPEC-344 puso el candado del SERVIDOR "toda materia debe llevar
  un profesor a cargo", pero la UI de asignar materias al curso (`SeccionMateriasCurso`)
  decía "Profesor (opcional)" y ofrecía "Sin profesor asignado" — el rector
  solo se enteraba con el 400 al guardar.
- **D1**: `pdf-informe-caso` ya lleva membrete (escudo + nombre + NIT); los
  otros dos PDFs colegio-scope que el rector se lleva a consejo directivo o
  a la Secretaría (`pdf-informe-mensual`, `pdf-estadisticas`) NO. Falta de
  credibilidad del documento.

`pdf-denuncia` y `pdf-expediente` NO entran acá — son `admin`/`padre` scope,
no `colegio`; poner un escudo del colegio en un documento firmado por otra
autoridad aparentaría una autoría que no es (peor que la falta de membrete).

## Requisitos

- **FR-001 (D1)**: `pdf-informe-mensual` y `pdf-estadisticas` llevan el
  membrete institucional: escudo (si el colegio lo cargó) + nombre + NIT.
- **FR-002 (D1, CANDADO)**: si el colegio no cargó escudo, el PDF sale igual,
  con la cabecera sin imagen — nunca romperse.
- **FR-003 (D1, MISMO HELPER)**: los dos PDFs `pdfmake` (`pdf-informe-caso`
  y `pdf-estadisticas`) usan `armarMembreteColegio` de un módulo compartido
  (`src/lib/colegio/membrete-pdf.ts`). `pdf-informe-mensual` usa `react-pdf`
  y lleva el equivalente JSX con el mismo layout visual (escudo 64×64,
  nombre 16pt bold negro, NIT 9pt gris).
- **FR-004 (D1, CANDADO DEL SELLO)**: NO se refactoriza `pdf-informe-caso`
  en este PR. Ya está en producción con informes firmados; cambiar un solo
  byte del PDF haría fallar la verificación por hash. El helper existe y
  espera al informe del caso; el refactor va en otro PR con test byte-a-byte.
- **FR-005 (D3)**: `SeccionMateriasCurso` marca el profesor como OBLIGATORIO:
  label sin "(opcional)", sin opción "Sin profesor asignado", botón "Asignar"
  deshabilitado hasta elegir materia + profesor, hint accionable cuando hay
  materia sin profesor. El candado del servidor (SPEC-344) sigue vivo por
  si alguien llega por API.
- **FR-006 (D5b)**: la gestión diaria de profesores
  (`/dashboard/colegio/profesores`) expone la carga masiva por Excel/CSV
  reusando el componente extraído del wizard (`CargaProfesoresExcel`).
  Cero endpoint nuevo; contrato intacto.

## Impacto en arquitectura:

- Nuevo módulo `src/lib/colegio/membrete-pdf.ts` (helper + estilos) usado por
  `pdf-estadisticas` (en este PR) y disponible para `pdf-informe-caso`
  (refactor en PR aparte por el candado del sello).
- Nuevo componente `src/components/modules/colegio/CargaProfesoresExcel.tsx`
  extraído del camino inicial; el wizard lo consume en vez del inline.
- `SELECT_RESUMEN` del `ColegioRepository` amplía a `nit` + `escudoAssetKey`
  (aditivo, no rompe consumidores).
- `EstadisticasColegio` y `InformeMensualColegio` amplían con `colegioNit`
  + `escudoAssetKey` (aditivo).

## Fuera de alcance

- **PR B (SPEC-379b)**: carga masiva de CURSOS por Excel (D5a). Feature
  nueva completa con plantilla + validador + endpoints + UI + test-candado
  de autoconsistencia. Va en un PR separado por tamaño.
- Refactor de `pdf-informe-caso` al helper compartido (candado del sello).
