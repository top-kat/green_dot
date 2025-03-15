
import mongoose from 'mongoose'

export type GreenDotDbConfig = {
  type: 'mongo',
  name: string,
  // name: string // No need, we will take the name of the folder
  /** Here you can instantiate one or multiple versions of the same database with the same models */
  dbs: DbConfigsObj<any>
}

export type DbConfigsObj<DbIds extends string> = {
  [dbId in DbIds]: MongoConnexionConfig2
}

type MongoConnexionConfig2 = {
  connexionString: string
  mongooseOptions?: mongoose.ConnectOptions
}