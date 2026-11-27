import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { scanRequest, type ScanResult } from '../protocol'
import { projects, type ThreadStatus } from './demo-data'
import { ScanResults } from './scan-results'
import { emptySelection, mapDestination, preview, projectView, selectThreads } from './selection'

type IconName = 'transfer' | 'code' | 'terminal' | 'chevron' | 'folder' | 'refresh' | 'sliders' | 'preview' | 'download'

const paths: Record<IconName, string> = {
  transfer: 'M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4',
  code: 'm8 6-6 6 6 6m8-12 6 6-6 6m-2-15-4 18',
  terminal: 'm4 6 6 6-6 6m9 0h7',
  chevron: 'm6 9 6 6 6-6',
  folder: 'M3 19V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z',
  refresh: 'M20 8a8 8 0 1 0 0 8M20 3v5h-5',
  sliders: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  preview: 'M6 3h9l3 3v15H6zm3 8h6m-6 4h6',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5'
}

function Icon({ name }: { name: IconName }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>
}

const statuses: Record<ThreadStatus, string> = {
  ready: 'Ready', imported: 'Already imported', excluded: 'Excluded',
  conflict: 'Conflict', unverified: 'Not verified'
}
const safeguards = [
  ['Import native conversations', 'Selected supported messages will be imported as native OpenCode conversations.'],
  ['Preserve original sessions', 'Source files are never changed.'],
  ['Merge session fragments', 'Fragments of the same conversation are combined.'],
  ['Exclude Guardian reviews', 'Guardian and subagent histories remain in the source.'],
  ['Create backup before importing', 'Back up the destination privately before writing.'],
  ['Prevent duplicate imports', 'Verified duplicates are blocked for the selected destination.']
]
const sources = ['OpenAI Codex'] as const
const targets = ['OpenCode'] as const

function numberOf(value: number, unit: string) {
  return `${value.toLocaleString('en-US')} ${unit}${value === 1 ? '' : 's'}`
}

function Route({ title, icon, options }: { title: string; icon: IconName; options: readonly string[] }) {
  return (
    <label className="route-item">
      <span className="route-label">{title}</span>
      <span className="route-control">
        <span className="icon-tile"><Icon name={icon} /></span>
        <select defaultValue={options[0]}>
          {options.map((option) => <option key={option}>{option}</option>)}
        </select>
        <span className="select-chevron"><Icon name="chevron" /></span>
      </span>
    </label>
  )
}

function SectionHeading({ icon, children }: { icon?: IconName; children: ReactNode }) {
  return <h2 className="section-title">{icon && <Icon name={icon} />}{children}</h2>
}

type ProjectView = ReturnType<typeof projectView>

function ProjectGroup({ view, expanded, toggle, choose, map }: {
  view: ProjectView
  expanded: boolean
  toggle: () => void
  choose: (ids: readonly string[], checked: boolean) => void
  map: (value: string) => void
}) {
  const { project, chosen, ready, threads, destination } = view
  const groupCheckbox = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (groupCheckbox.current) groupCheckbox.current.indeterminate = chosen.length > 0 && chosen.length < ready.length
  }, [chosen.length, ready.length])

  return (
    <article className="project">
      <div className="project-header">
        <input ref={groupCheckbox} type="checkbox" aria-label={`Select eligible conversations in ${project.name}`}
          checked={ready.length > 0 && chosen.length === ready.length} disabled={!ready.length}
          onChange={(event) => choose(ready.map(({ id }) => id), event.currentTarget.checked)} />
        <button type="button" className="project-toggle" aria-expanded={expanded}
          aria-controls={`group-${project.id}`} onClick={toggle}>
          <Icon name="folder" />
          <span className="project-title">
            <strong>{project.name}</strong>
            <small>{chosen.length} selected · {ready.length} available</small>
          </span>
          <span className="disclosure"><Icon name="chevron" /></span>
        </button>
      </div>
      <div className="project-body" id={`group-${project.id}`} hidden={!expanded}>
        {threads.map((thread) => {
          const blocked = thread.state !== 'ready'
          return (
            <label className={`thread${blocked ? ' thread-blocked' : ''}`} key={thread.id}>
              <input type="checkbox" checked={chosen.some((entry) => entry.id === thread.id)}
                disabled={blocked}
                onChange={(event) => choose([thread.id], event.currentTarget.checked)} />
              <span className="thread-title">
                <span>{thread.title}</span>
                <small>{numberOf(thread.messages, 'message')}</small>
              </span>
              <span className={`status status-${thread.state}`}>{statuses[thread.state]}</span>
            </label>
          )
        })}
        <label className="mapping">
          <span>Project destination</span>
          <span className="mapping-control">
            <select aria-label={`Destination for ${project.name}`} value={destination} onChange={(event) => map(event.currentTarget.value)}>
              {project.destinations.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <span className="select-chevron"><Icon name="chevron" /></span>
          </span>
        </label>
      </div>
    </article>
  )
}

function Options() {
  const [open, setOpen] = useState(false)
  return (
    <section className="surface options" data-open={open}>
      <button type="button" className="options-toggle" onClick={() => setOpen(!open)}
        aria-expanded={open} aria-controls="migration-safeguards">
        <Icon name="sliders" /><strong>Migration options</strong>
        <span className="disclosure"><Icon name="chevron" /></span>
      </button>
      <div className="options-heading"><SectionHeading icon="sliders">Migration options</SectionHeading></div>
      <div className="option-list" id="migration-safeguards">
        <p className="quiet">Required for real imports</p>
        {safeguards.map(([label, description]) => (
          <label key={label} title={description}><input type="checkbox" disabled checked readOnly />{label}</label>
        ))}
        <label title="Not available in this preview"><input type="checkbox" disabled />Generate transcript <small>Later</small></label>
      </div>
    </section>
  )
}

function Panel() {
  const [selection, setSelection] = useState(emptySelection)
  const [groups, setGroups] = useState<readonly string[]>([])
  const [demo, setDemo] = useState(false)
  const [sourceRoot, setSourceRoot] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState<ScanResult | null>(null)
  const [scanError, setScanError] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const totals = preview(selection)
  const expanded = demo && showDetails && totals.conversations > 0
  const previewRef = useRef<HTMLElement>(null)

  async function scan() {
    const host = (window as Window & { orca?: {
      plugin: { request(name: typeof scanRequest, data: { root?: string }, options: { timeoutMs: number }): Promise<ScanResult> }
    } }).orca
    setDemo(false)
    setScanned(null)
    setScanError('')
    setScanning(true)
    try {
      if (!host) {
        setScanError('Codex scanning is available inside Orca.')
        return
      }
      const result = await host.plugin.request(scanRequest, sourceRoot ? { root: sourceRoot } : {}, { timeoutMs: 120000 })
      if (result.status === 'ok') setScanned(result)
      else setScanError(result.status === 'invalid-root'
        ? 'Enter an absolute path to the Codex data folder, or leave it blank to use the default.'
        : 'Could not open the Codex data folder. Check the location and permissions.')
    } catch {
      setScanError('The scan did not finish. Try again or choose a smaller Codex data folder.')
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    if (expanded) previewRef.current?.focus({ preventScroll: true })
    if (expanded) previewRef.current?.scrollIntoView({ block: 'nearest' })
  }, [expanded])

  const totalsText = `${numberOf(totals.chosen.length, 'project')} · ${numberOf(totals.conversations, 'conversation')} · ${numberOf(totals.messages, 'message')}`

  return (
    <div className="panel">
      <main>
        <header className="heading">
          <span className="brand-icon"><Icon name="transfer" /></span>
          <div className="heading-text">
            <h1>Agent Migration</h1>
            <p>Move conversations between agents.</p>
          </div>
          {demo && <span className="demo-chip">Demo data</span>}
          <button type="button" className="scan" aria-label="Scan Codex sessions"
            disabled={scanning} onClick={scan}>
            <Icon name="refresh" /><span>{scanning ? 'Scanning…' : 'Scan'}</span>
          </button>
        </header>

        <div className="route" aria-label="Migration route">
          <Route title="Source" icon="code" options={sources} />
          <span className="route-arrow"><Icon name="transfer" /></span>
          <Route title="Destination" icon="terminal" options={targets} />
        </div>
        <details className="surface scan-settings">
          <summary>Scan location</summary>
          <label>Codex data folder
            <input type="text" value={sourceRoot} placeholder="Default: ~/.codex" disabled={scanning}
              onChange={(event) => setSourceRoot(event.currentTarget.value)} />
          </label>
          <p className="quiet">Use an absolute path for a custom location. Only the session folders and title index are scanned.</p>
        </details>

        <div className="workspace">
          <section className="surface imports">
            <SectionHeading>Available imports</SectionHeading>
            {scanning && <p className="quiet" role="status">Reading active and archived Codex sessions…</p>}
            {scanError && <p className="scan-notice" role="alert">{scanError}</p>}
            {!scanning && !demo && !scanned && !scanError && <p className="quiet">Scan Codex to list your conversations. This only reads the source.</p>}
            {!demo && scanned?.status === 'ok' && <ScanResults result={scanned} />}
            {demo && <><p className="quiet">Verified imports are locked for the selected destination.</p><div className="project-list">
              {projects.map((project) => (
                <ProjectGroup key={project.id} view={projectView(selection, project)}
                  expanded={groups.includes(project.id)}
                  toggle={() => setGroups((current) => current.includes(project.id)
                    ? current.filter((id) => id !== project.id) : [...current, project.id])}
                  choose={(ids, checked) => setSelection((current) => selectThreads(current, project, ids, checked))}
                  map={(value) => {
                    setSelection((current) => mapDestination(current, project, value))
                    setShowDetails(false)
                  }} />
              ))}
            </div></>}
            <button type="button" className="demo-toggle" disabled={scanning}
              onClick={() => setDemo(!demo)}>{demo ? 'Hide demo' : 'Show demo'}</button>
          </section>
          <Options />
        </div>

        {demo && <section className="surface migration-preview" id="migration-preview" ref={previewRef} tabIndex={-1}>
          <SectionHeading icon="preview">Migration preview</SectionHeading>
          {totals.chosen.length === 0 ? <p className="quiet">Select conversations to preview the migration.</p> : (
            <div className="preview-grid">
              {totals.chosen.map(({ project, destination, chosen }) => (
                <article className="preview-card" key={project.id}>
                  <div><Icon name="folder" /><strong>{project.name}</strong><span className="status status-ready">Ready</span></div>
                  <p>{destination} · {numberOf(chosen.length, 'conversation')} · {numberOf(chosen.reduce((sum, thread) => sum + thread.messages, 0), 'message')}</p>
                  {expanded && <ul>{chosen.map(({ id, title }) => <li key={id}>{title}</li>)}</ul>}
                </article>
              ))}
            </div>
          )}
        </section>}
      </main>
      <footer className="footer">
        <p className="totals" aria-live="polite">{demo ? totalsText : 'Read-only inventory · Destination not checked'}</p>
        <div className="actions">
          <button type="button" className="secondary-button" disabled={!demo || !totals.conversations}
            aria-controls={demo ? 'migration-preview' : undefined} aria-expanded={expanded} onClick={() => setShowDetails(!expanded)}>
            {demo && expanded ? 'Hide details' : 'Preview only'}
          </button>
          <button type="button" className="primary-button" disabled aria-describedby="demo-limit">
            <Icon name="download" />Import selected projects
          </button>
        </div>
        <p className="visually-hidden" id="demo-limit">Import is unavailable in this version.</p>
      </footer>
    </div>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('Missing Agent Migration root.')
createRoot(root).render(<Panel />)
