# SPEC-599 · Tareas

## Fase 1 — Piezas atómicas
- [x] T001 · `registro-hijo/types.ts` — `DatosHijoForm`, `IdentificadorNuevo`, `ErroresPasoDatos`, `FORM_VACIO`, `IDENTIFICADOR_VACIO`.
- [x] T002 · `registro-hijo/WizardStepper.tsx` — 4 pasos, `aria-current`, volver a visitados (`maxVisitado`), líneas que se llenan.
- [x] T003 · `registro-hijo/ChipEdad.tsx` — chips 5-17 (`edadesMenor()`), opcional, conmutable, `aria-pressed`.
- [x] T004 · `registro-hijo/PreviewCirculoVivo.tsx` — SVG reactivo (iniciales, etiqueta, tarjeta de estado verde/ámbar), geometría de `IlustracionCirculo`.

## Fase 2 — Pasos
- [x] T005 · `registro-hijo/PasoBienvenidaRegistro.tsx` — propuesta de valor, beneficios, ilustración ficticia, CTA.
- [x] T006 · `registro-hijo/PasoDatosHijo.tsx` — form (testids `form-hijo` / `identificadores-nuevos` conservados), chips de edad, alta múltiple de cuentas, preview vivo.
- [x] T007 · `registro-hijo/PasoCirculoConfianza.tsx` — cómo funciona el círculo + simulador `role="switch"` verde→ámbar.
- [x] T008 · `registro-hijo/ResumenRegistro.tsx` — confirmación, resumen, "Registrar a otro hijo", enlace al círculo de confianza.

## Fase 3 — Orquestación e integración
- [x] T009 · `registro-hijo/RegistroHijoWizard.tsx` — estado, validación amable, POST con payload SPEC-589, foco al título, reset.
- [x] T010 · `MisHijos.tsx` — el alta pasa a ser el wizard; carga, cupo y acciones de tarjetas intactas.

## Fase 4 — Tests y gate
- [x] T011 · `registro-hijo/RegistroHijoWizard.test.tsx` — navegación, validación (bloquea nombre/apellidos; edad opcional), preview vivo, simulador, POST + `onRegistrado`, error de servidor, reset.
- [x] T012 · `MisHijos.test.tsx` — tests del alta navegan el wizard; "Confirmar registro" dispara el POST.
- [x] T013 · `mis-hijos-plataforma.candado.test.tsx` — navegación al paso 2; aserciones del candado sin cambios. SPEC-565 intacto.
- [x] T014 · Gate: `tsc --noEmit`, `lint`, `test` (completo), `build` (`rm -rf .next`), candados de la zona en verde.
