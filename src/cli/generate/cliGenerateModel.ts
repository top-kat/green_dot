
import fs from 'fs-extra'
import { luigi } from '../helpers/luigi.bot'

export async function cliGenerateModel(fileName: string, filePathWithoutExtension: string) {

  luigi.tips(`In .dao.ts file, start by typing gd_dao to see available snippets to autocomplete 'expose', 'mask' and 'filter' fields`)


  await fs.outputFile(filePathWithoutExtension + '.model.ts', modelFileTemplate(fileName), 'utf-8')
  await fs.outputFile(filePathWithoutExtension + '.dao.ts', daoFileTemplate(fileName), 'utf-8')

}

//  ╦  ╦ ╔══╗ ╦    ╔══╗ ╔══╗ ╔══╗ ╔═══
//  ╠══╣ ╠═   ║    ╠══╝ ╠═   ╠═╦╝ ╚══╗
//  ╩  ╩ ╚══╝ ╚══╝ ╩    ╚══╝ ╩ ╚  ═══╝

const modelFileTemplate = modelName => `
import { _ } from 'green_dot'

export const ${modelName}Model = _.mongoModel(['creationDate'], {

})

export default ${modelName}Model
`

const daoFileTemplate = modelName => `
import { MongoDao } from 'green_dot'
import { ${modelName}Model } from './myNewModule.model'

const dao = {
    type: 'mongo',
    expose: [

    ],
    filter: [

    ],
    mask: [

    ],
} satisfies MongoDao<typeof ${modelName}Model.tsType>

export default dao
`