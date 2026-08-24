# Quickstart: SPEC-222 — Panel principal Análisis (Dinero vs Valor)

## Prerrequisitos

- Rama `work/002-PI-mega-cola-restante` con SPEC-220 (`ScoreCliente` + job de recálculo) y SPEC-221 (`Recomendacion` + worker de reglas) integradas.
- Postgres corriendo (`docker compose up -d db`), `npm install`, `.env` completo.
- Migraciones y seed al día: `npx prisma migrate dev && npx prisma db seed`.

## 1. Sembrar datos de demostración

Con Prisma Studio o un script SQL:

1. 8-10 suscripciones repartidas en ≥2 países y ≥3 ciudades, mezcla `COLEGIO`/`PADRE`, estados variados, algunas con `codigoReferidoUsado`, `esFreemium` y `BonoAplicado`.
2. Pagos `AUTORIZADO` con `montoNetoUSD` variado en los últimos 3 meses.
3. `ScoreCliente` del período actual (`periodo = "YYYY-MM"` Bogotá) con scores que caigan en los 4 cuadrantes; dejar 1-2 suscripciones sin snapshot.
4. 6-7 `Recomendacion` en `PENDIENTE` con prioridades distintas (una expirada).
5. Si SPEC-225 está integrada: 3 `Anomalia` (una por severidad); si no, verificar el estado vacío.

## 2. Levantar la app

```bash
./scripts/dev-restart.sh
```

## 3. Validación manual del panel

Login como `ADMIN` y abrir `http://localhost:5005/dashboard/admin/estadisticas/dinero-vs-valor`.

### 3.1 Navegación

- [ ] El tab "Dinero vs Valor" aparece en el subnav de estadísticas y queda activo.
- [ ] Un usuario no-ADMIN recibe `403` / pantalla de sin acceso.

### 3.2 Top 5 decisiones

- [ ] Se muestran máximo 5 cards ordenadas por prioridad; la expirada no aparece.
- [ ] "Marcar como aplicada" → la card desaparece; en BD la recomendación queda `APLICADA` con `resueltaPorAdminId` y hay fila en `AuditLog`.
- [ ] "Ignorar" → queda `IGNORADA`. Reintentar resolver la misma por curl → `409`.
- [ ] Sin recomendaciones pendientes → estado vacío "Sin decisiones pendientes hoy".

```bash
curl -b cookies.txt -X POST http://localhost:5005/api/admin/analisis/recomendaciones/REC_ID/resolver \
  -H "Content-Type: application/json" -d '{"accion":"APLICADA"}'
```

### 3.3 Matriz de dispersión

- [ ] Cada punto cae en su cuadrante esperado (verificar riesgo = `rubi`, oportunidad = `ambar`, estables = `pino`).
- [ ] Tooltip muestra cliente + monto + score; click navega a `/dashboard/admin/pagos/cliente/[id]`.
- [ ] La nota "N clientes sin score calculado" refleja los fixtures sin snapshot.

### 3.4 Granularidades y drill-down

- [ ] Las 7 granularidades cargan su tabla (País default).
- [ ] Click en país → ciudades con breadcrumb `Todos → <país>`; click en ciudad → colegios; click en colegio → vista cliente.
- [ ] "Padre" muestra el bucket "Sin ciudad" en nivel Ciudad.
- [ ] "Cohorte" agrupa por mes de ingreso Bogotá; "Canal" clasifica con la precedencia documentada.

### 3.5 KPIs y anomalías

- [ ] Los 7 tiles muestran valores y deltas coherentes con el fixture (verificar MRR y churn a mano).
- [ ] Anomalías ordenadas ALTA → MEDIA → BAJA con badges de color; "Revisar" navega al sujeto.
- [ ] Sin modelo `Anomalia` desplegado → estado vacío sin errores en consola.

### 3.6 Filtros persistentes

- [ ] Aplicar período "trimestre" + estado `ACTIVA`, cambiar de granularidad y hacer drill-down: los filtros se conservan y la URL los refleja.

## 4. Gate local

```bash
npx tsc --noEmit && npm run lint -- --no-cache && npm run test:unit && npm run build
npm run arch:check
```

## 5. Checklist rápido de cierre

- [ ] Tab visible solo para ADMIN; proxy actualizado.
- [ ] 6 endpoints responden según `contracts/222-panel-analisis.md`.
- [ ] Top 5 + resolución con `AuditLog` y `409` en doble resolución.
- [ ] Dispersión con 4 cuadrantes y drill a cliente.
- [ ] 7 granularidades + breadcrumb + filtros persistentes.
- [ ] KPIs con deltas en zona Bogotá.
- [ ] Anomalías con degradación elegante.
- [ ] Ningún response incluye texto de reportes ni PII de menores/denunciantes.
- [ ] Tests verdes; `arch:check` verde; `dev-restart.sh` limpio.
