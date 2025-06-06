import { documentation, docOneLine } from './doc.js'
import { newPlugin } from '../newPlugin.js'
import { GDmanagedLogin, Name } from './GDmanagedLogin.js'
import { defaultConfig, PluginUserConfig } from './config.js'

const plugin = newPlugin<Name, PluginUserConfig, typeof GDmanagedLogin>({
  name: 'GDmanagedLogin',
  version: '1.0.0',
  defaultConfig,
  documentation,
  docOneLine,
  addToVariablesInNewProjectTemplate: {
    addToEnvVariableImports: [`JWT_SECRET = 'TODOreplaceThisStringWithYourTestSecret'`],
    instanciatePluginInAppConfig: ({ roles }) => `{
      enable: true,
      jwtSecret: JWT_SECRET,
      cookieProductionDomain: '.myDomain.com',
      loginConfigPerRole: {${roles.map(r => `
        ${r}: {
          emailLogin: true,
          loginOnValidateToken: true,
        },`).join('')}
      },
      sendEmail(ctx, emailType, encodedToken, user, additionalParams, newEmail) {
        // TODO manage sending credential emails here
      },
      async sendPasswordUpdatedMailConfirmation(ctx, user) {
        // TODO ma,age sending updated mail here
      },
      async sendEmailUpdatedMailConfirmation(ctx, { oldEmail }) {
        // TODO ma,age sending updated mail here
      }
}`,
  },
  plugin: GDmanagedLogin,
})

type RR = InstanceType<typeof plugin['plugin']>

export default plugin

export { JWTdata } from './userAuthenticationTokenService.js'
export { GDmanagedLogin } from './GDmanagedLogin.js'
export { GDmanagedLoginSendEmailFunction, GDmanagedLoginSendEmailUpdatedMailConfirmationFunction } from './config.js'
export { gdManagedLoginEmailTypes, GDmanagedLoginEmailTypes } from './constants.js'