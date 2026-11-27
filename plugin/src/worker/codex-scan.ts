import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { open, opendir, realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import type { ScannedThread, ScanResult, ThreadKind } from '../protocol'

const maxLine = 1024 * 1024
const maxBytes = 2 * 1024 ** 3
const maxEntries = 12000
const maxThreads = 250
const maxMessageIds = 200000
const decoder = new TextDecoder('utf-8', { fatal: true })

type RecordValue = Record<string, unknown>
type Thread = Omit<ScannedThread, 'messages' | 'messagesWithoutId' | 'title' | 'projectKey'> & {
  createdAt: string | null
  ids: Map<string, string>
  missingIds: number
}

function record(value: unknown): RecordValue | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : undefined
}

function label(value: unknown, limit: number): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return
  return value.replace(/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, ' ').trim().slice(0, limit) || undefined
}

function identifier(value: unknown): string | undefined {
  return typeof value === 'string' && /^[\w-]{1,128}$/.test(value) ? value : undefined
}

function timestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function classify(meta: RecordValue): ThreadKind {
  const source = record(meta.source)
  if (meta.thread_source === 'guardian_review' || source?.internal === 'guardian' ||
      record(source?.subagent)?.other === 'guardian') return 'guardian'
  if (meta.thread_source === 'subagent' || source?.subagent !== undefined) return 'subagent'
  return meta.source === 'vscode' || meta.source === 'cli' ? 'main' : 'unknown'
}

function messageFingerprint(role: string, content: unknown) {
  const canonical = JSON.stringify([role, content], (_key, value: unknown) => {
    const object = record(value)
    return object ? Object.fromEntries(Object.keys(object).sort().map((key) => [key, object[key]])) : value
  })
  return createHash('sha256').update(canonical).digest('hex')
}

async function openVerified(path: string, directory: boolean) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK |
    (directory ? constants.O_DIRECTORY : 0))
  try {
    const stat = await file.stat()
    // Verify the opened object, not just its name before opening. Never read through a replaced parent.
    if (await realpath(`/proc/self/fd/${file.fd}`) !== path || !(directory ? stat.isDirectory() : stat.isFile())) {
      throw new Error('Unexpected path or file type')
    }
    return file
  } catch (error) {
    await file.close()
    throw error
  }
}

// Bounded line buffering: oversized lines are reported and discarded until the next newline.
async function* lines(
  path: string,
  takeBytes: (length: number) => boolean,
  signal?: AbortSignal
): AsyncGenerator<RecordValue | undefined> {
  const file = await openVerified(path, false)
  try {
    let parts: Buffer[] = []
    let length = 0
    function consume(part: Buffer) {
      length += part.length
      if (length <= maxLine) parts.push(part)
      else parts = []
    }
    function parse() {
      try {
        if (length > maxLine) return undefined
        return record(JSON.parse(decoder.decode(Buffer.concat(parts, length))))
      } catch {
        return undefined
      } finally {
        parts = []
        length = 0
      }
    }
    for await (const chunk of file.createReadStream({ autoClose: false, signal })) {
      if (!takeBytes(chunk.length)) break
      let start = 0
      for (let end = chunk.indexOf(10); end !== -1; end = chunk.indexOf(10, start)) {
        consume(chunk.subarray(start, end))
        yield parse()
        start = end + 1
      }
      if (start < chunk.length) consume(chunk.subarray(start))
    }
    if (length) yield parse()
  } finally {
    await file.close()
  }
}

export async function scanCodex(input: unknown, signal?: AbortSignal): Promise<ScanResult> {
  signal?.throwIfAborted()
  const params = record(input)
  const location = params?.root
  if (!params || (location !== undefined && (typeof location !== 'string' ||
      location.length > 4096 || location.includes('\0') || !isAbsolute(location)))) {
    return { status: 'invalid-root' }
  }

  const requested = location ?? (process.env.CODEX_HOME || join(homedir(), '.codex'))
  if (!isAbsolute(requested)) return { status: 'invalid-root' }
  let root: string
  try {
    root = await realpath(requested)
    if (root === '/' || root === await realpath(homedir())) return { status: 'invalid-root' }
    const directory = await openVerified(root, true)
    await directory.close()
  } catch {
    signal?.throwIfAborted()
    return { status: 'root-unavailable' }
  }

  const titles = new Map<string, string>()
  const threads = new Map<string, Thread>()
  let files = 0
  let malformedFiles = 0
  let skippedEntries = 0
  let indexIssues = 0
  let entries = 0
  let bytes = 0
  let ids = 0
  let limitReached = false

  function takeBytes(length: number) {
    bytes += length
    if (bytes > maxBytes) limitReached = true
    return !limitReached
  }

  try {
    for await (const row of lines(join(root, 'session_index.jsonl'), takeBytes, signal)) {
      const id = identifier(row?.id)
      const title = label(row?.thread_name, 160)
      if (!id) indexIssues++
      else if (title) titles.set(id, title)
      if (titles.size >= maxEntries) {
        indexIssues++
        break
      }
    }
  } catch (error) {
    signal?.throwIfAborted()
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') indexIssues++
  }

  async function scanFile(path: string, archived: boolean) {
    files++
    let thread: Thread | undefined
    let malformed = false
    try {
      for await (const row of lines(path, takeBytes, signal)) {
        signal?.throwIfAborted()
        const payload = record(row?.payload)
        if (!thread) {
          const id = identifier(payload?.id)
          if (row?.type !== 'session_meta' || !id || !payload) break
          const kind = classify(payload)
          const parentId = identifier(record(record(record(payload.source)?.subagent)?.thread_spawn)?.parent_thread_id) ?? null
          const date = timestamp(payload.timestamp)
          const directory = typeof payload.cwd === 'string' && isAbsolute(payload.cwd)
            ? resolve(payload.cwd) : null
          thread = threads.get(id)
          if (!thread) {
            thread = {
              id, directory, kind, parentId, createdAt: date, updatedAt: date, fragments: 0,
              archivedFragments: 0, incomplete: false, multipleDirectories: false,
              ids: new Map(), missingIds: 0
            }
            threads.set(id, thread)
          } else {
            if (parentId && !thread.parentId) thread.parentId = parentId
            if (thread.kind !== kind) {
              thread.kind = 'unknown'
              malformed = true
            }
            if (directory && thread.directory && directory !== thread.directory) thread.multipleDirectories = true
            if (date && (!thread.createdAt || date < thread.createdAt)) {
              thread.createdAt = date
              thread.directory = directory ?? thread.directory
            } else if (directory && (!thread.directory || (date === thread.createdAt && directory < thread.directory))) {
              thread.directory = directory
            }
          }
          thread.fragments++
          if (archived) thread.archivedFragments++
          if (date && (!thread.updatedAt || date > thread.updatedAt)) thread.updatedAt = date
          continue
        }
        if (!row || (row.type === 'session_meta' && payload?.id !== thread.id)) {
          malformed = true
          if (row?.type === 'session_meta') break
          continue
        }
        if (row.type !== 'response_item' || payload?.type !== 'message' ||
            (payload.role !== 'user' && payload.role !== 'assistant')) continue
        const date = timestamp(row.timestamp)
        if (date && (!thread.updatedAt || date > thread.updatedAt)) thread.updatedAt = date
        const id = identifier(payload.id)
        if (!id) {
          thread.missingIds++
          continue
        }
        const fingerprint = messageFingerprint(payload.role, payload.content)
        const existing = thread.ids.get(id)
        if (existing && existing !== fingerprint) malformed = true
        if (!existing) {
          thread.ids.set(id, fingerprint)
          if (++ids >= maxMessageIds) {
            limitReached = true
            break
          }
        }
      }
    } catch {
      signal?.throwIfAborted()
      malformed = true
    }
    if (thread && (malformed || limitReached)) thread.incomplete = true
    if (!thread || malformed) malformedFiles++
  }

  async function walk(path: string, archived: boolean, depth: number) {
    if (depth > 12) {
      skippedEntries++
      return
    }
    try {
      const directory = await openVerified(path, true)
      try {
        const children = await opendir(`/proc/self/fd/${directory.fd}`)
        for await (const child of children) {
          signal?.throwIfAborted()
          if (++entries > maxEntries || limitReached) {
            limitReached = true
            break
          }
          const childPath = join(path, child.name)
          if (child.isSymbolicLink()) skippedEntries++
          else if (child.isDirectory()) await walk(childPath, archived, depth + 1)
          else if (child.name.endsWith('.jsonl')) {
            if (child.isFile()) await scanFile(childPath, archived)
            else skippedEntries++
          }
        }
      } finally {
        await directory.close()
      }
    } catch (error) {
      signal?.throwIfAborted()
      if (depth || (error as NodeJS.ErrnoException).code !== 'ENOENT') skippedEntries++
    }
  }

  await walk(join(root, 'sessions'), false, 0)
  if (!limitReached) await walk(join(root, 'archived_sessions'), true, 0)
  signal?.throwIfAborted()
  const results = [...threads.values()]
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || a.id.localeCompare(b.id))
    .slice(0, maxThreads)
    .map(({ createdAt: _createdAt, ids, missingIds, ...thread }) => ({
      ...thread,
      projectKey: thread.directory ? createHash('sha256').update(thread.directory).digest('hex') : null,
      directory: label(thread.directory, 320) ?? null,
      incomplete: thread.incomplete || limitReached,
      title: titles.get(thread.id) ?? 'Untitled conversation',
      messages: ids.size + missingIds,
      messagesWithoutId: missingIds
    }))
  return {
    status: 'ok', threads: results, totalThreads: threads.size, files, malformedFiles,
    skippedEntries, indexIssues, truncated: limitReached || threads.size > maxThreads
  }
}
