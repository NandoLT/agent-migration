// Exercises the shipped browser bundle without opening histories or connecting to Orca.
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

async function browserTest() {
  const find = (selector) => document.querySelector(selector)
  const step = () => new Promise((resolve) => setTimeout(resolve, 20))
  const expect = (condition, message) => { if (!condition) throw new Error(message) }
  const root = find('#root')
  for (let attempt = 0; !find('.demo-toggle') && attempt < 30; attempt++) await step()
  expect(!find('.project'), 'must not display demo projects without opting in')
  find('.demo-toggle').click()
  await step()
  expect(Boolean(find('.project')), 'React did not mount')

  const routeControls = [...document.querySelectorAll('.route select')]
  expect(routeControls.map((select) => select.value).join('/') === 'OpenAI Codex/OpenCode', 'wrong route selectors')
  expect(!find('.route').textContent.match(/Active \+ archived|Project sessions/i), 'old route captions remain')
  const aurora = find('[aria-controls="group-aurora"]')
  aurora.click()
  await step()
  const mainThread = find('#group-aurora .thread input')
  const imported = find('#group-aurora .status-imported').closest('label').querySelector('input')
  expect(imported.disabled && !imported.checked, 'already imported must be unavailable')
  mainThread.click()
  await step()
  expect(find('.totals').textContent.includes('148 messages'), 'selection did not update total')
  find('.secondary-button').click()
  await step()
  expect(find('.preview-card li')?.textContent === 'Main development thread', 'preview did not show details')

  const mapping = find('[aria-label="Destination for Aurora"]')
  mapping.value = 'aurora-lab'
  mapping.dispatchEvent(new Event('change', { bubbles: true }))
  await step()
  expect(!imported.disabled && !mainThread.checked, 'destination did not reset the group and refresh eligibility')
  imported.click()
  await step()
  expect(find('.totals').textContent.includes('42 messages') && find('.primary-button').disabled,
    'new selection did not update totals or import was enabled')
  find('[aria-controls="group-faro"]').click()
  await step()
  find('#group-faro .thread input').click()
  await step()
  expect(find('[aria-label="Select eligible conversations in Faro"]').indeterminate, 'partial selection needs a mixed checkbox')

  for (const theme of ['light', 'dark']) {
    document.documentElement.className = theme
    for (const width of [320, 400, 600, 900, 1200]) {
      root.style.width = `${width}px`
      const content = find('.panel main')
      content.scrollTop = content.scrollHeight
      const footer = find('.footer').getBoundingClientRect()
      expect(root.scrollWidth <= width && content.scrollWidth <= content.clientWidth,
        `horizontal overflow at ${width}px in ${theme}`)
      expect(footer.bottom <= window.innerHeight && footer.top >= 0, 'footer not visible')
      const workspaceColumns = getComputedStyle(find('.workspace')).gridTemplateColumns.split(' ').length
      expect(workspaceColumns === (width >= 760 ? 2 : 1), `wrong layout at ${width}px`)
    }
  }
  routeControls[0].focus()
  expect(document.activeElement === routeControls[0] && getComputedStyle(routeControls[0]).outlineStyle === 'solid',
    'focused selector needs a visible outline')

  let requests = 0
  window.orca = { plugin: { request: async (name, params) => {
    expect(name === 'codex.scan' && params.root === '/synthetic/codex', 'wrong scan request or root')
    if (++requests === 1) return { status: 'root-unavailable' }
    return {
      status: 'ok', totalThreads: 1, files: 2, skippedEntries: 0, malformedFiles: 0, indexIssues: 0, truncated: false,
      threads: [{
        id: 'thread-a', projectKey: 'project-a', directory: '/synthetic/project', title: 'Synthetic thread',
        kind: 'main', updatedAt: '2026-11-24T00:00:00Z', messages: 3, fragments: 2, archivedFragments: 1
      }]
    }
  } } }
  find('.scan-settings').open = true
  const input = find('.scan-settings input')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '/synthetic/codex')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await step()
  find('.scan').click()
  await step()
  expect(find('[role="alert"]')?.textContent.includes('Could not open'), 'scan errors must be visible')
  find('.scan').click()
  await step()
  expect(find('.scan-project summary')?.textContent.includes('/synthetic/project'), 'missing project in scan results')
  expect(find('.scan-thread')?.textContent.includes('Synthetic thread'), 'missing thread in scan results')
  expect(!find('.demo-chip') && find('.primary-button').disabled && !find('.scan-project input'), 'scan must remain read-only')
}

const work = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'agent-migration-html-test-'))
try {
  const source = join(__dirname, '../../plugin/ui')
  cpSync(source, join(work, 'panel'), { recursive: true })
  const index = join(work, 'panel/index.html')
  writeFileSync(index, readFileSync(index, 'utf8').replace('</body>', `<script>
    (${browserTest.toString()})().then(() => document.body.dataset.testResult = 'pass').catch((error) => {
      document.body.dataset.testResult = 'fail';
      document.body.dataset.testError = error.message;
    });
  </script></body>`))
  const result = spawnSync(process.env.CHROMIUM || 'chromium', [
    '--headless', '--disable-background-networking', '--disable-extensions', '--no-first-run',
    `--user-data-dir=${join(work, 'profile')}`, '--window-size=1320,720',
    '--virtual-time-budget=5000', '--dump-dom', pathToFileURL(index).href
  ], { encoding: 'utf8', timeout: 20000 })
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stderr)
  assert.ok(result.stdout.includes('<body data-test-result="pass"'),
    /<body[^>]+data-test-error="([^"]*)"/.exec(result.stdout)?.[1] || 'browser did not report completion')
  console.log('HTML panel: browser interaction, five widths, light and dark CSS, and fixed footer passed.')
} finally {
  rmSync(work, { recursive: true, force: true })
}
