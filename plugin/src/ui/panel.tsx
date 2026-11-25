import { atom, Button, Heading, plugin, read, set, Stack, Text } from 'orca'
import { expectedVersion, probeRequest, type ProbeResult } from '../protocol'

type PanelState = { status: 'idle' | 'checking' | 'failed' } | { status: 'done'; result: ProbeResult }
const state = atom<PanelState>({ status: 'idle' })

async function check(): Promise<void> {
  if (read(state).status === 'checking') return
  set(state, { status: 'checking' })
  try {
    const result = await plugin.request(probeRequest, {}, { timeoutMs: 5000 })
    set(state, { status: 'done', result })
  } catch {
    set(state, { status: 'failed' })
  }
}

function describeCli(cli: ProbeResult['cli']): string {
  switch (cli.status) {
    case 'ok': return `OpenCode ${cli.version} detected.`
    case 'unexpected-version': return `OpenCode ${cli.version} detected; expected ${expectedVersion}.`
    case 'pin-missing': return 'No local OpenCode executable is pinned. Nothing was run.'
    case 'pin-invalid': return 'The local OpenCode pin is invalid. Nothing was run.'
    case 'pin-mismatch': return 'OpenCode does not match the pinned executable. Nothing was run.'
    case 'failed': return 'Could not check the OpenCode CLI version.'
  }
}

export default function Panel() {
  const current = read(state)
  return (
    <Stack gap="md">
      <Heading>Agent Migration</Heading>
      <Text>This check does not read or import any sessions.</Text>
      <Button disabled={current.status === 'checking'} onPress={check}>Check environment</Button>
      {current.status === 'checking' ? <Text>Checking the local environment…</Text> : null}
      {current.status === 'failed' ? <Text>Could not complete the worker request.</Text> : null}
      {current.status === 'done' ? (
        <Stack gap="sm">
          <Text>{current.result.fixture === 'ok' ? 'Synthetic file verified.' : 'Could not verify the synthetic file.'}</Text>
          <Text>{describeCli(current.result.cli)}</Text>
        </Stack>
      ) : null}
    </Stack>
  )
}
