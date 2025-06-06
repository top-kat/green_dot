import { GDplugin } from '../GDplugin.js'
import { newPlugin } from '../newPlugin.js'
import { docOneLine, documentation } from './doc.js'
import { getOnLogin } from './onLogin.js'



export type Name = 'GDapiKeyAuthentication'
export { docOneLine, documentation } from './doc.js'

export type GDapiKey = {
  [apiKey in (GD['role'] | (string & {}))]?: {
    _id?: string
    token: string
    role?: GD['role'] // GD['role'] extends 'notImplemented' ? string : GD['role']
    permissions?: Partial<Record<GD['permission'], any>>
    // TODO
    /** Add IPs to whitelist, all other IPs will be non-authorized to authenticate with apiKey */
    ipWhitelist?: MaybeArray<string>
  } // /!\ Used in rest-test package
}

export type PluginUserConfig = {
  enable: boolean,
  apiKeys?: GDapiKey
}


export const defaultConfig = {
  enable: true,
} satisfies PluginUserConfig


/** This handles 2FA, pinCode authentication or biometric authentication.
Request headers must contain at least one of those fields to work: `biometricAuthToken`, `pincode`, `2FA`.
*/
export class GDapiKeyAuthentication extends GDplugin<Name> {

  name = 'GDapiKeyAuthentication' as const

  config: PluginUserConfig

  constructor(config: PluginUserConfig) {
    super()
    this.config = { ...defaultConfig, ...config }
    this.handlers = [{
      priority: 30,
      event: 'onLogin',
      callback: getOnLogin(this)
    }]
  }
}


//  ═╦═ ╦╗ ╔ ═╦═ ══╦══   ╔══╗ ╦    ╦  ╦ ╔══╗ ═╦═ ╦╗ ╔
//   ║  ║╚╗║  ║    ║     ╠══╝ ║    ║  ║ ║ ═╦  ║  ║╚╗║
//  ═╩═ ╩ ╚╩ ═╩═   ╩     ╩    ╚══╝ ╚══╝ ╚══╝ ═╩═ ╩ ╚╩
export default newPlugin<Name, PluginUserConfig, typeof GDapiKeyAuthentication>({
  name: 'GDapiKeyAuthentication',
  version: '1.0.0',
  defaultConfig,
  documentation,
  docOneLine,
  addToVariablesInNewProjectTemplate: {
    instanciatePluginInAppConfig: () => `{ enable: true, apiKeys: {/** TODO put your apiKeys configs here */} }`,
    addToGlobalType: [`apiKeys: 'TODO replace this with the types of your api key to be able to target apiKey name like a role in the app'`],
  },
  plugin: GDapiKeyAuthentication,
})