

import { Definition } from 'good-cop/src/index-backend'
import { AllModels, MainDbName } from './cache/dbs/index.generated'
import { getProjectDatabaseModelsSync } from './helpers/getProjectModelsAndDaos'

getProjectDatabaseModelsSync() // init cache while server is starting, unfortunately actually we need a sync version

export const _ = new Definition<AllModels, MainDbName>(getProjectDatabaseModelsSync).init()