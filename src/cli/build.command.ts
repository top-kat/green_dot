import { generateIndexForProjectApp } from './build/generateIndexForProjectApp.js'
import { generateIndexForProjectDb } from './build/generateIndexForProjectDb.js'
import { createNewTask } from './helpers/createNewTask.js'
import { initProjectAndDaosCache } from '../helpers/getProjectModelsAndDaos.js'
import { C } from 'topkat-utils'
import { execWaitForOutput } from 'topkat-utils/backend.js'
import { generateDefaultSafeIndexDbCacheFile } from './build/generateIndexDefaultSafeDbIndexCache.js'



export async function buildCommand({ tsc = true, publishSdks = false } = {}) {
  process.env.SAFE_IMPORT_VERBOSE = '1'

  const build = createNewTask()

  // From here we build indexes and we don't require to execute project code
  await build.step(`Generating indexes for Databases and Applications`, async () => {
    await Promise.all([
      generateIndexForProjectDb(),
      generateIndexForProjectApp(),
      generateDefaultSafeIndexDbCacheFile(),
    ])
  })

  const { initGreenDotConfigs, getMainConfig } = await import('../helpers/getGreenDotConfigs.js')

  // From Here, we execute some project code so it may break more easily
  await build.step(`Getting green_dot configs`, async () => await initGreenDotConfigs(false), { watch: true, cleanOnError: true })


  const { getProjectPaths } = await import('../helpers/getProjectPaths.js')
  const { autoIndex } = await import('../services/autoIndex.js')

  const mainConfig = getMainConfig()
  const { mainConfig: mainConfigPath } = await getProjectPaths()

  if (mainConfig?.autoIndexes?.length > 0) {
    await build.step(`Generating index files for client`, async () => {
      await autoIndex(
        mainConfig.autoIndexes,
        mainConfigPath.folderPath
      )
    })
  }

  const { generateFilesForCachedDb } = await import('./build/generateFilesForCachedDb.js')
  const { generateSdk } = await import('../generate/generateSDK/generateSDK.js')
  const { generateIndexForDbTypeFiles } = await import('./build/generateIndexForDbIndex.js')

  await build.step(`Generating SDKs defaults`, async () => await generateSdk(true))

  await build.step(`Generating types for databases`, async () => {
    const indexFile = await generateFilesForCachedDb()
    await generateIndexForDbTypeFiles(indexFile)
  }, { watch: true, cleanOnError: true })

  await build.step(`Generating SDKs`, async () => {
    await initProjectAndDaosCache()
    C.success(`Successfully initialized Dao and Models`)
    await generateSdk(false, publishSdks)
  })


  if (tsc) {
    await build.step(`Typescript Build`, async () => {
      const { mainConfig } = await getProjectPaths()
      await execWaitForOutput('tsc', { execOptions: { cwd: mainConfig.folderPath } })
    })
  }

  C.log('\n\n' + C.dim('='.repeat(50) + '\n'))

  build.end(`Successfully built green_dot project`)

  process.env.SAFE_IMPORT_VERBOSE = '0'
}