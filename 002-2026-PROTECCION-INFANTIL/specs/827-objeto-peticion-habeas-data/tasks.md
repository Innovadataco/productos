# Tasks · SPEC-827

- [x] **T1** · Medir el flujo del selector (819) contra main: creación de `SolicitudHabeasData` por
  `crearPeticionServicio`. Punto de extensión = el objeto que pide el titular.
- [x] **T2** · Schema: `clasesSolicitadas ClaseDatoTitular[] @default([])` (≠ `clasesDatoAfectadas`).
- [x] **T3** · Migración D-121 (array de enum): DEFAULT con cast explícito + CHECK `objeto_por_tipo` NOT VALID.
  Aplicada al test DB. Las tres trampas documentadas en el SQL para la revisión de Datos.
- [x] **T4** · Service + ruta: code-gate + superRefine (RECT/SUPR ≥1, CONSULTA vacío); persiste `clasesSolicitadas`;
  la ruta acepta el enum completo.
- [x] **T5** · Candado en dos capas (conducta + inserción CHECK) + RED-first.
- [x] **T6** · UI (`PuertaSoporte.tsx`): eje C multi-select con las 6 clases (copy de Diseño b87771e) + límites del
  relato (COPY_CORRECCION_RELATO §2 refrescado e4b31da) en RECTIFICACION. §3 [ABOGADO] NO se cablea.
- [x] **T7** · Candado de UI (eje C) + RED-first; `copy-correccion-relato` sale del allowlist (cableado).
- [x] **T8** · Gate COMPLETO por EXIT CODE: tsc + lint + arch:check + test:unit + candados de integración.
- [ ] **T9** · Push + PR (D-121 a Datos en el PR).

## Nota
- SPEC single-owner (Dev-3); carpeta propia, sin colisión de número.
- El `specs/README.md` no se edita en el PR (SPEC-487/D-109: lo regenera el barrido post-merge).
