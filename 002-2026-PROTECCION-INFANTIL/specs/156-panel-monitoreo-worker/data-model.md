# Modelo de datos: SPEC-156

## Sin cambios en schema.prisma

No se modifican tablas. Se registra un nuevo módulo en el catálogo de permisos en memoria.

## Entidad de permisos

```ts
{
  clave: "monitoreo_worker",
  nombre: "Monitoreo del worker",
  categoria: "ADMIN",
  esCritico: false,
  orden: number,
}
```

Solo `ADMIN` tendrá grant por defecto.
