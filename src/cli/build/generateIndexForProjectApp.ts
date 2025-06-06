import Path from 'path'
import fs from 'fs-extra'
import { getProjectPaths } from '../../helpers/getProjectPaths.js'
import glob from 'fast-glob'
import { C, capitalize1st } from 'topkat-utils'

const indexedFiles = ['svc', 'schedule', 'event', 'error', 'seed', 'test', 'testFlow'] as const
type IndexedFiles = typeof indexedFiles[number]


// match .svc.ts, .schedule.ts or .event.ts files with first capture group to model name
const appFilesRegexp = new RegExp(`[/\\\\]([^/\\\\]+)\\.(${indexedFiles.join('|')})\\.ts$`)

/** Generates index.generated.ts files in client APP folder */
export async function generateIndexForProjectApp() {

  const { appConfigs, mainConfig } = await getProjectPaths()

  for (const { generatedIndexPath, folderPath: appConfigFolderPath } of appConfigs) {
    const appPathRelative = Path.relative(mainConfig.folderPath, appConfigFolderPath)
    const mainPathRelative = Path.relative(appConfigFolderPath, mainConfig.folderPath)
    try {

      const allFiles = await glob.async(`**/*.@(${indexedFiles.join('|')}).ts`, {
        cwd: appConfigFolderPath,
        onlyFiles: true,
        absolute: true,
      })

      allFiles.sort((a, b) => a.localeCompare(b))

      const indexContent = {
        imports: ``,
        errorType: [] as string[],
      }

      const testIndexContent = { imports: '', exports: [] }

      for (const file of allFiles) {

        const match = file.match(appFilesRegexp) as [any, moduleName: string, moduleType: IndexedFiles]

        if (match) {

          const [, moduleName, moduleType] = match
          const relativeToRoot = Path.relative(appConfigFolderPath, file).replace('.ts', '')

          if (moduleType === 'test' || moduleType === 'testFlow') {
            const varName = moduleName + capitalize1st(moduleType)
            testIndexContent.imports += `import ${varName} from './${relativeToRoot}.js'\n`
            testIndexContent.exports.push(varName)
          } else if (moduleType === 'error') {
            indexContent.imports += `import ${moduleName}Errors from './${relativeToRoot}.js'\n`
            indexContent.errorType.push(`typeof ${moduleName}Errors`)
          } else {
            indexContent.imports += `export * from './${relativeToRoot}.js'\n`
          }
        }
      }

      const fileContent = `
import { RegisterErrorType, initClientApp, initEnv } from 'green_dot'
import mainConfig from '${mainPathRelative}/gd.config.js'

initEnv(mainConfig)

export const initApp = async () => initClientApp(mainConfig)

${indexContent.imports}

export const allErrors = {...${indexContent.errorType.map(e => e.replace('typeof ', '')).join(', ...') || '{}'}}

declare global {
  interface GreenDotErrors extends RegisterErrorType<${indexContent.errorType.join(' & ') || '{}'}> { }
}
`

      const testFileContent = `
import { type TestSuite, initClientApp } from 'green_dot'
import mainConfig from '${mainPathRelative}/gd.config.js'
${testIndexContent.imports}

export const initApp = async () => initClientApp(mainConfig)

export const allTests = {\n${testIndexContent.exports.map(ti => `    ${ti}`).join(',\n')}\n} as Record<string, TestSuite> // explicit type to avoid "The inferred type of this node exceeds the maximum length the compiler will serialize" error
`

      await fs.outputFile(generatedIndexPath, fileContent, 'utf-8')
      await fs.outputFile(generatedIndexPath.replace('index.generated', 'testIndex.generated'), testFileContent, 'utf-8')

      C.success(`Generated index for /${appPathRelative} APP`)
      C.success(`Generated testIndex for /${appPathRelative} APP`)

    } catch (err) {
      C.error(err)
      throw C.error(false, 'ERROR CREATING INDEX FOR DATABASE /' + appPathRelative)
    }
  }
}