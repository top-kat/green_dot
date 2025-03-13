#!/usr/bin/env ts-node


import { app, Command } from 'command-line-application'
import { C, objEntries, randomItemInArray, perfTimer } from 'topkat-utils'
import { generateIndexForProjectDb } from '../generate/generateIndexForDb'
import { generateDbCachedFiles, generateDbIndexFile } from '../generate/generateCachedFiles/generateDbCachedFiles'

//  ╦  ╦ ╔══╗ ╔══╗ ╔═══ ═╦═ ╔══╗ ╦╗ ╔
//  ╚╗ ║ ╠═   ╠═╦╝ ╚══╗  ║  ║  ║ ║╚╗║
//   ╚═╝ ╚══╝ ╩ ╚  ═══╝ ═╩═ ╚══╝ ╩ ╚╩

const cliVersion = '1.0.0'

//  ╔══╗ ╔══╗ ╦╗╔╦ ╦╗╔╦ ╔══╗ ╦╗ ╔ ╔═╗  ╔═══
//  ║    ║  ║ ║╚╝║ ║╚╝║ ╠══╣ ║╚╗║ ║  ║ ╚══╗
//  ╚══╝ ╚══╝ ╩  ╩ ╩  ╩ ╩  ╩ ╩ ╚╩ ╚══╝ ═══╝

const commands = {
  build: {
    description: 'Build SDKs and project',
    execute: build,
  },
  clean: {
    description: 'Clean files. Use this if you have problem with build',
    execute: clean,
  },
  generate: {
    description: 'Helps with generating new services (api routes, scheduled jobs...), new database models, new tests...',
    execute: generate,
  },
  // dev: {
  //   description: 'Start a project in dev mode with hot reload',
  //   execute: dev,
  // },
  // start: {
  //   description: 'Start a project in production mode',
  //   execute: start,
  // }
} satisfies Record<string, Omit<Command, 'name'> & { execute: Function }>

//  ╔══╗ ╔══╗ ╔══╗ ╔══╗ ╔══╗ ╔══╗ ╦╗╔╦
//  ╠══╝ ╠═╦╝ ║  ║ ║ ═╦ ╠═╦╝ ╠══╣ ║╚╝║
//  ╩    ╩ ╚  ╚══╝ ╚══╝ ╩ ╚  ╩  ╩ ╩  ╩
C.log('\n' + C.dim('='.repeat(50)))
C.log('\n' + C.green('◉') + ` green_dot ${C.dim(`cli ${' '.repeat(33 - cliVersion.length)}v${cliVersion}`)}\n`)
C.log(C.dim('='.repeat(50)))
C.log('\n🤖 < ' + randomItemInArray(['Welcome on board capitain!', 'What can I do for you today?', 'Hey, what\'s up?', 'Blip...bloup...bip..bip.........', 'Master the CLI you must, young Padawan']) + '\n\n')

const { _command, ...rest } = app({
  name: 'dot',
  description: 'dot CLI from green_dot backend framework',
  examples: objEntries(commands).map(([name, command]) => `dot ${name} # ${command.description}`),
  commands: objEntries(commands).map(([name, command]) => ({ name, ...command, execute: undefined }))
}) as { _command: keyof typeof commands }

commands[_command].execute(rest)




//  ╔══╗ ╔══╗ ╦╗╔╦ ╦╗╔╦ ╔══╗ ╦╗ ╔ ╔═╗  ╔═══
//  ║    ║  ║ ║╚╝║ ║╚╝║ ╠══╣ ║╚╗║ ║  ║ ╚══╗
//  ╚══╝ ╚══╝ ╩  ╩ ╩  ╩ ╩  ╩ ╩ ╚╩ ╚══╝ ═══╝


async function build(props) {

  const build = newBuild()

  await build.step(`Generating indexes for database`, generateIndexForProjectDb)

  await build.step(`Generating types for database`, generateDbCachedFiles)

  build.end(`Successfully built green_dot project`)

}





async function clean(props) {

  await generateDbIndexFile()

  C.success('CLEAN')
}





function generate(props) {
  C.success('GENERATE')
}


//  ╦  ╦ ╔══╗ ╦    ╔══╗ ╔══╗ ╔══╗ ╔═══
//  ╠══╣ ╠═   ║    ╠══╝ ╠═   ╠═╦╝ ╚══╗
//  ╩  ╩ ╚══╝ ╚══╝ ╩    ╚══╝ ╩ ╚  ═══╝


function newBuild() {
  const time = perfTimer()
  return {
    _stepNb: 1,
    _startTime: Date.now(),
    async step(title: string, callback: FunctionGeneric) {
      const t2 = perfTimer()
      C.line(`${this._stepNb}) ${title}`, 50)
      try {
        await callback()
        C.log(C.dim(`\nStep 2 took ${t2.end()}`))
        this._stepNb++
      } catch (err) {
        C.error(false, `Step ${this._stepNb} ERROR`)
        throw err
      }
    },
    end(text: string) {
      C.success(`${text} in ${time.end()}`)
    }
  }
}