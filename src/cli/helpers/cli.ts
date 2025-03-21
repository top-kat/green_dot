
// /!\ TRY TO IMPORT THE LESS POSSIBLE IN THIS FILE /!\ \\
import { C, minMax } from 'topkat-utils'
import pkg from '../../../package.json'



export const terminalCharSize = minMax(process.stdout.columns || 40, 30, 80)




export function cliIntro() {
  const cliVersion = pkg.version
  C.log('\n' + C.dim('='.repeat(terminalCharSize)))
  C.log('\n' + C.green('◉') + ` green_dot ${C.dim(`cli ${' '.repeat((terminalCharSize - 17) - cliVersion.length)}v${cliVersion}`)}\n`)
  C.log(C.dim('='.repeat(terminalCharSize)))
}

export function clearCli() {
  process.stdout.write('\x1Bc')
}

export const wrapCliText = (str: string, width = terminalCharSize) => str.match(new RegExp(`(.{0,${width}})(\\s|$)`, 'g'))?.map(l => l.trim()) || []


//  ╔══╗ ╦    ═╦═   ╔══╗ ╔══╗ ╔══╗ ╔═══
//  ║    ║     ║    ╠══╣ ╠═╦╝ ║ ═╦ ╚══╗
//  ╚══╝ ╚══╝ ═╩═   ╩  ╩ ╩ ╚  ╚══╝ ═══╝

export type ConfigFromCli = { env: 'dev' | 'prod' }

const defaultEnv = { env: 'dev' } satisfies ConfigFromCli


export function cliArgsToEnv(args: Record<string, any>) {

  const argsParsed = { env: 'dev' } as ConfigFromCli

  // TODO test and take in account
  if (args.production === true) argsParsed.env = 'prod'

  process.env.GREEN_DOT_CLI_PARAMS = JSON.stringify(argsParsed)

}

export function getServerConfigFromEnv() {
  return JSON.parse(process.env.GREEN_DOT_CLI_PARAMS || JSON.stringify(defaultEnv)) as ConfigFromCli
}