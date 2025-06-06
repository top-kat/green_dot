import { type Mask } from '../databases/mongo/services/maskService.js'

import { type MongoDaoParsed } from '../databases/mongo/types/mongoDbTypes.js'
import { UserModels, OrgModels, Organization, User } from './jestHelpers.js'
import { _, Definition } from '../lib/good-cop/index-backend.js'


const validationAddr = () => ({
    user: _.object({
        _id: _.string(),
        name: _.string(),
        password: _.string(),
        organization: _.ref('organization'),
    }),
    organization: _.object({
        _id: _.string(),
        name: _.string(),
        adminField1: _.string(),
        adminField2: _.string(),
        anotherFieldUserHaveNoAccess: _.string(),
        teams: _.array({
            users: _.array(_.ref('user')),
            name: _.string(),
            adminAuth: _.string()
        })
    }),
})

const createDaoParsed = <T = any>(o: Partial<Mask<T>>) => {
    return {
        priority: 50,
        for: ['ALL'],
        on: ['getAll', 'getOne', 'create', 'update', 'delete'],
        ...o
    } as any as Mask
}

type Models = {
    mongo: { [dbId: string]: { [modelName: string]: Record<string, any> } }, // do not refactor type here because less readable on intellisense
    daos: { [dbId: string]: { [modelName: string]: MongoDaoParsed<any> } },
    populateAddrFlatWithModelName: { [dbId: string]: { [modelName: string]: { [populatedFieldNameFlat: string]: string } } },
    validation: { [dbId: string]: { [modelName: string]: Definition } },
}

export const models: Models = {
    mongo: {},
    daos: {
        mainDb: {
            user: {
                type: 'mongo',
                // authorizedOLDApiEndpoint: ['count', 'create', 'delete', 'deleteWithFilter', 'getAll', 'getById', 'getFirstN', 'getOne', 'update', 'delete'],
                modelConfig: {},
                expose: [],
                mask: [createDaoParsed<User<any>>({
                    // mask password field for read and all admin and users
                    for: [{ role: 'user' as any }, { role: 'admin' as any }],
                    on: ['getAll', 'getOne'],
                    mask: () => ({
                        password: true,
                    })
                }), createDaoParsed<User<any>>({
                    // mask everything for public except name (this is not realistic since we should use 'expose' or 'filter' instead)
                    for: [{ role: 'public' }],
                    select: () => ({ name: true })
                })],
                populate: [],
            } satisfies MongoDaoParsed<UserModels>,
            organization: {
                type: 'mongo',
                // authorizedOLDApiEndpoint: ['count', 'create', 'delete', 'deleteWithFilter', 'getAll', 'getById', 'getFirstN', 'getOne', 'update', 'delete'],
                modelConfig: {},
                expose: [],
                mask: [createDaoParsed<Organization<any>>({
                    // mask ADMIN fields for users all methods
                    for: [{ role: 'user' as any }],
                    mask: () => ({
                        'admin*': true,
                        anotherFieldUserHaveNoAccess: true,
                        teams: [{ 'adm*th': true, name: true }] // mask array type fields, should match adminAuth but not the rest
                    })
                }), createDaoParsed<Organization<any>>({
                    // mask ADMIN fields for users all methods
                    for: [{ role: 'user' as any }],
                    select: () => ({
                        name: true,
                        anotherFieldUserHaveNoAccess: true, // so this should not be masked in the end while admin fields should be
                        teams: [{ name: true, users: true }] // name is supposed to be in the final result
                    })
                }),],
                populate: [],
            } satisfies MongoDaoParsed<OrgModels>
        }
    },
    populateAddrFlatWithModelName: {
        mainDb: {
            user: {
                organization: 'organization'
            },
            organization: {
                'teams[0].users': 'user'
            },
        }
    },
    validation: { mainDb: validationAddr() as any },
}
