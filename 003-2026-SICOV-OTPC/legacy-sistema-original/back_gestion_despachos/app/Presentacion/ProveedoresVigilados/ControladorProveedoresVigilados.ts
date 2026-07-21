import type { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import { ServicioProveedorVigilado } from "App/Dominio/Datos/Servicios/ServicioProveedorVigilado";
import { RepositorioProveedorVigiladoDB } from "App/Infraestructura/Implementacion/Lucid/RepositorioEmpresaVigiladoDB";

export default class ControladorProveedoresVigilados {
  private service: ServicioProveedorVigilado;
  constructor() {
    this.service = new ServicioProveedorVigilado(
      new RepositorioProveedorVigiladoDB()
    );
  }

  public async listar({ request, response }: HttpContextContract) {
    const empresas = await this.service.obtenerEmpresas();
    return response.status(200).send(empresas);
  }

  public async seleccionadas({ request, response }: HttpContextContract) {
    const {nit} = request.all();
    const empresas = await this.service.obtenerSeleccionadas(nit);
    return response.status(200).send(empresas);
  }

  public async asignar({request, response}: HttpContextContract) {
    const {nit} = request.all();
    const {idEmpresa,fechaInicial,fechaFinal} = request.all()
    if (!idEmpresa || !fechaInicial || !fechaFinal) {
      return response.status(400).send("Todos los campos son necesarios");
    }


      const empresas = await this.service.asignar(nit, request.all());
    return response.status(200).send(empresas);
  }

  public async editar({request, response}: HttpContextContract) {
    const {nit} = request.all();
    const empresas = await this.service.editar(nit, request.all());
    return response.status(200).send(empresas);
  }

  public async activar({request, response}: HttpContextContract) {
    const {nit} = request.all();
    const empresas = await this.service.activar(nit, request.all());
    return response.status(200).send(empresas);
  }

    public async asignarProveedor({request, response}: HttpContextContract) {
    const {empresa,proveedor} = request.all()
    if (!empresa || !proveedor ) {
      return response.status(400).send("Los campos empresa y proveedor son necesarios");
    }

    //devolver

      const empresas = await this.service.asignarProveedor(request.all());

   /*    if(!empresas[0]?.estado){
        return response.status(400).send({mensaje:empresas[0].mensaje});
      } */
    return response.status(200).send(empresas);
  }

}
