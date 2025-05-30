

import { GreenDotApiTestsConfig, TestSuite as TestFlowRaw, TestItem as TestItemRaw, assert, InitBackendConfig } from 'green_dot'
import { $ as icoSdk, initBackend as initBackendIcoDashboard, ServerUrls } from '../SDKs/icoDashboardSdk'
import { $ as adminSdk, initBackend as initBackendAdmin } from '../SDKs/adminSdk'
import { $ as mobileAppSdk, initBackend as initBackendMobile } from '../SDKs/mobileAppSdk'
import { UserNames } from './1_shared/tests/testUsers'
import { TestEnvUser } from './1_shared/tests/testEnv.type'
import { objKeys, C } from 'topkat-utils'

import { appConfig } from './green_dot.app.config'
import { allRoutes } from './2_generated/all-routes-for-tests.generated'
import { testUsers } from './1_shared/tests/testUsers'
import { testApiKeys } from '../shared/backendConstants'
import { logTestUser, logUserWithEmail } from './user/tests/logTestUser'
import { serverActionTypedForTests } from './1_shared/tests/serverActionTypedForTests'

export const restTestEnv = {
    routes: allRoutes,
}

/** Allow shorcut when testing on multiples servers */
export const servers = {
    default: appConfig.serverLiveUrl,
}

type ApiKeys = keyof typeof testApiKeys
type ConnexionInfos = { email: string, password: string }
type TestUserNames = keyof typeof testUsers

const initSdkConfig = (projectName: string) => ({
    projectName,
    getDeviceId: () => '990063773062617365557372',
    serverUrls: {
        backend: 'http://localhost:9086',
        default: 'backend',
    },
    onErrorCallback(err) { throw err },
} as const satisfies InitBackendConfig<ServerUrls>)

export const testConfig: GreenDotApiTestsConfig = {
    disableSolo: process.env.NODE_ENV === 'ci',
    displayIntroTimeout: 800,
    mode: 'jsonRpc',
    servers,
    apiKeys: appConfig.apiKeys as any,
    env: restTestEnv,
    //----------------------------------------
    // BEFORE ALL TESTS
    //----------------------------------------
    async onBeforeAllTests({ env, isReload }) {

        // ALLOW TO SEE WITH WICH TOKEN WE ARE CONNECTED
        overrideBackendAuthorization(env)

        // INIT BACKEND
        initBackendIcoDashboard(initSdkConfig('icoDashboard'))
        initBackendMobile(initSdkConfig('mobileApp'))
        initBackendAdmin(initSdkConfig('adminDashboard'))

        if (!isReload) {
            C.info('CLEARING THE DATABASE AND SEEDING')
            await serverActionTypedForTests('clearDB')

            // POPULATE ENV WITH USERS
            for (const userName of objKeys(testUsers)) {
                const { platform, user } = await logTestUser(userName)
                assert(user.accessToken, `loggedUser.accessToken`, { type: 'string' })
                assert(user.creationDate, `loggedUser.creationDate`)
                env.users ??= {} as any
                env.users[userName] = {
                    platform,
                    ...user,
                    // accessToken: loggedUser.accessToken,
                    // deviceId: loggedUser.deviceId,
                }
            }
        }
    },
    //----------------------------------------
    // BEFORE / AFTER EACH TEST
    //----------------------------------------
    async onBeforeTest({ env, as, apiKey, headers }) {
        if (apiKey) {
            headers.apiKey = apiKey // just in case it's a route instead of a service
        } else if (as) {
            if (typeof as === 'string') {
                if (testUsers[as]) {
                    const userFromEnv = env.users[as]
                    if (!userFromEnv?.accessToken) {
                        const { platform, user } = await logTestUser(as)
                        env.users ??= {} as any
                        env.users[as] = {
                            ...user,
                            platform,
                        }
                    }
                    headers.authorization = env.users[as].accessToken
                    headers.platform = env.users[as].platform
                } else throw new Error(`Trying to connect with a non existing user: ${as}`)
            } else if (typeof as === 'object') {
                const userFromEnv = env.users[as.email]
                if (!userFromEnv?.accessToken) {
                    const { email, password } = as
                    const data = await logUserWithEmail(email, password)
                    env.users[as.email] ??= {}
                    Object.assign(env.users[as.email], data)
                }
                headers.authorization = env.users[as.email].accessToken
                headers.platform = env.users[as.email].platform
            }
        }
        icoSdk.setHeaders(headers)
        adminSdk.setHeaders(headers)
        mobileAppSdk.setHeaders(headers)
        // while setAuthorization is just an alias of setHeaders, it is called because it triggers overrideBackendAuthorization
        icoSdk.setAuthorization(headers.authorization)
        adminSdk.setAuthorization(headers.authorization)
        mobileAppSdk.setAuthorization(headers.authorization)
    },
    onAfterTest() {
        icoSdk.setHeaders({ apiKey: null, refreshToken: null, platform: null })
        icoSdk.setAuthorization(null)
        adminSdk.setHeaders({ apiKey: null, refreshToken: null, platform: null })
        adminSdk.setAuthorization(null)
        mobileAppSdk.setHeaders({ apiKey: null, refreshToken: null, platform: null })
        mobileAppSdk.setAuthorization(null)
    },
}

export type TestFlow<EnvFromUser> = TestFlowRaw<TestUserNames, ConnexionInfos, typeof testConfig & { env: typeof testConfig['env'] & typeof restTestEnv & EnvFromUser }>

export type TestItem<EnvFromUser> = TestItemRaw<TestUserNames, ConnexionInfos, typeof testConfig & { env: typeof testConfig['env'] & typeof restTestEnv & EnvFromUser }>





//----------------------------------------
// HELPERS
//----------------------------------------
/** Just a helper to log the userName/token we are connecting with */
function overrideBackendAuthorization(env: TestEnv) {
    const callbck = (authToken: string) => {

        let userThatWeAreConnectingWith: string
        if (env.users) Object.entries(env.users).find(([k, user]) => {
            if (user.accessToken === authToken) {
                userThatWeAreConnectingWith = k
                return true
            }
        })

        C.info(authToken === null ? 'UNLOG USER' : `LOGIN WITH: ` + (userThatWeAreConnectingWith || authToken || ' /!\\ NOT SET /!\\ '))
        icoSdk.setHeaders({ authorization: authToken })
        adminSdk.setHeaders({ authorization: authToken })
    }
    icoSdk.setAuthorization = callbck
    adminSdk.setAuthorization = callbck
}






//----------------------------------------------------------
//
//            GLOBAL TYPES
//
// Those global types are exposed so you can override them
// with your custom functions or props
//----------------------------------------------------------

declare global {
    interface GD {
        testUserNames: TestUserNames
        apiKeys: ApiKeys
        testEnvType: TestEnv
    }

    /** env variable type that is used in API tests ('.testFlow.ts' files). You can also override env type per test flow instead of globally in a type param (see generated file comments or documentation for advanced use cases TODO document me) */
    interface TestEnv {
        lastConnectedUser: string
        /** Populated in sellOffer test flow */
        investmentProjectId: string
        users: Record<UserNames, TestEnvUser>
    }
}