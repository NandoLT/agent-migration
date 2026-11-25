type ReactRuntime = {
  version: string
  createElement(type: string | (() => unknown), props: object | null, ...children: unknown[]): unknown
  useState<T>(initial: T): [T, (value: T) => void]
  useEffect(effect: () => (() => void), dependencies: readonly unknown[]): void
}
type ReactDomRuntime = { createRoot(node: HTMLElement): { render(element: unknown): void } }

// Only this spike uses the packaged UMD globals. A product build can bundle normal React imports.
const frame = window as Window & { React?: ReactRuntime; ReactDOM?: ReactDomRuntime }
const mount = document.getElementById('root')
if (!mount) throw new Error('No React mount point.')

function renderProbe(React: ReactRuntime, ReactDOM: ReactDomRuntime, root: HTMLElement) {
  const h = React.createElement

  function Panel() {
    const [choice, setChoice] = React.useState(true)
    const [size, setSize] = React.useState(0)
    React.useEffect(() => {
      const observer = new ResizeObserver(([entry]) => setSize(Math.round(entry.contentRect.width)))
      observer.observe(root)
      return () => observer.disconnect()
    }, [])

    return h('div', { className: 'shell' },
      h('main', null,
        h('header', null,
          h('img', { src: './icon.svg', alt: '', width: 20, height: 20 }),
          h('div', null, h('h1', null, 'Agent Migration'), h('p', null, 'HTML renderer · demo data'))
        ),
        h('div', { className: 'route' },
          h('section', null, h('small', null, 'Source'), h('strong', null, 'OpenAI Codex')),
          h('section', null, h('small', null, 'Destination'), h('strong', null, 'OpenCode 2'))
        ),
        h('div', { className: 'workspace' },
          h('section', null, h('h2', null, 'Available imports'),
            h('label', null, h('input', { type: 'checkbox', checked: choice,
              onChange: (event: { currentTarget: HTMLInputElement }) => setChoice(event.currentTarget.checked) }),
            'Example thread'),
            h('label', null, h('input', { type: 'checkbox', disabled: true }), 'Already imported')
          ),
          h('section', null, h('h2', null, 'Renderer proof'),
            h('p', null, `React ${React.version} · native TypeScript`),
            h('p', null, `${size || '…'} px container · `, h('span', { className: 'layout-name' }))
          )
        )
      ),
      h('footer', null,
        h('span', { 'aria-live': 'polite' }, choice ? '1 conversation · 24 messages' : '0 conversations · 0 messages'),
        h('button', { type: 'button', disabled: true }, 'Import selected')
      )
    )
  }

  ReactDOM.createRoot(root).render(h(Panel, null))
}

// Wait for both classic deferred scripts even if the module finished loading first.
function start() {
  if (!frame.React || !frame.ReactDOM) throw new Error('The local React assets did not load.')
  renderProbe(frame.React, frame.ReactDOM, mount!)
}
if (document.readyState === 'complete') start()
else window.addEventListener('load', start, { once: true })
