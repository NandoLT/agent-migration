import { demoStatus, projects, type DemoProject } from './demo-data'

export type Selection = {
  destinations: Readonly<Record<string, string>>
  ids: readonly string[]
}

export const emptySelection: Selection = { destinations: {}, ids: [] }

export function projectView(selection: Selection, project: DemoProject) {
  const destination = selection.destinations[project.id] ?? project.destinations[0].value
  const threads = project.threads.map((thread) => ({ ...thread, state: demoStatus(thread, destination) }))
  const ready = threads.filter((thread) => thread.state === 'ready')
  const chosen = ready.filter((thread) => selection.ids.includes(thread.id))
  return { project, destination, threads, ready, chosen }
}

export function selectThreads(selection: Selection, project: DemoProject, ids: readonly string[], checked: boolean): Selection {
  const eligible = projectView(selection, project).ready.map((thread) => thread.id)
  const requested = ids.filter((id) => eligible.includes(id))
  return {
    ...selection,
    ids: checked
      ? [...new Set([...selection.ids, ...requested])]
      : selection.ids.filter((id) => !requested.includes(id))
  }
}

export function mapDestination(selection: Selection, project: DemoProject, destination: string): Selection {
  if (destination === projectView(selection, project).destination ||
      !project.destinations.some((option) => option.value === destination)) return selection
  return {
    ids: selection.ids.filter((id) => !project.threads.some((thread) => thread.id === id)),
    destinations: { ...selection.destinations, [project.id]: destination }
  }
}

export function preview(selection: Selection) {
  const chosen = projects.map((project) => projectView(selection, project)).filter((entry) => entry.chosen.length > 0)
  return {
    chosen,
    conversations: chosen.reduce((sum, entry) => sum + entry.chosen.length, 0),
    messages: chosen.reduce((sum, entry) => sum + entry.chosen.reduce((n, thread) => n + thread.messages, 0), 0)
  }
}
