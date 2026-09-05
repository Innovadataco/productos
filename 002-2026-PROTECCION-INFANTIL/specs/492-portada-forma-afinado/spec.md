# SPEC-492 · Afinado de forma de la portada (radio, titular fluido, estados de la consulta)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: PI-1 (`idc-32`) · **Origen**: auditoría de FORMA de Diseño (portada). Afinado (MEDIO/BAJO), no defecto.

## El arreglo (`LandingHero.tsx`)
1. **Radio por token** (:108): `rounded-[2rem]` (32px arbitrario) → `rounded-[var(--radio-hero)]` (22px).
2. **Skeleton, nunca spinner (§4.8)** (:193): el loading de la consulta era `animate-spin` → barra liviana `animate-pulse` (skeleton) sobre el degradado del hero.
3. **Titular fluido (§4.1)** (:122): `text-4xl sm:text-5xl lg:text-6xl` → clase `titular-estado` (clamp(38px,6.4vw,70px), serif + tracking del sistema).

## Candado — `src/components/modules/portada-forma.candado.test.ts`
- 0 `rounded-[<literal>]` suelto (se permite `rounded-[var(--…)]`); 0 `animate-spin`; titular con `titular-estado`, sin `text-4xl/5xl/6xl`. Muere por mutación.

## Impacto en arquitectura:
- La portada usa el radio y la escala tipográfica por token; el loading sigue la regla «skeleton, nunca spinner». Sin conducta (la consulta consulta igual).

## Referencias
SPEC-456 (portada voz/tokens). Rama del lote desde `origin/main 94c0e8c8c`.
