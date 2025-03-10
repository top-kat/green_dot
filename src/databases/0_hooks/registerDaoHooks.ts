

import { MongoDaoParsed, MongoDao, daoHookNamesMongo, DaoHookNamesMongo } from '../mongo/types/mongoDbTypes'
import { genericHookInterpreter } from './hookInterpreterGeneric'
import defaultDaoConfigMongo from '../mongo/defaultDaoConfigMongo'

import { includes, objKeys } from 'topkat-utils'

/** This function will return all dao hooks parsed with default values */
export function registerDaoHooks(
    modelName: string,
    hooksObj: MongoDao<any> | MongoDaoParsed<any> = defaultDaoConfigMongo
): MongoDaoParsed<any> {

    for (const hookName of objKeys(hooksObj)) {
        if (includes(daoHookNamesMongo, hookName)) {
            const hookObjArr = hooksObj[hookName]!
            for (const [hookIndex, hookRaw] of Object.entries(hookObjArr)) {
                const newHook = genericHookInterpreter(modelName, parseInt(hookIndex), hookName as DaoHookNamesMongo, hookRaw)
                hooksObj[hookName]![hookIndex] = newHook
            }
            // sort by order
            hooksObj[hookName as DaoHookNamesMongo]!
                .reverse() // allow hooks with no order to be sorted in natural order
                .sort((a, b) => a.order - b.order)
        }
    }
    return hooksObj as MongoDaoParsed<any>
}