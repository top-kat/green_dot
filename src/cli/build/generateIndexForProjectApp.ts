
import Path from 'path'
import fs from 'fs-extra'
import { getProjectPaths } from '../../helpers/getProjectPaths'
import glob from 'fast-glob'
import { C } from 'topkat-utils'

// match .svc.ts, .schedule.ts or .event.ts files with first capture group to model name
const appFilesRegexp = /[/\\]([^/\\]+)\.(svc|schedule|event|error)\.ts$/

/** Generates index.generated.ts files in client APP folder */
export async function generateIndexForProjectApp() {

  const { appConfigs, mainConfig } = await getProjectPaths()

  for (const { generatedIndexPath, folderPath: appConfigFolderPath } of appConfigs) {
    const appPathRelative = Path.relative(mainConfig.folderPath, appConfigFolderPath)
    const mainPathRelative = Path.relative(appConfigFolderPath, mainConfig.folderPath)
    try {

      const allFiles = await glob.async('**/*.@(svc|schedule|event|error).ts', {
        cwd: appConfigFolderPath,
        onlyFiles: true,
        absolute: true,
      })

      const indexContent = {
        imports: ``,
        errorType: [] as string[],

      }

      for (const file of allFiles) {

        const match = file.match(appFilesRegexp) as [any, string, 'svc' | 'schedule' | 'event' | 'error']

        if (match) {

          const [, moduleName, moduleType] = match
          const relativeToRoot = Path.relative(appConfigFolderPath, file).replace('.ts', '')

          if (moduleType === 'error') {
            indexContent.imports += `import ${moduleName}Errors from './${relativeToRoot}'\n`
            indexContent.errorType.push(`typeof ${moduleName}Errors`)
          } else {
            indexContent.imports += `export * from './${relativeToRoot}'\n`
          }
        }
      }

      const fileContent = `
import { RegisterErrorType, registerMainConfig } from 'green_dot'
import mainConfig from '${mainPathRelative}/green_dot.config'

registerMainConfig(mainConfig)

${indexContent.imports}

declare global {
  interface GreenDotErrors extends RegisterErrorType<${indexContent.errorType.join(' & ') || '{}'}> { }
}
`

      await fs.outputFile(generatedIndexPath, fileContent, 'utf-8')

      C.success(`Generated index for /${appPathRelative} APP`)

    } catch (err) {
      C.error(err)
      throw C.error(false, 'ERROR CREATING INDEX FOR DATABASE /' + appPathRelative)
    }
  }
}