export const probeRequest = 'environment.check'
export const expectedVersion = '2.4.1'
export const scanRequest = 'codex.scan'

export type ThreadKind = 'main' | 'subagent' | 'guardian' | 'unknown'

export type ScannedThread = {
  id: string
  title: string
  directory: string | null
  projectKey: string | null
  kind: ThreadKind
  parentId: string | null
  updatedAt: string | null
  messages: number
  messagesWithoutId: number
  fragments: number
  archivedFragments: number
  multipleDirectories: boolean
  incomplete: boolean
}

export type ScanResult =
  | { status: 'invalid-root' | 'root-unavailable' }
  | {
    status: 'ok'
    threads: ScannedThread[]
    totalThreads: number
    files: number
    malformedFiles: number
    skippedEntries: number
    indexIssues: number
    truncated: boolean
  }

export type ProbeResult = {
  fixture: 'ok' | 'failed'
  cli:
    | { status: 'ok' | 'unexpected-version'; version: string }
    | { status: 'pin-missing' | 'pin-invalid' | 'pin-mismatch' | 'failed' }
}

declare module 'orca' {
  interface PluginRequests {
    'environment.check': { input: Record<string, never>; output: ProbeResult }
    'codex.scan': { input: { root?: string }; output: ScanResult }
  }
}
