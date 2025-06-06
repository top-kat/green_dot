
import { Definition, InferTypeRead, InferTypeWrite, GoodCopNextDefinition } from '../../lib/good-cop/index-backend.js'
import { getMainConfig } from '../../helpers/getGreenDotConfigs.js'
import { _ } from '../../validator.js'
import { _ as fixRecursiveType } from '../../lib/good-cop/index-backend.js'
import { GD_deviceModel } from './GD_device.model.js'
import { ModelsWithDbNamesAndReadWrite } from '../../cache/dbs/index.generated.js'


export const userLockReasons = ['tooMuchPasswordAttempts', 'ban', 'tooManyAttempsForSecureAuthentication'] as const
export type UserLockReasonsDefault = typeof userLockReasons[number]

export function getUserDefaultAdditionalFields({ silent = false } = {}) {


  const mainConfig = getMainConfig(silent)

  // FIX a type recursively reference itself problem
  type RecursiveTypeFixType = { Read: typeof GD_deviceModel.tsTypeRead, Write: typeof GD_deviceModel.tsTypeWrite }
  const def = _.ref('GD_device') as GoodCopNextDefinition<
    Definition<ModelsWithDbNamesAndReadWrite, RecursiveTypeFixType | string, string>
  >

  const defaultAdditionalFields = {
    /** Ability to lock a user for a time after nb of password retrial */
    lockedReason: fixRecursiveType.enum([...(mainConfig?.userLockReasons || []), ...userLockReasons] as const),
    lockUntil: fixRecursiveType.date(),
    devices: [def],
  }

  return defaultAdditionalFields
}


// TO BE AUGMENTED BY PLUGINS
export interface UserAdditionalFieldsRead extends InferTypeRead<ReturnType<typeof getUserDefaultAdditionalFields>> { }
export interface UserAdditionalFieldsWrite extends InferTypeWrite<ReturnType<typeof getUserDefaultAdditionalFields>> { }
export type UserAdditionalFields = UserAdditionalFieldsRead