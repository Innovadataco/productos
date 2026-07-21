export function despachoToDto(despacho: any) {
  if (!despacho) return null;
  const plain = despacho.toJSON ? despacho.toJSON() : despacho;

  // Helper para limpiar entidades relacionadas
  const clean = (obj: any, exclude: string[] = []) => {
    if (!obj) return null;
    const result: any = {};
    for (const key in obj) {
      if (
        key !== 'fechaCreacion' &&
        key !== 'fechaActualizacion' &&
        key !== 'estado' &&
        !exclude.includes(key)
      ) {
        result[key] = obj[key];
      }
    }
    return result;
  };

  return {
    ...clean(plain),
    ruta: clean(plain.ruta),
    vehiculo: clean(plain.vehiculo),
    conductor: clean(plain.conductor),
    autorizacion: clean(plain.autorizacion),
    novedades: plain.novedades ? plain.novedades.map((novedad: any) => ({
      ...clean(novedad),
    //  novedades_vehiculos: novedad.novedades_vehiculos ? novedad.novedades_vehiculos.map((nv: any) => clean(nv)) : [],
    //  novedades_conductores: novedad.novedades_conductores ? novedad.novedades_conductores.map((nc: any) => clean(nc)) : [],
    })) : [],
    llegadas: plain.llegadas ? plain.llegadas.map((llegada: any) => ({
      ...clean(llegada),
    //  llegadas_vehiculo: clean(llegada.llegadas_vehiculo),
    //  llegadas_conductor: llegada.llegadas_conductor ? llegada.llegadas_conductor.map((conductor: any) => clean(conductor)) : [],
    })) : [],
  };
}
