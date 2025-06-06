

import fs from 'fs-extra'
import Path, { dirname } from 'path'
import { templater } from 'simple-file-templater'
import { C, objEntries } from 'topkat-utils'
import type { AllMethodsObjectForSdk } from '../../types/generateSdk.types.js'
import type { GreenDotConfig } from '../../types/mainConfig.types.js'
import { compileTypeScriptProject, esmModuleTsConfig } from '../../helpers/tsCompiler.js'
import { greenDotCacheModuleFolder } from '../../helpers/getProjectPaths.js'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dirNameBase = __dirname.replace(Path.sep + 'dist' + Path.sep, Path.sep)

export async function generateSdkFolderFromTemplates(
  platform: string,
  sdkFolder: string,
  // <DO_NOT> get MAIN CONFIG in this file because we may be in safe mode
  platforms: string[],
  generateSdkConfig = {} as GreenDotConfig['generateSdkConfig'],
  // </DO_NOT>
  // Optinal params
  allMethodsObjectForSdk: AllMethodsObjectForSdk = { dbRead: {}, dbWrite: {}, service: {} },
  tsApiTypes: string = '',
  allMethodNames: string[] = [],
  backendProjectForSdk: string[] = [],
  queriesToInvalidate: { [query: string]: string[] } = {},
) {

  const allMethodsString = JSON.stringify(allMethodsObjectForSdk)

  const isDefaultSdk = tsApiTypes === ''

  const packageJsonPath = Path.join(sdkFolder, 'package.json')

  let packageVersion = '1.0.0'
  if (await fs.exists(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
      packageVersion = packageJson.version
    } catch (err) {
      C.error(false, 'Error reading package.json at ' + packageJsonPath)
    }
  }

  if (await fs.exists(sdkFolder)) {
    const files = await fs.readdir(sdkFolder)
    for (const file of files) {
      // keeps node_modules for perf
      if (file !== 'node_modules' && !file.includes('.lock.')) {
        await fs.remove(Path.join(sdkFolder, file))
      }
    }
  }

  const queriesToInvalidateString = objEntries(queriesToInvalidate).map(([q, strs]) => {
    return strs?.length ? `$.addQueriesToInvalidate.${q}(['${strs.join(`', '`)}'])` : ''
  }).filter(str => !!str).join('\n')

  const packageNamePrefix = generateSdkConfig?.npmPublishConfig?.packageNamePrefix ? generateSdkConfig.npmPublishConfig.packageNamePrefix.replace(/\/$/, '') + '/' : ''

  const generatedSdkFolders = [...(generateSdkConfig?.injectFolderInSdk?.all || []), ...(generateSdkConfig?.injectFolderInSdk?.[platform] || [])]

  const exportAllTsCjs = generatedSdkFolders.length ? generatedSdkFolders.map(f => `export * from './${f.split(Path.sep).pop()}/mjs/index.js'`).join('\n') : ''

  const replaceInFiles: [string: string | RegExp, replacement: string][] = [
    ['%%packageVersion%%', packageVersion],
    [`%%appName%%`, platform],
    [`%%app-name%%`, platform.replace(/([A-Z])/g, '-$1').toLocaleLowerCase()],
    [`%%packageNamePrefix%%`, packageNamePrefix],
    [`%%packageNameAccess%%`, generateSdkConfig?.npmPublishConfig?.access || 'public'],
    [`'%%AllReadMethodsAndService%%'`, allMethodsString],
    [`'%%tsApiTypes%%'`, tsApiTypes],
    [`'%%allAppNamesTypeString%%'`, arrOrAny(platforms)],
    [`'%%AllMethodNameTypeString%%'`, arrOrAny(allMethodNames)],
    [`'%%allBackendFoldersForSdk%%'`, arrOrAny(backendProjectForSdk.map(s => s.split(Path.sep).pop()))],
    [`'%%queriesToInvalidate%%'`, queriesToInvalidateString],
    [`/**%%export_all_ts*/`, exportAllTsCjs]
  ]

  if (!isDefaultSdk) {
    replaceInFiles.push([/%%toDeleteRealSdk .* toDeleteRealSdk%%/, ''])
  }

  await fs.mkdir(sdkFolder, { recursive: true })

  await templater(
    Path.resolve(dirNameBase, '../../../templates/sdkTemplate'),
    sdkFolder,
    [
      ...replaceInFiles,
      [`/**%%export_all*/`, exportAllTsCjs],
    ],
    [
      ['.template', '']
    ]
  )

  // COMMON JS MODULES
  await templater(
    Path.resolve(dirNameBase, '../../../templates/sdkTemplate'),
    sdkFolder,
    [
      ...replaceInFiles,
      // ESM => COMMON JS

      // Import default
      [/import ([^\s]*) from ['"]([^'"]+)['"]/g, 'const $1 = require(\'$2\')'],
      // Import named
      [/import {([^}]+)} from ['"]([^'"]+)['"]/g, 'const {$1} = require(\'$2\')'],
      // Import all
      [/import \* as ([^\s]+) from ['"]([^'"]+)['"]/g, 'const $1 = require(\'$2\')'],
      // Export default
      [/export default ([^\s]+)/g, 'module.exports = $1'],
      // Export named
      [/export (?:const|let|var|function) ([^\s(]+) ?=?/g, 'exports.$1 ='],

      [/export \{/, 'module.exports = {'], // TODO this is not 100% safe because it imply export * from has to be used after that, using Object assign here is a too complex regexp though because can be multilines
      [/export * from (.*)/, 'Object.assign(module.exports, require($1))'],
      // extensions in imports (avoid targetting package.json "exports")
      [/(import .*)\.js/g, `$1.cjs`],
      [/(require.*)\.js/g, `$1.cjs`],
      [`/**%%export_all*/`, generatedSdkFolders.length ? `Object.assign(\n  module.exports, \n  ${generatedSdkFolders.map(f => `require('./${f.split(Path.sep).pop()}/cjs/index'),`).join('\n  ')}\n)` : '']
    ],
    [
      ['.template', ''],
      [/\.js$/, '.cjs'],
    ],
    [/\.ts$/]
  )

  //----------------------------------------
  // SDK HELPER
  //----------------------------------------

  // COMPILE
  const sdkHelperDistPath = Path.join(greenDotCacheModuleFolder, '/sdkHelperDist')

  if (!await fs.exists(sdkHelperDistPath)) {
    const sdkHelperFolderPath = Path.resolve(dirNameBase, '../../sdkHelpersModule')
    if (!await fs.exists(sdkHelperFolderPath)) throw new Error('sdkHelperFolderPath not existing in green_dot: ' + sdkHelperFolderPath)

    await compileTypeScriptProject({
      tsConfig: esmModuleTsConfig,
      projectPath: sdkHelperFolderPath,
      outputPath: sdkHelperDistPath,
    })
  }

  // COPY
  const sdkHelperPath = Path.join(sdkFolder, 'sdkHelpers')
  if (await fs.exists(sdkHelperPath)) await fs.remove(sdkHelperPath)
  await fs.copy(sdkHelperDistPath, sdkHelperPath)

}

function arrOrAny(arr: any[]) {
  return arr.length ? `'${arr.join(`' | '`)}'` : 'any'
}
