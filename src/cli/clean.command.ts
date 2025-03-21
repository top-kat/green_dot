

import { C } from 'topkat-utils'
import { createNewTask } from './createNewTask'
import { generateIndexForDbCachedFiles } from './build/generateIndexForDbCachedFiles'


export async function cleanCommand() {

  const build = createNewTask()

  C.info('Cleaning Files')

  await build.step(`Clean`, generateIndexForDbCachedFiles, { cleanOnError: false, doNotDisplayTime: true })

  C.log(C.dim('='.repeat(50) + '\n'))

  build.end(`Successfully cleaned files`)

}