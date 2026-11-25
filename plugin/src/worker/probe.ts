import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { access, mkdtemp, open, readFile, realpath, rm, rmdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { promisify } from 'node:util'
import { expectedVersion, type ProbeResult } from '../protocol'

const exec = promisify(execFile)
const fixture = 'Agent Migration synthetic probe\n'
const elfMagic = Buffer.from([0x7f, 0x45, 0x4c, 0x46])
const pinFile = new URL('../../.orca/opencode-pin.json', import.meta.url)

type Runner = (path: string, args: string[], options: {
  env: Record<string, string>
  shell: false
  timeout: number
  killSignal: 'SIGKILL'
  maxBuffer: number
  signal?: AbortSignal
}) => Promise<{ stdout: string }>

async function checkFixture(): Promise<boolean> {
  const directory = await mkdtemp(join(tmpdir(), 'agent-migration-probe-'))
  const file = join(directory, 'fixture.txt')
  try {
    await writeFile(file, fixture, { flag: 'wx', mode: 0o600 })
    return (await readFile(file, 'utf8')) === fixture
  } finally {
    await rm(file, { force: true })
    await rmdir(directory)
  }
}

async function matchesPin(path: string, sha256: string, signal?: AbortSignal): Promise<boolean> {
  try {
    if (await realpath(path) !== path) return false
    await access(path, constants.X_OK)
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    try {
      if (!(await file.stat()).isFile()) return false
      const header = Buffer.alloc(elfMagic.length)
      if ((await file.read(header, 0, header.length, 0)).bytesRead !== header.length ||
          !header.equals(elfMagic)) return false
      const hash = createHash('sha256')
      for await (const chunk of file.createReadStream({ start: 0, autoClose: false, signal })) {
        hash.update(chunk)
      }
      return hash.digest('hex') === sha256
    } finally {
      await file.close()
    }
  } catch {
    signal?.throwIfAborted()
    return false
  }
}

export async function checkEnvironment(
  signal?: AbortSignal,
  pinLocation = pinFile,
  run: Runner = exec
): Promise<ProbeResult> {
  signal?.throwIfAborted()
  const fixtureStatus = (await checkFixture().catch(() => false)) ? 'ok' : 'failed'
  let pin: unknown
  try {
    pin = JSON.parse(await readFile(pinLocation, { encoding: 'utf8', signal }))
  } catch (error) {
    signal?.throwIfAborted()
    const missing = (error as NodeJS.ErrnoException).code === 'ENOENT'
    return { fixture: fixtureStatus, cli: { status: missing ? 'pin-missing' : 'pin-invalid' } }
  }
  if (!pin || typeof pin !== 'object' || !('path' in pin) || !('sha256' in pin) ||
      typeof pin.path !== 'string' || !isAbsolute(pin.path) || pin.path.includes('\0') ||
      typeof pin.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(pin.sha256)) {
    return { fixture: fixtureStatus, cli: { status: 'pin-invalid' } }
  }
  if (!(await matchesPin(pin.path, pin.sha256, signal))) {
    return { fixture: fixtureStatus, cli: { status: 'pin-mismatch' } }
  }

  try {
    signal?.throwIfAborted()
    const { stdout } = await run(pin.path, ['--version'], {
      env: {},
      shell: false,
      timeout: 2500,
      killSignal: 'SIGKILL',
      maxBuffer: 4096,
      signal
    })
    const version = /^opencode v?(\d{1,6}\.\d{1,6}\.\d{1,6})$/.exec(stdout.trim())?.[1]
    if (!version) return { fixture: fixtureStatus, cli: { status: 'failed' } }
    return {
      fixture: fixtureStatus,
      cli: { status: version === expectedVersion ? 'ok' : 'unexpected-version', version }
    }
  } catch {
    signal?.throwIfAborted()
    // Do not send subprocess stdout, stderr, error messages or filesystem paths to the panel.
    return { fixture: fixtureStatus, cli: { status: 'failed' } }
  }
}
