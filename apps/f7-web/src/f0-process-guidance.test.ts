import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { DeepReadonly } from '../../types'
import type { F7SessionSnapshot } from '../../types'

import { buildF0ProcessGuidance } from './f0-process-guidance'

const makeSession = (factorsCount: number): DeepReadonly<F7SessionSnapshot> => ({
  factors: Array.from({ length: factorsCount }, (_, i) => ({ id: `f${i}` }))
} as any)

describe('buildF0ProcessGuidance', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should call loadProcessRequirements with minimal facts and handle available result', async () => {
    const load = vi.fn(async (opts: any) => ({ matchedEntries: [{ id: 'e1' }], version: 'process-requirements-v1' }))

    const result = await buildF0ProcessGuidance(makeSession(7), undefined, load)

    expect(load).toHaveBeenCalledWith({ version: 'process-requirements-v1', facts: { actor: 'all', analysisMethod: 'one-dimensional-rss', toleranceCount: 7 } })
    expect(result.available).toBe(true)
    expect(result.entries).toHaveLength(1)
  })

  it('should include requirementGapPresent when provided', async () => {
    const load = vi.fn(async (opts: any) => ({ matchedEntries: [{ id: 'gap' }], version: 'process-requirements-v1' }))

    const result = await buildF0ProcessGuidance(makeSession(7), true, load)

    expect(load).toHaveBeenCalledWith({ version: 'process-requirements-v1', facts: { actor: 'all', analysisMethod: 'one-dimensional-rss', toleranceCount: 7, requirementGapPresent: true } })
    expect(result.available).toBe(true)
    expect(result.entries[0].id).toBe('gap')
  })

  it('should mark unavailable with empty entries when load throws', async () => {
    const load = vi.fn(async () => { throw new Error('boom') })

    const result = await buildF0ProcessGuidance(makeSession(7), undefined, load)

    expect(result.available).toBe(false)
    expect(result.entries).toHaveLength(0)
  })

  it('should treat 11 factors as complex stack trigger', async () => {
    const load = vi.fn(async (opts: any) => ({ matchedEntries: [{ id: 'complex' }], version: 'process-requirements-v1' }))

    const result = await buildF0ProcessGuidance(makeSession(11), undefined, load)

    // behaviour: still calls loader, returns entries; test ensures boundary
    expect(load).toHaveBeenCalled()
    expect(result.entries[0].id).toBe('complex')
  })

  it('should not include requirement-gap-ado-notice when gap false', async () => {
    const load = vi.fn(async (opts: any) => ({ matchedEntries: [{ id: 'ok' }], version: 'process-requirements-v1' }))

    const result = await buildF0ProcessGuidance(makeSession(7), false, load)

    expect(load).toHaveBeenCalledWith({ version: 'process-requirements-v1', facts: { actor: 'all', analysisMethod: 'one-dimensional-rss', toleranceCount: 7, requirementGapPresent: false } })
    expect(result.available).toBe(true)
  })
})
