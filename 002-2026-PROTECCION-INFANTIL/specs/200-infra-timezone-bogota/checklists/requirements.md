# Checklist de requisitos: SPEC-200 — INFRA · Timezone Bogotá (002-PI-097)

- [ ] `docker-compose.prod.yml` declara `TZ: America/Bogota` en `app`, `worker`, `monitor` y `simulador-abuso`.
- [ ] `package.json` incluye `date-fns` y `date-fns-tz` en `dependencies`.
- [ ] `package-lock.json` actualizado tras `npm install`.
- [ ] `prisma/schema.prisma` usa `@db.Timestamptz(6)` en todos los `DateTime` de momento.
- [ ] Campos `@db.Date` (p. ej. `RegistroAvisoColegio.dia`) no se modifican.
- [ ] Migración aditiva `add_timestamptz_bogota` generada y aplicable sin pérdida de datos.
- [ ] `src/lib/colegio/fechas-humano.ts` usa `date-fns-tz` con `America/Bogota`.
- [ ] `src/lib/colegio/fechas-humano.test.ts` incluye tests a 23:59 y 00:01 Bogotá.
- [ ] Todos los `toLocaleString`/`toLocaleDateString`/`toLocaleTimeString`/`Intl.DateTimeFormat` en `src/` incluyen `timeZone: "America/Bogota"` o justificación documentada.
- [ ] Aritmética de días en `src/lib/apelaciones.ts` y otros módulos críticos usa `date-fns-tz`/`America/Bogota`.
- [ ] No se tocó `src/lib/ai/**`.
- [ ] `SHOW TIME ZONE` de Postgres sigue siendo `Etc/UTC`.
- [ ] CI verde 6/6.
