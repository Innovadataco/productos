# Cierre — Spec 095 (curaduría del banco): adjudicación 42/42 y primer número comparable

**Fecha**: 2026-07-26 · **Alcance**: prompt 002-PI-011 · **Rama**: `feature/001-scaffolding`

## Qué se hizo

1. **Adjudicación trasladada**: las 42 etiquetas aprobadas por el CEO (28 por las 3 reglas de
   taxonomía D-24 + 14 como experto) quedaron en `docs/adjudicacion-095-casos-disputa.md`
   (etiqueta adjudicada + razón por caso). Fuente:
   `Gestion-de-proyectos/.../05-ENTREGABLES/ADJUDICACION-BANCO-PRIMERA-PASADA.md`.
2. **Banco gobernado actualizado (fixtureVersion=2)**: `scripts/aplicar-adjudicacion-095.ts`
   aplicó los **25 casos que cambiaban** con gobernanza (disable + create `MANUAL_ADMIN` +
   AuditLog `EVAL_CASE_DISABLE`/`EVAL_CASE_CREATE`, `creadoEn` preservado). Los **17 de
   confirmación** (banco ya correcto) no se tocaron. El banco sigue en 200 casos activos.
   Validación previa obligatoria: snippet único de texto + etiqueta actual esperada; aborta
   ante cualquier inconsistencia.
3. **#149**: quedó `COMPARTIMIENTO_SEXUAL (+DIFUSION_NO_CONSENTIDA)` marcado **PROVISIONAL,
   pendiente de confirmación legal** (material de menor generado con IA, frente R08). No se
   alteró la decisión del CEO.
4. **Re-export reproducible**: `exportar-banco-simulacion.ts` ahora filtra `fixtureVersion=2,
   activo` (incluye los MANUAL_ADMIN re-etiquetados) con orden determinista
   (`creadoEn, id`). `simulacion-200-antes-curaduria.json` = foto exacta pre-adjudicación
   (reconstruida desde BD: mismos 200 textos, solo 25 etiquetas difieren).
5. **Medición limpia (una variable a la vez, rúbrica intacta)**: `eval-dual-banco.ts`
   clasifica cada caso UNA vez por motor y puntúa contra **ambos** juegos de etiquetas
   (antes/después). Por motor: accuracy, silenciosos (fallo con confianza ≥ umbral_revisión),
   subestimaciones (Δseveridad < 0) y ESPS (ADR_006: Σ|Δsev|, subestimación ×3).

## El número real (200 casos, mismos textos, mismos motores)

| Motor | Etiquetas | Accuracy | Silenciosos | Subestimaciones | Sev. perdida | ESPS |
|-------|-----------|---------:|------------:|----------------:|-------------:|-----:|
| Legacy (gemma2:27b, votos) | antes | 69.0% (138/200) | 58 | 19 | 525 | 1740 |
| Legacy | **después** | **74.5% (149/200)** | 47 | **9** | 365 | **1240** |
| Rúbrica multi-modelo | antes | 64.5% (129/200) | 30 | 15 | 290 | 1170 |
| Rúbrica | **después** | **70.5% (141/200)** | 18 | **4** | 115 | **625** |

Resultado completo (detalle por caso): `scripts/simulacion/resultados-dual-095-baseline-pre098.json`
(200 casos; el nombre `resultados-dual-095.json` lo regenera el runner en la próxima corrida completa).

**Lectura**: la curaduría sube el accuracy medido de ambos motores (el banco forzaba
etiquetas incorrectas) y, más importante, colapsa las subestimaciones de la rúbrica de 15 a
**4** y su ESPS a la mitad (1170 → 625). Sobre el banco curado la **rúbrica tiene menos de
la mitad de las subestimaciones del legacy (4 vs 9)** y la mitad de su ESPS: es el primer
número comparable de verdad y favorece a la rúbrica en seguridad, aunque el legacy aún gana
en accuracy crudo (74.5% vs 70.5%).

## Casos que cambiaron de etiqueta (25)

- **Agregan secundaria** (principal intacta): #5, #43, #44, #67, #95, #97, #98, #102, #103,
  #104, #105, #107, #109, #131, #171, #172.
- **Cambian principal**: #75 (OFRECIMIENTO→SOLICITUD_MATERIAL), #106 (COMPARTIMIENTO→
  SOLICITUD_MATERIAL), #108 y #110 y #111 (COMPARTIMIENTO→EXTORSION, sextorsión),
  #135 (invierte a EXTORSION principal), #146 (CONTENIDO_GENERADO_IA→SUPLANTACION_IDENTIDAD,
  método vs conducta), #149 (DIFUSION→COMPARTIMIENTO_SEXUAL, provisional-legal).
- **Cambian secundaria**: #138 (CONTENIDO_GENERADO_IA→SUPLANTACION_IDENTIDAD).

## Hallazgos y notas

- **Orden del banco**: la numeración "#N" de la hoja de disputas NO coincide con el orden
  físico de la BD (empates de `creadoEn` del seed masivo). Los casos se localizaron por
  texto; el export ahora usa orden determinista (`creadoEn, id`). Quedan 3 pares adyacentes
  intercambiados entre la foto "antes" y el export curado (mismo `creadoEn`, nuevo id al
  re-etiquetar): #111↔#112, #146↔#147, #149↔#150. Sin efecto en las métricas (match por
  texto); los índices del detalle en `resultados-dual-095-baseline-pre098.json` siguen el orden del banco
  curado.
- **Corrección post-corrida**: la primera corrida normalizó la confianza de la rúbrica
  con `/100` creyéndola porcentaje, pero `calcularPorcentajes` devuelve fracciones 0–1.
  Se corrigió el script y se recalcularon las métricas de la rúbrica desde el detalle
  (sanity check: los números del legacy se reprodujeron idénticos; no hizo falta
  re-clasificar los 200 casos).
- **"Silenciosos" OTRO→OTRO del legacy** (30 de los 47): el modelo acierta el contenido
  (OTRO) pero los votos entre modelos discrepan y el caso cae a `REVISION_MANUAL`; el
  arnés lo cuenta como fallo (regla `estado != REVISION_MANUAL`, heredada de spec 095).
  Tienen Δseveridad 0: no inflan ESPS. Misma regla en ambos motores y versiones.
- **Subestimaciones graves que quedan (después)**: rúbrica 4 (ninguna silenciosa: los 4
  fallos de grave→leve van con confianza < 1.0 o a revisión); legacy 9, **todas silenciosas**
  (confianza 1.0: índices 64, 86, 89, 99, 105, 109, 138, 150, 172 del detalle — p.ej.
  SOLICITUD_MATERIAL→CONTACTO_INSISTENTE, EXTORSION→OTRO, DOXING→OTRO).
- **Los 2 hallazgos de motor** (selección de "principal" por gravedad; decisiva de
  targeting anti-spam en OFRECIMIENTO_REGALOS/CONTACTO_INSISTENTE) NO se tocaron: van a
  afinamiento de rúbrica en spec aparte, ahora que existe línea base limpia.

## Gate y despliegue

- `npx tsc --noEmit` ✅ · `npm run lint` ✅ (0 errores; 1 warning preexistente en
  `IaModelSelector.tsx`) · `npm run test` ✅ (149 archivos, 882 tests) · `npm run build` ✅
- `./scripts/dev-restart.sh` ✅ — healthcheck `{"status":"ok","workerAlive":true,"dbOk":true}`
  (app :5005 + UN worker).

## Deuda técnica

- Arnés: la regla `estado != REVISION_MANUAL` penaliza motores que abstienen; considerar
  reportar "accuracy condicional" (solo casos clasificados) como métrica complementaria en
  la spec de afinamiento.
- `simulacion-50-casos-eval.json` (nombre histórico, 200 casos) mezcla campos legacy
  (`plataforma`, `identificador`, ...) que el runner no usa; candidato a limpieza.
- Pendiente permanente: confirmación legal de #149 antes de producción (R08).
