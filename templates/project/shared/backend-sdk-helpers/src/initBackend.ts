

import { SdkInitOptions } from './types'
import { registerConfig, C } from 'topkat-utils'
import { get$ } from './init'


registerConfig({ terminal: { noColor: true } })


let isInitialized = false

//----------------------------------------
// BASE CONFIG
//----------------------------------------
export type InitBackendConfig<AppConfig> = {
  projectName: string
  onLogout?(): void | Promise<void>
  getDeviceId(): string | Promise<string>
  onBackendInitialized?(): any | Promise<string>
  refreshTokenExpirationMinutes?: number
  refreshTokenErrorMessage?: string
  wrongTokenErrorMessage?: string
} & SdkInitOptions<AppConfig>

const notImplementedErrMsg = (fnName: string) => { throw new Error(`${fnName}() is not set in backend. Check backend has been initialized correctly`) }

const fakeLs = {}

const cacheLocalStorage = {
  get: key => fakeLs[key],
  set: (key, val) => fakeLs[key] = val.toString(),
  remove: key => delete fakeLs[key],
}

const backendConfig: InitBackendConfig<any> = {
  serverUrls: { default: 'backend', backend: 'http://localhost:9086' },
  projectName: 'undefined',
  getDeviceId: () => notImplementedErrMsg('getDeviceId'),
  getQueryClient: () => notImplementedErrMsg('getQueryClient'),
  localStorageSet: cacheLocalStorage.set,
  localStorageGet: cacheLocalStorage.get,
  localStorageRemove: cacheLocalStorage.remove,
  onErrorCallback: error => { throw error },
  refreshTokenExpirationMinutes: 15,
  refreshTokenErrorMessage: 'Wrong refresh token',
  wrongTokenErrorMessage: 'Wrong Token',
}

//----------------------------------------
// INITIALIZATION
//----------------------------------------
export function initBackend<AppConfig>(config: InitBackendConfig<AppConfig>) {

  Object.assign(backendConfig, config)

  const apiUrl = backendConfig?.serverUrls[backendConfig.serverUrls?.default]

  if (!apiUrl) C.error(false, 'API URL NOT SET FOR BACKEND', JSON.stringify(backendConfig, null, 2))

  C.info(`apiUrl ` + JSON.stringify(apiUrl))
  get$().init(backendConfig)

  isInitialized = true
}

export function isBackendInitialized() {
  return isInitialized
}

export function getBackendConfig() {
  return backendConfig
}