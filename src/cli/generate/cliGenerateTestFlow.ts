
import fs from 'fs-extra'
import { getMainConfig } from '../../helpers/getGreenDotConfigs'
import { C, capitalize1st, camelCaseToWords, asArray } from 'topkat-utils'
import { luigi } from '../helpers/luigi.bot'

export async function cliGenerateTestFlow(fileName: string, filePath: string) {

  const { generateSdkConfig } = await getMainConfig()
  const { sdkNameForRole } = generateSdkConfig

  const sdkNb = Object.keys(sdkNameForRole).length

  const sdkToImport = sdkNb === 1 ? Object.values(sdkNameForRole)[0] : await luigi.askSelection(
    `Which SDK should we import for testing ?\n${C.dim(`You can test with the SDK to benefit from types and autocomplete in your tests but you can always test with route and method as well`)}`,
    Object.values(sdkNameForRole),
    { multi: sdkNb > 1 }
  )

  const testFlowTemplate = `
/* SYNOPSIS
  // download green_dot VScode/cursor extension to autofill that header with your tests synopsis
*/

import { TestFlow } from '../../1_shared/configs/rest-test-config'
import { assert } from 'green_dot'
import { $ } from '@bangk/ico-dashboard-sdk'
${asArray(sdkToImport).map(name => `import { ${sdkToImport.length === 1 ? '$' : `$ as ${name}Sdk`} } from '${name}'\n`)}/

const testFlow = {
    name: '${capitalize1st(camelCaseToWords(fileName).join(' '))} test flow',
    items: [
      // start by typing gd_test to see available snippets (VScode/cursor IDE only)
    ]
} satisfies TestFlow<TestEnv & {/* put custom type here to override 'env' type */ }>

export default testFlow
`

  await fs.outputFile(filePath, testFlowTemplate, 'utf-8')

  luigi.tips(`In .testFlow.ts file, start by typing gd_test to see available snippets for 'items' and gd_assert to create a new 'assertion'`)

}
