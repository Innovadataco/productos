# 008 · INVERSIONES

Seguimiento personal de un portafolio de inversiones: posiciones, costo, dividendos, rentabilidad, reportes por Telegram y web con gráficas. Solo lectura.

- Reglas del repo para las sesiones: [AGENTS.md](AGENTS.md).
- CI: [`.github/workflows/inv.yml`](../.github/workflows/inv.yml) (check `inv-gate`).

## Arranque local
```bash
cd 008-2026-INVERSIONES
cp .env.example .env
npm ci
npm run db:up          # PostgreSQL 16 en el puerto 5438 (docker compose)
npx prisma migrate deploy
npm run dev            # http://localhost:5008 · salud en /api/salud
```

Este repo es público: aquí no hay datos reales. Los datos de prueba están inventados y marcados `.ficticio.`.
