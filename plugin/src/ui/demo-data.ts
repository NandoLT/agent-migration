export type ThreadStatus = 'ready' | 'imported' | 'excluded' | 'conflict' | 'unverified'

export type DemoThread = {
  id: string
  title: string
  messages: number
  status: ThreadStatus
  byDestination?: Partial<Record<string, ThreadStatus>>
}

export type DemoProject = {
  id: string
  name: string
  destinations: readonly { value: string; label: string }[]
  threads: readonly DemoThread[]
}

export const projects: readonly DemoProject[] = [
  {
    id: 'aurora',
    name: 'Aurora',
    destinations: [
      { value: 'aurora-app', label: 'aurora-app' },
      { value: 'aurora-lab', label: 'aurora-lab' }
    ],
    threads: [
      { id: 'aurora-history', title: 'Main development thread', messages: 148, status: 'ready' },
      {
        id: 'aurora-design',
        title: 'Early design decisions',
        messages: 42,
        status: 'imported',
        byDestination: { 'aurora-lab': 'ready' }
      },
      { id: 'aurora-guardian', title: 'Guardian reviews', messages: 18, status: 'excluded' }
    ]
  },
  {
    id: 'faro',
    name: 'Faro',
    destinations: [{ value: 'faro-web', label: 'faro-web' }],
    threads: [
      { id: 'faro-history', title: 'Website development', messages: 93, status: 'ready' },
      { id: 'faro-release', title: 'Release planning', messages: 27, status: 'ready' }
    ]
  },
  {
    id: 'atlas',
    name: 'Atlas',
    destinations: [{ value: 'atlas-tools', label: 'atlas-tools' }],
    threads: [
      { id: 'atlas-history', title: 'Tooling migration', messages: 61, status: 'conflict' },
      { id: 'atlas-notes', title: 'Research notes', messages: 35, status: 'unverified' }
    ]
  }
]

export function demoStatus(thread: DemoThread, destination: string): ThreadStatus {
  return thread.byDestination?.[destination] ?? thread.status
}
