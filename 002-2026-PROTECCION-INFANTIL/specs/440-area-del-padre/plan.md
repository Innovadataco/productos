# SPEC-440 · Plan

## Fases (punto 1)

1. Helper `borrador-consulta.ts` (sessionStorage con tolerancia a fallos).
2. `PresentacionUrgenciaForm` guarda en storage y navega sin PII en URL.
3. `SolicitarCitaPanel` lee del storage al montar (sólo si no reasignación) y limpia al POSTear con éxito.
4. `DirectorioProfesionales` / `ProfesionalPerfil` / pages server: quitar props/searchParams que arrastran PII.
5. Candado permanente: ratchet estático que caza cualquier `q.set("pres"|"u")`, `URLSearchParams({ pres|u })`, strings `?pres=`/`?u=`, searchParams tipados. Regresión verificada.

## Fuera de este plan (queda para follow-up)

- P2 Círculo con más de 4.
- P3 Menú lateral en `/mis-reportes`.
- P4 Perfil padre editable (A-67 §59).
- P5 Persistir presentación en el perfil.
