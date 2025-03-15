
import { throwError } from '../core.error'
import { publicUserId } from '../ctx'
import { Request } from 'express'
import { serverConfig } from '../cache/green_dot.app.config.cache'
import { sendRateLimiterTeamsMessage } from '../services/sendViaTeams'

import { C } from 'topkat-utils'

const rateLimiterCache = {} as {
    [ip: string]: {
        [route: string]: {
            config: RateLimiterConfig
            nbAttempts: number[] // timestamps
        }
    }
}

type NbAttempts = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '10' | '15' | '20' | '30' | '60' | '100' | '150' | '200'
type TimeRange = 'min' | '30s' | '5s'

type RateLimiterStr = `${NbAttempts}/${TimeRange}` | 'disable' // '5/min' | '10/min' | '20/min' | '5/30s'

type RateLimiterObj = {
    /** Max nb attemps in the given time window */
    maxNbAttemptsInGivenTimeWindow: number | { main: number } & { [env in Exclude<Env, 'ci'>]?: number },
    /** Time window for nb attemps */
    timeWindowInSecondsForNbAttempts: number | { main: number } & { [env in Exclude<Env, 'ci'>]?: number },
}

export type RateLimiterConfig = RateLimiterObj | RateLimiterStr | ({ [k in Env]?: RateLimiterStr } & { default: RateLimiterStr })

export const rateLimiter = {
    async recordAttemptAndThrowIfNeeded(ctx: Ctx, route: string, rateLimiterConfig?: RateLimiterConfig) {

        const env = ctx.env === 'ci' ? 'test' : ctx.env

        const configObj = getRateLimiterConfigFromStr(env, rateLimiterConfig)

        const maxNbAttemptsInGivenTimeWindow = typeof configObj.maxNbAttemptsInGivenTimeWindow === 'number' ? configObj.maxNbAttemptsInGivenTimeWindow : (configObj.maxNbAttemptsInGivenTimeWindow[env] || configObj.maxNbAttemptsInGivenTimeWindow.main)

        const userId = ctx._id
        const ip = env === 'test' && ctx.api.req?.headers?.simulateip ? ctx.api.req?.headers?.simulateip as string : ctx.api.ipAdress
        // SYSTEM SHOULD NEVER PASS THERE
        const discriminator = userId && userId !== publicUserId ? userId : ip

        if (!discriminator) return C.warning(false, `This request has no IP, rate limiter failed`)

        await serverConfig?.beforeApiRequest(ctx, { discriminator, route })

        cleanRouteCache(discriminator, route, configObj)

        rateLimiterCache[discriminator] ??= {}
        rateLimiterCache[discriminator][route] ??= { config: configObj, nbAttempts: [] }
        rateLimiterCache[discriminator][route].nbAttempts.push(Date.now())

        const nbAttempts = rateLimiterCache[discriminator][route].nbAttempts.length

        if (nbAttempts > maxNbAttemptsInGivenTimeWindow) {
            const extraInfos = await serverConfig.addUserWarning(ctx, { route, discriminator })

            rateLimiterCache[discriminator][route].nbAttempts = []

            if (extraInfos.nbWarnings >= extraInfos.nbWarningLeftBeforeBan) {
                await serverConfig.banUser(ctx, { discriminator, route })
                // SEND ASYNC
                sendRateLimiterTeamsMessage(ctx, { route, discriminator, nbAttempts, ip, userId, extraInfos })
            }

            throwError.tooManyRequests(ctx, env !== 'production' ? {
                route,
                nbAttempts: rateLimiterCache[discriminator][route].nbAttempts.length,
                maxAttempts: maxNbAttemptsInGivenTimeWindow,
                discriminator,
                ...extraInfos,
            } : {
                ...extraInfos,
                // 'za': '         /"\\',
                // 'zb': '        |\\./|',
                // 'zc': '        |   |',
                // 'zd': '        |   |',
                // 'ze': '        |>*<|',
                // 'zf': '        |   |',
                // 'zg': `     /'\\|   |/'\\`,
                // 'zh': ` /'\\|   |   |   |`,
                // 'zi': '|   |   |   |   |\\',
                // 'zj': '|   |   |   |   |  \\',
                // 'zk': '| *   *   *   * |>  >',
                // 'zl': '|                  /',
                // 'zm': ' |               /',
                // 'zn': '  |            /',
                // 'zo': '   \\          |',
                // 'zp': '    |         |',
            })
        }
    },
    cleanup() {
        for (const discriminator in rateLimiterCache) {
            for (const [route, { config }] of Object.entries(rateLimiterCache[discriminator])) {
                cleanRouteCache(discriminator, route, config)
            }
        }
    }
}

function cleanRouteCache(discriminator: string, route: string, rateLimiterConfig?: RateLimiterConfig) {

    if (!rateLimiterCache?.[discriminator]?.[route]) return

    const env: Env = process.env.NODE_ENV === 'ci' ? 'test' : (process.env.NODE_ENV as Env || 'development')
    const now = Date.now()

    const config = getRateLimiterConfigFromStr(env, rateLimiterConfig)

    const timeWindowInSecondsForNbAttempts = typeof config.timeWindowInSecondsForNbAttempts === 'number' ? config.timeWindowInSecondsForNbAttempts : (config.timeWindowInSecondsForNbAttempts[env] || config.timeWindowInSecondsForNbAttempts.main)

    const timeInMs = timeWindowInSecondsForNbAttempts * 1000
    const noMoreValidTime = now - timeInMs
    rateLimiterCache[discriminator][route].nbAttempts = rateLimiterCache[discriminator][route].nbAttempts.filter(d => {
        return d >= noMoreValidTime
    })
    if (!rateLimiterCache[discriminator][route].nbAttempts.length) {
        delete rateLimiterCache[discriminator][route]
        if (Object.keys(rateLimiterCache[discriminator]).length === 0) {
            delete rateLimiterCache[discriminator]
        }
    }
}


export function rateLimiterMiddleware(ipWhitelist?: string[], config?: RateLimiterConfig) {
    return async (req: Request, res, next) => {
        try {
            const ctx: Ctx = (req as any).ctx
            const route = req.originalUrl.replace(/\?.+/, '').split('?')[0]
            if (ipWhitelist && !ipWhitelist.includes(ctx.api.ipAdress.replace('::ffff:', ''))) {
                return res.status(404).end()
            }

            await rateLimiter.recordAttemptAndThrowIfNeeded(ctx, route, config)

            next()
        } catch (err) {
            next(err)
        }
    }
}


setInterval(() => rateLimiter.cleanup(), 60 * 60 * 1000) // once each hour

const defaultConfig: (env: Env) => RateLimiterObj = (env) => ({
    maxNbAttemptsInGivenTimeWindow: 30,
    timeWindowInSecondsForNbAttempts: env === 'test' ? 5 : 120,
})

function getRateLimiterConfigFromStr(env: Env, conf?: RateLimiterConfig) {

    if (!conf) return defaultConfig(env)

    if (typeof conf !== 'string') {
        if (conf[env]) conf = conf[env]
        else if ('default' in conf) conf = conf.default
    }

    if (typeof conf === 'string') {

        if (conf === 'disable') return {
            maxNbAttemptsInGivenTimeWindow: 9999,
            timeWindowInSecondsForNbAttempts: 60,
        } satisfies RateLimiterObj

        const [nbAttempts, configuredTime] = conf.split('/') as [NbAttempts, TimeRange]

        return {
            maxNbAttemptsInGivenTimeWindow: Number(nbAttempts),
            timeWindowInSecondsForNbAttempts: configuredTime === 'min' ? 60 : configuredTime === '30s' ? 30 : 60,
        } satisfies RateLimiterObj
    } else return conf as RateLimiterObj
}