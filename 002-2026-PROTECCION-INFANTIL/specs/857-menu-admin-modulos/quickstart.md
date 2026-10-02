# Quickstart · SPEC-857 (recorrido de validación)

1. Entrar como ADMIN con todos los módulos. En el lateral de escritorio (≥ sm):
   - Ver los 9 MÓDULOS (Reportes, Comité de Convivencia, Operadores, Verificación, Motor IA, Pagos, Usuarios, Estadísticas, Configuración) y las hojas sueltas (Inicio, Sesiones, Reubicaciones, Profesionales, Verificadores, Padres, Colegios, Soporte).
   - Ver los dos ENCABEZADOS de sección «Citas y profesionales» y «Directorio» como rótulos tenues, **no clicables**.
   - Los módulos nacen **colapsados**; al entrar a una ruta de un módulo, ese módulo nace **abierto** y su hoja activa queda marcada.
   - El módulo **Pagos** (encabezado e hijos) va en **ámbar**.
2. Navegar a `/dashboard/admin/comite/gestion`: se marca la hoja «Gestión» (no «Bandeja»), dentro del grupo «Comité de Convivencia» abierto.
3. Navegar a `/dashboard/admin/pagos/pendientes`: la hoja «Pendientes» queda activa en ámbar.
4. Entrar como ADMIN con un solo módulo (p. ej. `bandeja_reportes`): solo aparece «Inicio» (si tiene `inicio_admin`) y el módulo «Reportes» con su hoja «Bandeja de reportes»; **ningún encabezado huérfano**.
5. Abrir `/dashboard/admin` directo: redirige a una hoja real accesible (nunca a `#`).
6. Móvil (< sm): la barra inferior muestra ≤4 pestañas con íconos distintos; «Más» abre el resto (los módulos como secciones).

## Comandos

```bash
npm run arch:check
node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run src/components/modules/nav/nav-iconos.candado.test.tsx src/components/modules/nav/nav-lateral.candado.test.tsx src/components/modules/nav/nav-movil.candado.test.tsx
./scripts/dev-restart.sh
```
