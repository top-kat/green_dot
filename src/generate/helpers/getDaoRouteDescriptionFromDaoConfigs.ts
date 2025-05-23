

import { RouteFromDaoConfigForGenerateSdk } from '../../types/core.types'

import { getApiEndpointsPerRolesFromDao } from '../../databases/helpers/getApiEndpointsPerRolesFromDao'
import { objEntries, pushIfNotExist } from 'topkat-utils'
import { getMainConfig } from '../../helpers/getGreenDotConfigs'
import { getProjectDatabaseDaos } from '../../helpers/getProjectModelsAndDaos'



/** GENERATE ROUTES, DOC and SDK FOR FRONT */
export async function getDaoRouteDescriptionFromDaoConfigs() {

  const allDaoRoutes: string[] = []
  const daoRoutesConfig = {} as RouteFromDaoConfigForGenerateSdk

  const mainConfig = getMainConfig()
  const { generateSdkConfig } = mainConfig
  const { sdkNameForRole } = generateSdkConfig

  const daos = await getProjectDatabaseDaos()

  for (const [dbId, daoForModels] of objEntries(daos)) {
    for (const [modelName, dao] of objEntries(daoForModels)) {

      const { fullMethodsPerRole } = getApiEndpointsPerRolesFromDao(dao.expose)

      for (const [role, allMethods] of objEntries(fullMethodsPerRole)) {
        if (role === 'public') continue
        for (const fnName of allMethods) {

          const route = `/${dbId}/${modelName}/${fnName}`
          const platform = sdkNameForRole[role]
          allDaoRoutes[role] ??= []
          daoRoutesConfig[platform] ??= {}

          pushIfNotExist(allDaoRoutes, route)

          daoRoutesConfig[platform][route] = {
            dbType: dao.type,
            dbId,
            dbName: 'default',
            modelName,
            daoMethod: fnName,
          }
        }
      }
    }
  }
  return {
    allDaoRoutes,
    daoRoutesConfig,
  }
}
