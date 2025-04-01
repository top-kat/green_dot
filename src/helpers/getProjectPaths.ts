
import Path from 'path'
import fs from 'fs-extra'
import glob from 'fast-glob'
import { C } from 'topkat-utils'

export type GDpathConfig = { path: string, folderPath: string }
export type GDpathConfigWithIndex = GDpathConfig & { generatedIndexPath: string, generatedFolderPath: string, folderPathRelative: string }
type PathConfArr = GDpathConfigWithIndex[]

export const greenDotCacheModuleFolder = Path.resolve(__dirname, '../cache')
if (!fs.existsSync(greenDotCacheModuleFolder)) throw C.error(false, `ERROR: green_dot local cache folder for DB is not existing. __dirname:${__dirname} greenDotCacheModuleFolder:${greenDotCacheModuleFolder} `)



let greenDotPathsCache: {
  /** Path of green_dot.config.ts */
  mainConfig: GDpathConfig
  /** Paths to all green_dot.app.config.ts that can be found in the project alongside their app names (folder name)*/
  appConfigs: PathConfArr
  /** Paths to all green_dot.db.config.ts that can be found in the project alongside their DB names (folder name) */
  dbConfigs: PathConfArr

  activeApp?: GDpathConfigWithIndex
  activeDb?: GDpathConfigWithIndex
}


export async function getProjectPaths(resetCache = false) {

  if (!greenDotPathsCache || resetCache === true) {

    const { mainConfigPath, rootPath } = await findProjectPath()

    // FIND ALL GREEN DOT CONFIGS
    const allFiles = await glob.async('**/green_dot.*.config.*', {
      cwd: rootPath,
      ignore: ['node_modules/**', '**/.*/**'],
      onlyFiles: true,
      absolute: true,
    })

    const dbConfigPaths = allFiles
      .filter(fileName => fileName.includes('green_dot.db.config'))
      .map(configFilePathMapper(rootPath))

    const appConfigPaths = allFiles
      .filter(fileName => fileName.includes('green_dot.app.config'))
      .map(configFilePathMapper(rootPath))

    greenDotPathsCache = {
      mainConfig: { path: mainConfigPath, folderPath: rootPath },
      appConfigs: appConfigPaths,
      dbConfigs: dbConfigPaths,
    }

    autoFindAndInitActiveAppAndDbPaths()
  }

  return greenDotPathsCache
}




export async function findProjectPath(silent = false) {
  const cwd = process.cwd()
  let isSubFolder = false
  let mainConfigPath = Path.join(cwd, 'green_dot.config.ts')
  let exists = await fs.exists(mainConfigPath)
  if (!exists) {
    isSubFolder = true
    mainConfigPath = Path.join(cwd, '../green_dot.config.ts')
    exists = await fs.exists(mainConfigPath)
    if (!exists) {
      mainConfigPath = Path.join(cwd, '../../green_dot.config.ts')
      exists = await fs.exists(mainConfigPath)
    }
  }

  if (!exists && !silent) throw C.error(false, './green_dot.config.ts NOT FOUND. Please ensure you run the command from a valid green_dot project')

  const rootPath = mainConfigPath.replace(/[/\\][^/\\]*$/, '') // replace last path bit

  return { rootPath, mainConfigPath, exists, cwd, isSubFolder }
}


//  ╦  ╦ ╔══╗ ╦    ╔══╗ ╔══╗ ╔══╗ ╔═══
//  ╠══╣ ╠═   ║    ╠══╝ ╠═   ╠═╦╝ ╚══╗
//  ╩  ╩ ╚══╝ ╚══╝ ╩    ╚══╝ ╩ ╚  ═══╝

function configFilePathMapper(mainConfigFolderPath: string) {
  return (path: string) => {
    const folderPath = path.replace(/[/\\]green_dot.[^/\\]*?config[^/\\]*?$/, '')
    return {
      path: path,
      folderPath,
      folderPathRelative: Path.relative(mainConfigFolderPath, folderPath),
      generatedIndexPath: path.replace(/[/\\]green_dot.[^/\\]*?config[^/\\]*?$/, Path.sep + 'index.generated.ts'),
      generatedFolderPath: path.replace(/[/\\]green_dot.[^/\\]*?config[^/\\]*?$/, Path.sep + 'src' + Path.sep + '.generated')
    }
  }
}

export function autoFindAndInitActiveAppAndDbPaths(path = process.cwd()) {

  let hasBeenFound = false

  if (!greenDotPathsCache) throw 'Cache not implemented for autoFindAndInitActiveAppAndDbPaths()'

  const { appConfigs, dbConfigs } = greenDotPathsCache

  const activeAppName = appConfigs.length === 1 ? appConfigs[0] : appConfigs.find(p => (path + '/').includes(p.folderPath))
  if (activeAppName) {
    greenDotPathsCache.activeApp = activeAppName
    hasBeenFound = true
  }

  const activeDbName = dbConfigs.length === 1 ? dbConfigs[0] : dbConfigs.find(p => (path + '/').includes(p.folderPath))
  if (activeDbName) {
    greenDotPathsCache.activeDb = activeDbName
    hasBeenFound = true
  }

  return hasBeenFound
}