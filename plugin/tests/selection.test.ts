import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projects } from '../src/ui/demo-data'
import { emptySelection, mapDestination, preview, projectView, selectThreads } from '../src/ui/selection'

const [aurora, faro, atlas] = projects

test('selection cannot add already imported, excluded, conflicting or unverified conversations', () => {
  const selected = [aurora, atlas].reduce(
    (state, project) => selectThreads(state, project, project.threads.map(({ id }) => id), true),
    emptySelection
  )
  assert.deepEqual(selected.ids, ['aurora-history'])
  assert.equal(projectView(selected, aurora).threads[1].state, 'imported')
  assert.equal(projectView(selected, atlas).ready.length, 0)
})

test('bulk and individual selection update preview totals and destinations', () => {
  const selected = selectThreads(selectThreads(emptySelection, aurora, ['aurora-history'], true), faro, ['faro-release'], true)
  const result = preview(selected)
  assert.equal(result.conversations, 2)
  assert.equal(result.messages, 175)
  assert.deepEqual(result.chosen.map(({ destination }) => destination), ['aurora-app', 'faro-web'])
  assert.equal(preview(selectThreads(selected, aurora, ['aurora-history'], false)).messages, 27)
})

test('remapping clears only the affected project and recalculates eligibility', () => {
  const selected = selectThreads(selectThreads(emptySelection, aurora, ['aurora-history'], true), faro, ['faro-release'], true)
  assert.strictEqual(mapDestination(selected, aurora, 'unknown-destination'), selected)
  const mapped = mapDestination(selected, aurora, 'aurora-lab')
  assert.deepEqual(mapped.ids, ['faro-release'])
  assert.equal(projectView(mapped, aurora).threads[1].state, 'ready')
  assert.equal(preview(selectThreads(mapped, aurora, ['aurora-design'], true)).messages, 69)
})
