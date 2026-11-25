export const probeRequest = 'environment.check'
export const expectedVersion = '2.4.1'

export type ProbeResult = {
  fixture: 'ok' | 'failed'
  cli:
    | { status: 'ok' | 'unexpected-version'; version: string }
    | { status: 'pin-missing' | 'pin-invalid' | 'pin-mismatch' | 'failed' }
}

declare module 'orca' {
  interface PluginRequests {
    'environment.check': { input: Record<string, never>; output: ProbeResult }
  }
}
