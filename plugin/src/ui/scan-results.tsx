import type { ScannedThread, ScanResult, ThreadKind } from '../protocol'

const kinds: Record<ThreadKind, string> = {
  main: 'Main thread', subagent: 'Subagent', guardian: 'Guardian', unknown: 'Unknown source'
}

const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' })

function groupByProject(threads: readonly ScannedThread[]) {
  const groups = new Map<string | null, ScannedThread[]>()
  for (const thread of threads) {
    const group = groups.get(thread.projectKey)
    if (group) group.push(thread)
    else groups.set(thread.projectKey, [thread])
  }
  return groups
}

export function ScanResults({ result }: { result: Extract<ScanResult, { status: 'ok' }> }) {
  const { threads, totalThreads, files, malformedFiles, skippedEntries, indexIssues, truncated } = result
  const summary = truncated ? `${threads.length} shown · ${totalThreads} found so far` : `${totalThreads} conversations`
  const groups = groupByProject(threads)
  return (
    <>
      <p className="quiet" role="status">{summary} · {files} files checked</p>
      {truncated && <p className="scan-notice">A scan limit was reached. The inventory is partial.</p>}
      {malformedFiles > 0 && <p className="scan-notice">{malformedFiles} files had unreadable or inconsistent records.</p>}
      {skippedEntries > 0 && <p className="scan-notice">{skippedEntries} entries skipped (links, unsupported types or inaccessible paths).</p>}
      {indexIssues > 0 && <p className="scan-notice">Some titles could not be read from the Codex index.</p>}
      {totalThreads === 0 && <p className="quiet">No Codex conversations found in this location.</p>}
      <div className="project-list">
        {[...groups].map(([key, entries]) => {
          const directory = entries[0].directory
          return (
            <details className="project scan-project" key={key ?? 'no-directory'}>
              <summary>
                <strong>{directory ? directory.split('/').at(-1) || directory : 'Unknown project directory'}</strong>
                {directory && <small>{directory}</small>}
                <small>{entries.length} conversations</small>
              </summary>
              <ul className="scan-threads">
                {entries.map((thread) => (
                  <li className="scan-thread" key={thread.id}>
                    <div>
                      <strong>{thread.title}</strong>
                      <small>{thread.messages} messages · {thread.fragments} fragments · {thread.archivedFragments} archived</small>
                      {thread.updatedAt && <small>Last activity: <time dateTime={thread.updatedAt}>{date.format(new Date(thread.updatedAt))}</time></small>}
                      {thread.parentId && <small>Parent thread: {thread.parentId}</small>}
                      {thread.messagesWithoutId > 0 && <small>{thread.messagesWithoutId} messages without a stable ID</small>}
                      {thread.multipleDirectories && <small>Fragments refer to different source directories.</small>}
                      {thread.incomplete && <small className="scan-notice">Message count may be incomplete.</small>}
                    </div>
                    <span className={'status' + (thread.kind === 'main' ? '' : ' status-excluded')}>{kinds[thread.kind]}</span>
                  </li>
                ))}
              </ul>
            </details>
          )
        })}
      </div>
    </>
  )
}
