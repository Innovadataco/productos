# Quickstart: SPEC-143 — Verificación manual de la home del rector

**Spec**: [../spec.md](../spec.md) · Ejecutar tras implementar, antes del PR.

## 1. Seed de escenario

Con la app levantada (`./scripts/dev-restart.sh`) y dos colegios (A con datos, B
vacío): en A crear 2 cursos, 10 estudiantes (7 con identificador, 5 con acudiente),
1 profesor titular asignado, y alertas de distintas edades (hoy, hace 3 días, hace
20 días, hace 2 meses).

## 2. La home en 30 segundos (US1/US2)

```bash
open http://localhost:5005/dashboard/colegio   # sesión SCHOOL_ADMIN de A
```

✔ Saludo con nombre + fecha en español · declaración con palabra en cursiva serif y
color del estado · luz ambiental del estado · punto con pulso 3,4 s.
✔ KPIs: 10 estudiantes · 2 cursos · 1 profesor · reportes del mes/semana con delta.
✔ Anillos: 70% vigilancia, 50% reacción; centro "10 estudiantes"; leyenda "3
estudiantes sin redes registradas" y "5 sin acudiente a quien llamar".
✔ Franja: última señal relativa ("hace N minutos/días") + reportes de la semana.
✔ Tendencia: toggle semanal/mensual/anual repinta SIN refetch (Network en DevTools).
✔ Cursos que merecen mirada: top por actividad 30d con titular; enlace al curso.
✔ Acciones rápidas + CanalesOficiales al final. CERO palabra "alumno" ni "gestión".

## 3. Estados del semáforo (D1)

- Sin alertas nuevas ni en 7 días → pino (*tranquilos*).
- Crear alerta "nueva" (reporte visible sobre identificador de A) → rubí, luz rubí,
  palabra *necesita que actúes hoy*.

## 4. Tenant A/B (SC-001)

Sesión del colegio B (vacío): ve el empty state §5.2 (no datos de A). Ningún número
de A aparece en B ni a la inversa.

## 5. Empty state (US4)

Colegio B: hero "Tu colegio está listo para empezar" + CTA "Crear primer curso" →
`/dashboard/colegio/cursos/nuevo` + enlace "¿Ya tienes tu lista en Excel?" → carga.

## 6. Accesibilidad y movimiento

- Navegación completa por teclado, foco visible, tap targets ≥ 48px.
- DevTools → Emulate `prefers-reduced-motion: reduce` → TODO quieto (sin dibujo de
  anillos, sin pulso, sin entradas).
- Lighthouse mobile (Perf + A11y ≥ 90) en `/dashboard/colegio`.

## 7. Ratchet y gate

```bash
npm run tokens:check   # ≤ 1166 (el código nuevo es 100% tokens)
npx tsc --noEmit && npm run lint && npm run test:coverage && npm run build && npm run arch:check
./scripts/dev-restart.sh
```
