
import mongoose from 'mongoose'
import { error } from '../../error.js'
import { mongoCreateDao } from './mongoCreateDao.js'
import { MongoDbConfigModels, MongoDbConfig, DbConfigsObj } from '../../types/core.types.js'
import { MongoDaoParsed, DaoMethodsMongo } from './types/mongoDbTypes.js'
import { C, ENV, objEntries } from 'topkat-utils'
import { luigi } from '../../cli/helpers/luigi.bot.js'
import { event } from '../../event.js'
import type { AllDbIds, DbIds } from '../../cache/dbs/index.generated.js'
import { newSystemCtx } from '../../ctx.js'
import type { Definition } from '../../lib/good-cop//DefinitionClass.js'

const { NODE_ENV } = ENV()
const env: Env = NODE_ENV

declare global {
    interface GDeventNames extends NewEventType<'database.connected', []> { }
}

type ErrParams = Parameters<typeof error.serverError>

export type ModelAdditionalFields = {
    /** Will init a mongoose session and start a mongo transaction, the session is then stored in the ctx
    so all next DB calls are automatically using the transaction. So you'll have nothing to do except ending
    the transaction, which will trigger an admin alert if not closed for 30 seconds
    * * Make sure you await it
    */
    startTransaction(ctx: Ctx): Promise<void>, // mongoose.mongo.ClientSession could be returned but it's of no use and can be misleading
    /** You have to call it after starting a transaction whenever the transaction is success or
    in a try / catch block to undo the transaction
    * * The endTransaction will take care of transactionCommit() or transactionAbort() depending on the status
    * * Make sure you await it
    */
    endTransaction(ctx: Ctx, status: 'success'): Promise<void>,
    endTransaction(ctx: Ctx, status: 'error', errMsg: ErrParams[0], errOptions: ErrParams[1]): Promise<void>,
    endTransaction(ctx: Ctx, status: 'error', errMsg: false): Promise<void>,
    mongooseConnection: mongoose.Connection
    mongooseModels: { [modelNames: string]: mongoose.Model<any> }
}

export type ModelsConfigCache<AllModels extends Record<string, any> = any> = {
    [dbId: string]: {
        db: {
            [ModelName in keyof AllModels]: DaoMethodsMongo<AllModels[ModelName]>
        } & ModelAdditionalFields
        dbConfigs: MongoDbConfig
    }
}

let nbDatabaseConnected = 0
let nbDatabaseTotal = 0
let displayConnexionWarning1 = true
let displayConnexionWarning2 = true

export async function mongoInitDb(
    dbName: keyof DbIds,
    dbId: AllDbIds,
    modelsConfigCache: ModelsConfigCache,
    connectionConfig: Omit<DbConfigsObj, 'connexionString'> & { connexionString: string },
    daoConfigsParsed: { [k: string]: MongoDaoParsed<any> },
    modelsGenerated: { [modelName: string]: Definition<any, 'def', 'def', false> }
) {

    nbDatabaseTotal++

    const { connexionString, mongooseOptions = {} } = connectionConfig


    const isLocalDb = connexionString.includes('127.0.0.1') || connexionString.includes('localhost')
    const hasNoReplicaSet = isLocalDb && !connexionString.includes('replicaSet')

    //----------------------------------------
    // MONGO SETUP AND CONNEXION
    //----------------------------------------

    mongooseOptions.connectTimeoutMS ??= env !== 'production' && env !== 'preprod' ? env === 'build' ? 2147483647 : 30000 : 1000 * 60 * 7 // avoid error when setting a breakpoint
    const mongooseConnection = mongoose.createConnection(connexionString, mongooseOptions)

    setTimeout(() => {
        if (displayConnexionWarning1) {
            luigi.warn(`Loading database for 5.000.000.000 nanoseconds...\n\nHave you started your db ?`)
            displayConnexionWarning1 = false
        }
    }, 5000)

    setTimeout(() => {
        if (displayConnexionWarning2) {
            luigi.warn(`🔮 blip...bloup...checking my crystal ball...Mmmh....I feel a database connexion error will throw soon...`)
            displayConnexionWarning2 = false
        }
    }, 20000)

    mongooseConnection.on('error', err => {
        const lessVerboseErr = { message: err?.message }
        if (env !== 'build') {
            error.serverError(`mongoDatabaseConnexionError`, { err: lessVerboseErr, dbId, dbName })
            C.log('\n\n')
            luigi.say([
                `Senior advice here => please check that you have a database running at ${connexionString.replace(/:[^@]+@/, '****************')}.\nTips: Use 'run-rs' npm package to easily start mongoDb with replica sets locally.\n\n`,
                `Blip..bloup... There is 94% chances that you forget to start your database.\nPlease check that you have a database running at ${connexionString.replace(/:[^@]+@/, '****************')}.\nTips: Use 'run-rs' npm package to easily start mongoDb with replica sets locally.\n\n`,
            ])
        }
    })

    mongooseConnection.on('connected', () => {
        C.log(C.primary(`✓ DB connected: ${dbId} > ${connexionString.includes('127.0.0') ? 'localhost' : connexionString?.split('@')?.[1]}${connexionString.replace(/^.*(\/[^/]+)$/, '$1').replace(/\?[^?]+$/, '')}`))
        nbDatabaseConnected++
        if (nbDatabaseConnected >= nbDatabaseTotal) {
            displayConnexionWarning1 = false
            displayConnexionWarning2 = false
            event.emit('database.connected', newSystemCtx())
        }

    })

    const schemas = {} as { [k in AllDbIds]: mongoose.Schema }
    const mongooseModels = {} as { [k in AllDbIds]: mongoose.Model<any> }
    const typedDatabase = {} as { [k in AllDbIds]: Awaited<ReturnType<typeof mongoCreateDao>> }
    const dbConfs: MongoDbConfigModels = {}

    for (const [modelName, models] of objEntries(modelsGenerated)) {
        //----------------------------------------
        // SETUP SCHEMAS
        //----------------------------------------
        schemas[modelName] = new mongoose.Schema(models._getMongoType())
        if (process.env.NODE_ENV !== 'build') mongooseModels[modelName] = mongooseConnection.model(modelName, schemas[modelName]) as any

        //----------------------------------------
        // BUILD DAO
        //----------------------------------------
        typedDatabase[modelName] = await mongoCreateDao(mongooseModels[modelName], dbId, dbName, modelName as any)

        //----------------------------------------
        // BUILD DB CONFIGS
        //----------------------------------------
        dbConfs[modelName] = {
            model: modelsGenerated[modelName],
            dao: typedDatabase[modelName],
            daoConfig: daoConfigsParsed[modelName],
        }
    }


    modelsConfigCache[dbId] ??= {} as ModelsConfigCache[string]
    modelsConfigCache[dbId].dbConfigs = {
        dbType: 'mongo',
        models: dbConfs,
        mongooseConnection,
        schemas,
        mongooseModels,
        daoConfigsParsed,
    } satisfies Omit<MongoDbConfig, 'modelTypeFile'>

    const modelAdditionalFields: ModelAdditionalFields = {
        startTransaction: async ctx => {
            if (hasNoReplicaSet) {
                if (ctx.env !== 'development') {
                    throw ctx.error.serverError('cannotRunAtransactionWithNoReplicaSetInDatabase')
                } else {
                    return C.warning('!!WARNING!! ReplicaSet not activated. Please use `run-rs -v 4.0.0 --shell -h 127.0.0.1` to start the database in local')
                }
            }
            if (ctx.transactionSession) throw ctx.error.serverError('mongooseTransactionAlreadyInProgressWithSameCtx')
            const session = await mongooseConnection.startSession()
            ctx.transactionSession = session
            setTimeout(() => {
                // if a transaction is taking too much time to process, we alert the administrators
                // we don't throw since it's probably a sensitive operation in progress and we don't
                // want to mess it up
                if (ctx.transactionSession) ctx.error.serverError('mongooseTransactionTimeout')
            }, 30 * 1000)
            await session.startTransaction()
        },
        endTransaction: async (ctx, status = 'success', ...params) => {
            if (!ctx.transactionSession) {
                const [errMsg, errOptions = {}] = params as ErrParams
                ctx.error.serverError(errMsg, errOptions)
                throw ctx.error.serverError('mongooseTransactionNotStarted', { additionalInfos: `This can be because you ended transaction twice (if you are in a try catch check that you don't have ended in the body and in the catch clause` })
            }
            const session = ctx.transactionSession
            delete ctx.transactionSession
            if (hasNoReplicaSet) return
            if (status === 'error') {
                await session.abortTransaction()
                await session.endSession()
                const [errMsg, errOptions = {}] = params as ErrParams
                throw ctx.error.serverError(errMsg, errOptions)
            } else {
                await session.commitTransaction()
                await session.endSession()
            }
        },
        mongooseConnection,
        mongooseModels,
    }

    modelsConfigCache[dbId].db = {
        ...typedDatabase,
        ...modelAdditionalFields as any,
    }
}