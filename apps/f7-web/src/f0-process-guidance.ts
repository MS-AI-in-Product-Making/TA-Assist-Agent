import type { DeepReadonly } from '../../types'
import type { F7SessionSnapshot } from '../../types'

import { loadProcessRequirements } from '@ai-assist/knowledge-base'

type LoadFn = (opts: { version: string; facts?: Record<string, any> }) => Promise<{ matchedEntries?: any[]; version?: string }>

export async function buildF0ProcessGuidance(
  session: DeepReadonly<F7SessionSnapshot>,
  requirementGapPresent?: boolean,
  load: LoadFn = loadProcessRequirements as unknown as LoadFn
) {
  const facts: Record<string, any> = {
    actor: 'all',
    analysisMethod: 'one-dimensional-rss',
    toleranceCount: Array.isArray((session as any).factors) ? (session as any).factors.length : 0,
  }

  if (requirementGapPresent !== undefined) facts.requirementGapPresent = requirementGapPresent

  try {
    const res = await load({ version: 'process-requirements-v1', facts })
    const entries = Array.isArray(res.matchedEntries) ? res.matchedEntries : []
    return { available: true, version: res.version, entries }
  } catch (err) {
    return { available: false, entries: [] }
  }
}

export default buildF0ProcessGuidance
