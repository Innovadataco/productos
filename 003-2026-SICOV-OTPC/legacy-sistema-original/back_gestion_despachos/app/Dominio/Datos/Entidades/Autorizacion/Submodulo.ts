import { DateTime } from "luxon"

export class Submodulo {
    public constructor(
        private _id: number,
        private _nombre: string,
        private _nombreMostrar: string,
        private _idModulo: string,
        private _ruta: string,
        private _estado: boolean = true,
        private _creacion: DateTime = DateTime.now(),
        private _actualizacion: DateTime = DateTime.now()
    ){}

    public get id(){
        return this._id
    }

    public get nombre(){
        return this._nombre
    }

    public get nombreMostrar(){
        return this._nombreMostrar
    }

    public get ruta(){
        return this._ruta
    }

    public get idModulo(){
        return this._idModulo
    }

    public get estado(){
        return this._estado
    }

    public get creacion(){
        return this._creacion
    }

    public get actualizacion(){
        return this._actualizacion
    }
}
