import type { OrcaWorkerApi } from 'orca/worker'
import { probeRequest } from '../protocol'
import { checkEnvironment } from './probe'

export default function activate(orca: OrcaWorkerApi): void {
  orca.panels.handle(probeRequest, (_input, { signal }) => checkEnvironment(signal))
}
