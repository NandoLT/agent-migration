import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'
import { scanCodex } from '../src/worker/codex-scan'

async function fixture(t: TestContext) {
  const base = await mkdtemp(join(tmpdir(), 'agent-migration-codex-'))
  t.after(() => rm(base, { recursive: true, force: true }))
  const root = join(await realpath(base), 'codex')
  await mkdir(join(root, 'sessions', '2026', '11'), { recursive: true })
  await mkdir(join(root, 'archived_sessions'))
  return root
}

const metadata = (id: string, source: unknown = 'vscode', cwd = '/example/a', timestamp = '2026-11-20T10:00:00Z') =>
  ({ type: 'session_meta', payload: { id, source, cwd, timestamp } })
const message = (id?: string, role = 'user', text = 'synthetic transcript text') =>
  ({ type: 'response_item', timestamp: '2026-11-22T14:30:00+01:00',
    payload: { type: 'message', id, role, content: [{ type: 'input_text', text }] } })
const jsonl = (rows: unknown[]) => rows.map((row) => JSON.stringify(row)).join('\n')

test('joins active and archived fragments by metadata ID without merging unrelated threads in the same project', async (t) => {
  const root = await fixture(t)
  const active = join(root, 'sessions/2026/11/random-name.jsonl')
  const duplicate = message('msg-1')
  const original = jsonl([metadata('thread-a'), duplicate, metadata('thread-a'), message('omit', 'developer')])
  await writeFile(active, original)
  await writeFile(join(root, 'archived_sessions', 'other-name.jsonl'), jsonl([
    metadata('thread-a', 'vscode', '/example/b', '2026-11-21T10:00:00Z'),
    { ...duplicate, payload: { ...duplicate.payload, content: [{ text: 'synthetic transcript text', type: 'input_text' }] } },
    message(undefined, 'assistant')
  ]))
  await writeFile(join(root, 'sessions', 'cli.jsonl'), jsonl([metadata('thread-b', 'cli')]))
  await writeFile(join(root, 'session_index.jsonl'), jsonl([{ id: 'thread-a', thread_name: 'Prueba Ω' }]))
  const result = await scanCodex({ root })
  assert.equal(result.status, 'ok')
  assert.equal(result.totalThreads, 2)
  assert.equal(result.malformedFiles, 0)
  const [main, cli] = result.threads
  assert.deepEqual(main, {
    id: 'thread-a', kind: 'main', directory: '/example/a', projectKey: cli.projectKey,
    title: 'Prueba Ω', parentId: null, messages: 2, messagesWithoutId: 1, fragments: 2,
    archivedFragments: 1, updatedAt: '2026-11-22T13:30:00.000Z', incomplete: false, multipleDirectories: true
  })
  assert.equal(cli.kind, 'main')
  assert.equal(cli.title, 'Untitled conversation')
  assert.ok(!JSON.stringify(result).includes('synthetic transcript text'))
  assert.equal(await readFile(active, 'utf8'), original)
})

test('reports damaged records, conflicting duplicates and auxiliary sessions without following symlinks', async (t) => {
  const root = await fixture(t)
  await writeFile(join(root, 'auth.json'), jsonl([metadata('not-a-session')]))
  await writeFile(join(root, 'sessions', 'invalid.jsonl'), '{bad first row')
  await writeFile(join(root, 'sessions', 'partial.jsonl'), `${jsonl([
    metadata('partial'), message('same'), message('same', 'assistant'), message('other')
  ])}\n${'x'.repeat(1024 * 1024 + 1)}\n${JSON.stringify(message('last'))}`)
  await writeFile(join(root, 'sessions', 'subagent.jsonl'), jsonl([
    metadata('child', { subagent: { thread_spawn: { parent_thread_id: 'partial' } } })
  ]))
  await writeFile(join(root, 'archived_sessions', 'guardian.jsonl'), jsonl([metadata('guardian', { subagent: { other: 'guardian' } })]))
  await writeFile(join(root, 'sessions', 'unknown.jsonl'), jsonl([metadata('unknown', 'other')]))
  await symlink(join(root, 'auth.json'), join(root, 'sessions', 'linked.jsonl'))
  await symlink(join(root, '..'), join(root, 'sessions', 'linked-folder'))
  await symlink(join(root, 'auth.json'), join(root, 'session_index.jsonl'))
  const result = await scanCodex({ root })
  assert.equal(result.status, 'ok')
  assert.equal(result.files, 5)
  assert.equal(result.malformedFiles, 2)
  assert.equal(result.skippedEntries, 2)
  assert.equal(result.indexIssues, 1)
  assert.deepEqual(result.threads.map(({ kind }) => kind).sort(), ['guardian', 'main', 'subagent', 'unknown'])
  assert.equal(result.threads.find(({ id }) => id === 'child')?.parentId, 'partial')
  assert.equal(result.threads.find(({ id }) => id === 'partial')?.messages, 3)
  assert.equal(result.threads.find(({ id }) => id === 'partial')?.incomplete, true)
})

test('rejects broad, relative and missing paths, and honours cancellation', async (t) => {
  const root = await fixture(t)
  assert.deepEqual(await scanCodex({ root: '/' }), { status: 'invalid-root' })
  assert.deepEqual(await scanCodex({ root: './codex' }), { status: 'invalid-root' })
  assert.deepEqual(await scanCodex({ root: join(root, 'missing') }), { status: 'root-unavailable' })
  await assert.rejects(scanCodex({ root }, AbortSignal.abort()), { name: 'AbortError' })
})
