
import { appliableHooksForUser } from './appliableHookForUser'
import { DaoGenericMethods } from '../../types/core.types'
import { MongoDaoParsed } from '../mongo/types/mongoDbTypes'

/** May throw a 403 unauthorized if user doesn't have access */
export async function hookInterpreterExpose(
    ctx: Ctx,
    hooks: MongoDaoParsed<any>['expose'],
    dbId: string,
    dbName: string,
    method: DaoGenericMethods,
    modelName
) {
    if (ctx.isSystem) return true
    const exposeHooks = await appliableHooksForUser(ctx, hooks, method, 'alwaysReturnTrue', 'matchStrict', 'alwaysReturnTrue')
    const authorizedMethods = []
    for (const { expose: exposedMethods } of exposeHooks) authorizedMethods.push(...exposedMethods)

    if (!authorizedMethods.includes(method)) ctx.throw.userDoNotHaveThePermission({
        addintionalInfos: 'Wrong Method',
        modelName,
        userRole: ctx.role,
        userId: ctx._id,
        userPermissions: ctx.permissions,
        method,
        dbName,
        dbId,
        authorizedMethods,
        fn: 'hookInterpreterExpose.checkMethod',
    })
}