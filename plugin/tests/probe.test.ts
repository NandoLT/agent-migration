import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, realpath, rm, rmdir, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { checkEnvironment } from '../src/worker/probe'

const unexpectedRun = async (): Promise<never> => assert.fail('no subprocess was expected')

async function withPin(
  check: (fixture: { path: string; sha256: string; location: URL; write: (pin: unknown) => Promise<void> }) => Promise<void>
) {
  const path = await realpath('/usr/bin/true')
  const sha256 = createHash('sha256').update(await readFile(path)).digest('hex')
  const directory = await mkdtemp(join(tmpdir(), 'agent-migration-test-'))
  const location = pathToFileURL(join(directory, 'pin.json'))
  try {
    await check({ path, sha256, location, write: (pin) => writeFile(location, JSON.stringify(pin)) })
  } finally {
    await rm(location, { force: true })
    await rmdir(directory)
  }
}

test('verifies the synthetic file and runs only the pinned path with --version and no inherited environment', async () => {
  await withPin(async ({ path, sha256, location, write }) => {
    await write({ path, sha256 })
    let invocations = 0
    const result = await checkEnvironment(undefined, location, async (binary, args, options) => {
      invocations++
      assert.equal(binary, path)
      assert.deepEqual(args, ['--version'])
      assert.deepEqual(options.env, {})
      assert.equal(options.shell, false)
      return { stdout: 'opencode v2.4.1\n' }
    })
    assert.equal(invocations, 1)
    assert.deepEqual(result, { fixture: 'ok', cli: { status: 'ok', version: '2.4.1' } })
  })
})

test('does not run anything without a pin or with an invalid pin', async () => {
  await withPin(async ({ sha256, location, write }) => {
    assert.deepEqual((await checkEnvironment(undefined, location, unexpectedRun)).cli, { status: 'pin-missing' })
    await write({ path: 'opencode', sha256 })
    assert.deepEqual((await checkEnvironment(undefined, location, unexpectedRun)).cli, { status: 'pin-invalid' })
  })
})

test('does not run an executable whose hash changed', async () => {
  await withPin(async ({ path, location, write }) => {
    await write({ path, sha256: '0'.repeat(64) })
    assert.deepEqual((await checkEnvironment(undefined, location, unexpectedRun)).cli, { status: 'pin-mismatch' })
  })
})

test('does not follow a symlink or launch a script, even with the right bytes', async () => {
  await withPin(async ({ path, sha256, location, write }) => {
    const link = new URL('./link', location)
    const launcher = new URL('./launcher', location)
    const script = '#!/bin/sh\nexit 0\n'
    try {
      await symlink(path, link)
      await write({ path: fileURLToPath(link), sha256 })
      assert.deepEqual((await checkEnvironment(undefined, location, unexpectedRun)).cli, { status: 'pin-mismatch' })
      await writeFile(launcher, script, { mode: 0o700 })
      await write({ path: fileURLToPath(launcher), sha256: createHash('sha256').update(script).digest('hex') })
      assert.deepEqual((await checkEnvironment(undefined, location, unexpectedRun)).cli, { status: 'pin-mismatch' })
    } finally {
      await rm(link, { force: true })
      await rm(launcher, { force: true })
    }
  })
})

test('reports an unexpected version and does not expose unexpected output or errors', async () => {
  await withPin(async ({ path, sha256, location, write }) => {
    await write({ path, sha256 })
    const check = (stdout: string) => checkEnvironment(undefined, location, async () => ({ stdout }))
    assert.deepEqual((await check('opencode v2.1.2\n')).cli, { status: 'unexpected-version', version: '2.1.2' })
    assert.deepEqual((await check('synthetic private output')).cli, { status: 'failed' })
    const failed = await checkEnvironment(undefined, location, async () => { throw new Error('synthetic private error') })
    assert.deepEqual(failed.cli, { status: 'failed' })
  })
})

test('stops if the request is already cancelled', async () => {
  await assert.rejects(checkEnvironment(AbortSignal.abort()), { name: 'AbortError' })
})
