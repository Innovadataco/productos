
import { TblProveedoresVigilados } from "App/Infraestructura/Datos/Entidad/ProveedoresVigilado";
import TblUsuarios from "App/Infraestructura/Datos/Entidad/Usuario";
import { v4 as uuid } from "uuid";
import { RepositorioProveedorVigilado } from 'App/Dominio/Repositorios/RepositorioProveedorVigilado';
import axios from "axios";

export class RepositorioProveedorVigiladoDB implements RepositorioProveedorVigilado {
  private urlDespachos: string = process.env.URL_DESPACHOS || '';

  async obtenerEmpresas(): Promise<any[]> {
    try {
      const usuariosEmpresa = await TblUsuarios.query().where({
        idRol: 5,
        estado: true,
      });
      console.log({ usuariosEmpresa });

      return usuariosEmpresa.map((usuario) => {
        return {
          idEmpresa: usuario.usuario,
          nombre: usuario.nombre,
        };
      });
    } catch (error) {
      throw new Error(`Se presento un error durante la consulta`);
    }
  }

  async obtenerSeleccionadas(documento: string): Promise<any[]> {

    const empresas: any[] = [];
    try {


      const respuesta = await axios.get(`${this.urlDespachos}/proveedorvigilado/seleccionadas?nit=${documento}`, {});
      return respuesta.data;


      return empresas;
    } catch (error) {
      console.log(error);

      throw new Error(`Se presento un error durante la consulta  ${error}`);
    }
  }

  async asignar(idVigilado: string, params: any): Promise<any> {

    try {


      const empresas = await axios.post(`${this.urlDespachos}/proveedorvigilado/asignar`, params).then(async resp => {
        if (resp.data.status == 202) {
          return {
            "status": 400,
            "titulo": "Asignación fallida",
            "mensajes": resp.data.mensajes,
            "array_data": {}
          }
        } if (resp.data.status == 200) {

          const usuario = await TblUsuarios.query().where('identificacion', idVigilado).first();
          console.log({usuario});

          if (usuario?.idRol === 3) {
            console.log("Entro");

            const data = resp.data.array_data;
            const empresaVigilado = new TblProveedoresVigilados();
            empresaVigilado.idEmpresa = data.id_empresa;
            empresaVigilado.idVigilado = data.id_vigilado;
            empresaVigilado.token = data.token;
            empresaVigilado.estado = true;
            empresaVigilado.fechaInicial = data.fecha_inicial;
            empresaVigilado.fechaFinal = data.fecha_final;
            empresaVigilado.documento = data.documento ?? '';
            empresaVigilado.ruta = data.ruta ?? '';
            empresaVigilado.nombreOriginal = data.nombre_original ?? '';
            empresaVigilado.creacion = data.creacion;
            await empresaVigilado.save();

          }


          return resp.data


        }
      }).catch(err => {
        if (err.response?.data) {
          return err.response.data
        } else {
          return `Fallo el inicio de sesión - consulte con el administrador`

        }

      })


      return empresas;

    } catch (error) {
      console.log(error);

      throw new Error(`Se presento un error durante la consulta`);
    }
  }

  async editar(documento: string, params: any): Promise<any> {
    // Mantener coherencia con 'asignar': llamar servicio externo y reflejar en BD
    try {
      const respuesta = await axios
        .post(`${this.urlDespachos}/proveedorvigilado/editar`, params)
        .then(async (resp) => {
          if (resp.data.status == 202) {
            return {
              status: 400,
              titulo: 'Edición fallida',
              mensajes: resp.data.mensajes,
              array_data: {},
            };
          }

          if (resp.data.status == 200) {
            const data = resp.data.array_data;

            const usuario = await TblUsuarios.query().where('identificacion', documento).first();
            if (usuario?.idRol === 3) {

              // Buscar registro existente y actualizarlo; si no existe, crearlo
              let empresaVigilado = await TblProveedoresVigilados.query()
                .where({ tpv_empresa: data.id_empresa, tpv_vigilado: data.id_vigilado })
                .first();

              if (!empresaVigilado) {
                empresaVigilado = new TblProveedoresVigilados();
              }


              empresaVigilado.idEmpresa = data.id_empresa;
              empresaVigilado.idVigilado = data.id_vigilado;
              empresaVigilado.token = data.token;
              empresaVigilado.estado = true;
              empresaVigilado.fechaInicial = data.fecha_inicial;
              empresaVigilado.fechaFinal = data.fecha_final;
              empresaVigilado.documento = data.documento ?? '';
              empresaVigilado.ruta = data.ruta ?? '';
              empresaVigilado.nombreOriginal = data.nombre_original ?? '';
              empresaVigilado.creacion = data.creacion;
              await empresaVigilado.save();
            }
            return resp.data;
          }
        })
        .catch((err) => {
          console.log(err);

          if (err.response?.data) {
            return err.response.data;
          } else {
            return `Fallo la edición - consulte con el administrador`;
          }
        });

      return respuesta;
    } catch (error) {
      console.log(error);
      throw new Error(`Se presento un error durante la consulta`);
    }
  }

  async activar(documento: string, params: any): Promise<any> {
    // Alinear con "asignar" y "editar": activar vía servicio externo y sincronizar BD
    try {
      const respuesta = await axios
        .post(`${this.urlDespachos}/proveedorvigilado/activar`, params)
        .then(async (resp) => {
          if (resp.data.status == 202) {
            return {
              status: 400,
              titulo: 'Activación fallida',
              mensajes: resp.data.mensajes,
              array_data: {},
            };
          }


          if (resp.data.status == 200) {
            const data = resp.data.array_data;
            const usuario = await TblUsuarios.query().where('identificacion', documento).first();
            if (usuario?.idRol === 3) {
              // Buscamos la relación y actualizamos estado/token/fechas según datos recibidos
              let empresaVigilado = await TblProveedoresVigilados.query()
                .where({ tpv_empresa: data.id_empresa, tpv_vigilado: data.id_vigilado })
                .first();

              if (!empresaVigilado) {
                empresaVigilado = new TblProveedoresVigilados();
              }

              empresaVigilado.estado = data.estado;
              empresaVigilado.actualizacion = data.actualizacion ?? '';
              await empresaVigilado.save();
            }
            return resp.data;
          }
        })
        .catch((err) => {
          if (err.response?.data) {
            return err.response.data;
          } else {
            return `Fallo la activación - consulte con el administrador`;
          }
        });

      return respuesta;
    } catch (error) {
      console.log(error);
      throw new Error(`Se presento un error durante la consulta`);
    }
  }


  async asignarProveedor(params: any): Promise<any[]> {
    const { empresa, proveedor, terminal } = params;
    try {
      //Verificar si exite la relacion
      const existe = await TblProveedoresVigilados.query().where({
        tpv_empresa: empresa,
        tpv_vigilado: proveedor,
      });
      if (existe.length >= 1) {
        return [{ mensaje: "ya existe un registro con esta empresa", estado: false }];
      }

      // Crear el nuevo registro
      const { DateTime } = require('luxon');
      const offsetHours = parseInt(process.env.TIMEZONE_OFFSET_HOURS || '5');
      const fechaCreacion = DateTime.fromJSDate(new Date(Date.now() - (offsetHours * 60 * 60 * 1000)));

      const empresaVigilado = new TblProveedoresVigilados();
      empresaVigilado.idEmpresa = empresa;
      empresaVigilado.idVigilado = proveedor;
      empresaVigilado.token = uuid();
      empresaVigilado.estado = true;
      empresaVigilado.fechaInicial = new Date('2025-01-01');
      empresaVigilado.fechaFinal = new Date('2027-12-31');
      empresaVigilado.creacion = fechaCreacion;
      await empresaVigilado.save();

      return this.obtenerSeleccionadasProveedor(proveedor);
    } catch (error) {
      console.log(error);

      throw new Error(`Se presento un error durante la consulta`);
    }
  }


  async obtenerSeleccionadasProveedor(documento: string): Promise<any[]> {
    try {
      const empresas: any[] = [];
      const empresasSeleccionadas = await TblProveedoresVigilados.query()
        .where("tpv_empresa", documento)
        .orderBy("tpv_id", "desc");


      empresasSeleccionadas.map((empresa) => {
        empresas.push({
          proveedor: empresa.idEmpresa ?? '',
          token: empresa.token ?? '',
          estado: empresa.estado ?? '',
        })

      });
      return empresas;
    } catch (error) {
      throw new Error(`Se presento un error durante la consulta  ${error}`);
    }
  }
}
