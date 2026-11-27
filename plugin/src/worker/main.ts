import type { OrcaWorkerApi } from 'orca/worker'
import { probeRequest, scanRequest } from '../protocol'
import { scanCodex } from './codex-scan'
import { checkEnvironment } from './probe'

export default function activate(orca: OrcaWorkerApi): void {
  orca.panels.handle(probeRequest, (_input, { signal }) => checkEnvironment(signal))
  orca.panels.handle(scanRequest, (input, { signal }) => scanCodex(input, signal))
}
