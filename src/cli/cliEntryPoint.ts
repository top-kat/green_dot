#!/usr/bin/env ts-node
/* eslint-disable no-console */

// /!\ TRY TO IMPORT THE LESS POSSIBLE IN THIS FILE /!\ \\
// because we don't want a 500MB node_modules tree
// to be loaded just for a very simple process launcher
import { app, Command } from 'command-line-application'
import { clearCli, cliIntro, cliArgsToEnv } from './helpers/cli'
import type { ChildProcessCommands } from './dot.command' // is not imported at runtime
import { startChildProcess } from './helpers/processManager'
import { C } from 'topkat-utils'
// /!\ TRY TO IMPORT THE LESS POSSIBLE IN THIS FILE /!\ \\


//  ╔══╗ ╔══╗ ╦╗╔╦ ╦╗╔╦ ╔══╗ ╦╗ ╔ ╔═╗  ╔═══
//  ║    ║  ║ ║╚╝║ ║╚╝║ ╠══╣ ║╚╗║ ║  ║ ╚══╗
//  ╚══╝ ╚══╝ ╩  ╩ ╩  ╩ ╩  ╩ ╩ ╚╩ ╚══╝ ═══╝

const commands = {
  build: {
    description: 'Build SDKs and project',
    steps: [
      'build'
    ],
    exitAfter: true,
  },
  clean: {
    description: 'Clean files. Use this if you have problem with build',
    steps: [
      'clean'
    ],
    exitAfter: true,
  },
  dev: {
    description: 'Start a server in dev mode with hot reloading',
    steps: [
      'build',
      'startServer'
    ],
    exitAfter: true,
  },
  // generate: {
  //   description: 'Helps with generating new services (api routes, scheduled jobs...), new database models, new tests...',
  //   execute: buildCommand,
  // },
} satisfies CommandPlus



//  ╔══╗ ╔══╗ ╔══╗ ╔══╗ ╔══╗ ╔══╗ ╦╗╔╦
//  ╠══╝ ╠═╦╝ ║  ║ ║ ═╦ ╠═╦╝ ╠══╣ ║╚╝║
//  ╩    ╩ ╚  ╚══╝ ╚══╝ ╩ ╚  ╩  ╩ ╩  ╩

async function start() {
  try {

    clearCli()
    cliIntro()

    const { _command, ...args } = app(
      {
        name: 'dot',
        description: 'dot CLI from green_dot backend framework',
        examples: Object.entries(commands).map(([name, command]) => `dot ${name} # ${command.description}`),
        commands: Object.entries(commands).map(([name, command]) => ({ name, ...command, steps: undefined })),
      }, {
      error: 'throw'
    }) as { _command: keyof typeof commands }

    cliArgsToEnv(args)


    const c = commands[_command] as any as Required<CommandPlus[keyof CommandPlus]>

    let next: 'reload' | 'continue' = 'continue'

    do {
      for (const step of c.steps) {
        next = await new Promise(resolve => {
          startChildProcess([__dirname + '/dot.command.ts', step], code => {
            if (code !== 0) {
              process.stdout.write('\x1Bc')
              resolve('reload')
            } else {
              resolve('continue')
            }
          })
        })
        if (next === 'reload') break
      }
    } while (next === 'reload')

    if (c.exitAfter) process.exit(0)

  } catch (err) {
    const msg = err && err.message
    if (msg && msg.includes('Found unknown command')) {
      C.error(false, msg + '\n')
      C.info(`Available commands: ${Object.keys(commands).join(', ')}`)
      C.log('\n')
    } else C.error(err)
    process.exit(1)
  }
}


start()


//  ╦  ╦ ╔══╗ ╦    ╔══╗ ╔══╗ ╔══╗ ╔═══
//  ╠══╣ ╠═   ║    ╠══╝ ╠═   ╠═╦╝ ╚══╗
//  ╩  ╩ ╚══╝ ╚══╝ ╩    ╚══╝ ╩ ╚  ═══╝

type CommandPlus = Record<string, Omit<Command, 'name'> & {
  exitAfter?: boolean,
  steps: ChildProcessCommands[]
}>