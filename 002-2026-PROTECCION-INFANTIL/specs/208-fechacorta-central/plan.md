# Plan de implementación: SPEC-208 — fechaCorta helper central + timezone Bogotá (002-PI-141)

## Resumen

Centralizar helper de formato de fechas en `src/lib/format/fecha.ts` con timezone `America/Bogota` y reemplazar las copias dispersas en componentes de detalle de usuario. Cierra I-106.

## Contexto técnico

- Next.js 16.2.10 App Router, React 19.
- TypeScript 5 strict.
- Tailwind + componentes en `src/components/` y `src/app/`.
- Tests con Vitest.

## Constitution Check

- ✅ Sin multimedia.
- ✅ Presunción de inocencia no aplica (formato de fecha).
- ✅ IA local no se toca.
- ✅ Canales oficiales no afectados.
- ✅ Disputas no afectadas.
- ✅ No se modifica texto original de reportes.

## Estructura del proyecto

### Documentación
```text
specs/208-fechacorta-central/
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
src/lib/format/fecha.ts                     # helper central
src/lib/format/fecha.test.ts                # tests unitarios
src/app/dashboard/admin/usuarios/[id]/components/Detalle*.tsx   # migrar
src/app/dashboard/admin/padres/PadresPageClient.tsx             # migrar
src/app/dashboard/admin/comite/apelaciones/ApelacionesBandejaClient.tsx  # migrar
```

## Cambios de código

### 1. Helper central
- Crear `src/lib/format/fecha.ts`:
  - `fechaCorta(iso)` → `new Intl.DateTimeFormat("es-CO", { day:"numeric", month:"short", year:"numeric", timeZone:"America/Bogota" }).format(...)`.
  - `fechaHora(iso)` → igual + `hour:"2-digit", minute:"2-digit"`.
  - `fechaISO(iso)` → `yyyy-MM-dd` para atributos `datetime`.
  - Todas validan input y devuelven `"—"`.

### 2. Migrar copias
- Reemplazar helpers locales `fechaCorta` en:
  - `src/app/dashboard/admin/usuarios/[id]/components/DetalleAdmin.tsx`
  - `src/app/dashboard/admin/usuarios/[id]/components/DetalleComiteConvivencia.tsx`
  - `src/app/dashboard/admin/usuarios/[id]/components/DetalleComiteValidacion.tsx`
  - `src/app/dashboard/admin/usuarios/[id]/components/DetalleOperador.tsx`
  - `src/app/dashboard/admin/usuarios/[id]/components/DetallePadre.tsx`
  - `src/app/dashboard/admin/usuarios/[id]/components/DetalleRector.tsx`
  - `src/app/dashboard/admin/padres/PadresPageClient.tsx`
  - `src/app/dashboard/admin/comite/apelaciones/ApelacionesBandejaClient.tsx`
- Otros detectados por `grep -rn "function fechaCorta" src/app/ src/components/`.

### 3. Revisar `toLocaleDateString.*es-CO`
- `grep -rn "toLocaleDateString.*es-CO" src/`
- Migrar los que estén dentro del alcance (detalle usuarios y sitios del brief); dejar fuera de alcance documentados.

### 4. Tests
- `src/lib/format/fecha.test.ts`:
  - null/undefined/inválido → `"—"`.
  - fecha válida → formato esperado + TZ Bogotá.
  - `fechaHora` incluye hora.
  - `fechaISO` devuelve `yyyy-MM-dd`.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| SSR no soporta Intl igual que cliente | Usar `Intl.DateTimeFormat` (universal en Node 22) |
| Fechas mostradas cambian visualmente | Verificar con snapshots manuales; TZ Bogotá es el comportamiento deseado |

## Criterios de aceptación técnica

- Gate local completo verde.
- `arch:check` verde.
- `grep -rn "function fechaCorta" src/app/ src/components/` → cero fuera de helper.
- `grep -rn "toLocaleDateString.*es-CO" src/` → solo helper o excepciones justificadas.
- No tocar schema ni migraciones.
