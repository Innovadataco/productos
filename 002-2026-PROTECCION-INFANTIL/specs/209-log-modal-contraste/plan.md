# Plan de implementación: SPEC-209 — LogContextoModal contraste (002-PI-142)

## Resumen

Invertir la paleta del bloque de mensaje humano en `LogContextoModal.tsx` para mejorar contraste en modo claro y oscuro. Cambio mínimo de 1 archivo, ~3 líneas. Cierra I-103.

## Contexto técnico

- React + Tailwind CSS.
- Componente en `src/components/modules/monitoreo/LogContextoModal.tsx`.
- Sistema visual: vidrio Apple + Instrument + radios 16/12/22.

## Constitution Check

- ✅ Sin multimedia.
- ✅ Presunción de inocencia no aplica.
- ✅ IA local no se toca.
- ✅ Canales oficiales no afectados.
- ✅ Disputas no afectadas.
- ✅ No se modifica texto original de reportes.

## Estructura del proyecto

### Documentación
```text
specs/209-log-modal-contraste/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── contracts/
│   └── endpoints.md
└── checklists/
    └── requirements.md
```

### Código (preliminar)
```text
src/components/modules/monitoreo/LogContextoModal.tsx    # único archivo modificado
src/components/modules/monitoreo/LogContextoModal.test.tsx  # test visual opcional
```

## Cambios de código

### 1. Invertir paleta bloque humano
- En `LogContextoModal.tsx` L111-112 (aprox):
  - Reemplazar `bg-tinta/10 p-4 dark:bg-tinta/20` por `bg-tinta/90 p-4 dark:bg-tinta/95`.
  - Reemplazar `text-sm font-medium text-body` por `text-sm font-medium text-fondo`.

### 2. Test visual opcional
- `LogContextoModal.test.tsx`:
  - Renderizar modal con mensaje humano.
  - Verificar que el contenedor tiene clases `bg-tinta/90` y `text-fondo`.

### 3. Screenshot
- Capturar antes/después para `cierre.md`.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Paleta no existe en tema oscuro | Verificar `dark:bg-tinta/95` y `text-fondo` en tokens |
| Test visual frágil | Solo verificar clases, no píxeles |

## Criterios de aceptación técnica

- Gate local completo verde.
- `arch:check` verde.
- Contraste WCAG AA ≥4.5:1 en modo claro y oscuro.
- No tocar schema ni migraciones.
