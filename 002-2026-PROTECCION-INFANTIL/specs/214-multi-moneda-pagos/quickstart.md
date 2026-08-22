# Quickstart · SPEC-214 · Multi-moneda + API tasas

## Prerrequisitos

- SPEC-210 aplicada.
- BD migrada y seed ejecutado.

## Verificación local

1. Ejecutar worker de tasas manualmente:
   ```bash
   npm run worker:tasas
   ```
2. Verificar en BD que existan filas `TasaCambio` con `fuente=API` para COP, MXN, CLP, ARS.
3. Login como ADMIN y navegar a `/dashboard/admin/pagos/tasas`.
4. Inyectar tasa manual para una moneda; verificar `AuditLog`.
5. Simular API caída (desconectar internet o cambiar URL a inválida) y correr worker; verificar que no borra histórico y que el banner aparece si la última tasa >48h.
6. Llamar `calcularMontoLocal(100, 'COP')` y verificar monto local = 100 × tasa vigente.

## Comandos

```bash
npm run worker:tasas        # refresco manual
npm run test:integration    # valida endpoints y worker
npm run build               # build de producción
```
