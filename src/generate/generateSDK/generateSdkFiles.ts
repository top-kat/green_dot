
import fs from 'fs-extra'
import Path from 'path'
import { displayObjectClean } from '../helpers/displayObjectClean'
import { generateSdkFolderFromTemplates } from './generateSdkFolderFromTemplates'
import { generateModelFolderInSdk } from './generateModelFolderInSdk'
import { GenerateSDKparamsForDao, AllMethodsObjectForSdk } from '../../types/generateSdk.types'



export async function generateSdkFiles(
    monorepoRoot: string,
    platform: string,
    daoMethods: GenerateSDKparamsForDao[string]['methodConfigAll'],
    servicesMethods: Record<string, [serverKey: string, serviceName: string]>,
    objectTs: Record<string, string>,
    allMethodNames: string[],
    backendProjectForSdk: string[],
    queriesToInvalidate: { [query: string]: string[] }
) {

    const sdkRoot = Path.resolve(monorepoRoot, `SDKs/${platform}Sdk`)

    const allMethodsObjectForSdk = { service: servicesMethods, ...daoMethods } satisfies AllMethodsObjectForSdk

    const tsApiTypes = displayObjectClean({
        service__COMMENT__: `// SERVICES ${'='.repeat(30)}`,
        ...objectTs
    })
        .replace(/^(\s+[^(]*?): ([(<])/gm, '$1$2') // replace salesGetAll: ( => salesGetAll(
        .replace(/{/, '')
        .replace(/}\s*$/, '')

    //----------------------------------------
    // FILL SDK FOLDER\
    //----------------------------------------
    await generateSdkFolderFromTemplates(platform, sdkRoot, allMethodsObjectForSdk, tsApiTypes, allMethodNames, backendProjectForSdk, queriesToInvalidate)

    //----------------------------------------
    // DATABASE TYPES EMBEDDED IN SDK
    //----------------------------------------
    await generateModelFolderInSdk(monorepoRoot, platform)

    // mongo-db-base-types.generated.ts
    const databaseFilePath = Path.resolve(__dirname, '../../databases/mongo/types/mongoDbBaseTypes.ts')
    await copyFile(databaseFilePath, 'mongo-db-base-types.generated.ts', false, sdkRoot, str => str.replace(/.*\/\/ rmv.*/g, ''))

    //----------------------------------------
    // CONSTANTS
    //----------------------------------------
    const constantPath = Path.join(sdkRoot, 'constants')
    if (await fs.exists(constantPath)) await fs.rmdir(constantPath)
    await fs.copy(Path.join(monorepoRoot, './packages/global-shared/dist'), constantPath)

}



//  ╦  ╦ ╔══╗ ╦    ╔══╗ ╔══╗ ╔══╗ ╔═══
//  ╠══╣ ╠═   ║    ╠══╝ ╠═   ╠═╦╝ ╚══╗
//  ╩  ╩ ╚══╝ ╚══╝ ╩    ╚══╝ ╩ ╚  ═══╝

async function copyFile(
    from: string,
    to = from.replace(/^.*\/([^/]+$)/, '$1'),
    isEs6Import: boolean,
    apiServicePackagePath: string,
    replaceInFileStr = (str: string) => str
) {
    let fileAsStr = await fs.readFile(from, 'utf-8')
    if (isEs6Import) {
        fileAsStr = fileAsStr.replace(/%%%!isEs6Import .*/g, '').replace(/%%%isEs6Import /g, '')
    } else {
        let fileAsStrMjs = fileAsStr.replace(/%%%!isEs6Import .*/g, '').replace(/%%%isEs6Import /g, '')
        fileAsStrMjs = replaceInFileStr(fileAsStrMjs)
        await fs.writeFile(Path.join(apiServicePackagePath, to.replace('.js', '.mjs')), fileAsStrMjs)
        fileAsStr = fileAsStr.replace(/%%%isEs6Import .*/g, '').replace(/%%%!isEs6Import /g, '')
    }
    fileAsStr = replaceInFileStr(fileAsStr)
    await fs.writeFile(Path.join(apiServicePackagePath, to), fileAsStr)
}