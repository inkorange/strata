import { describe, expect, it } from 'vitest'
import { type ContinentId, ERAS, type Era, type PlateAtEra, type PlateId } from './eras'

const REQUIRED_PLATE_IDS: ReadonlyArray<PlateId> = [
  'pacific',
  'north-american',
  'eurasian',
  'african',
  'south-american',
  'antarctic',
  'indo-australian',
]

const REQUIRED_ERA_IDS: ReadonlyArray<Era['id']> = [
  'pangaea',
  'late-jurassic',
  'late-cretaceous',
  'eocene',
  'present',
  'future',
]

describe('ERAS', () => {
  it('contains exactly the six required eras in chronological order', () => {
    expect(ERAS).toHaveLength(6)
    expect(ERAS.map((e) => e.id)).toEqual(REQUIRED_ERA_IDS)
  })

  it('orders eras from oldest to newest by mya (descending)', () => {
    const myaValues = ERAS.map((e) => e.mya)
    const sorted = [...myaValues].sort((a, b) => b - a)
    expect(myaValues).toEqual(sorted)
  })

  it.each(REQUIRED_ERA_IDS)('era %s has all seven plates', (eraId) => {
    const era = ERAS.find((e) => e.id === eraId)
    expect(era).toBeDefined()
    if (!era) return
    const plateIds = era.plates.map((p) => p.id).sort()
    expect(plateIds).toEqual([...REQUIRED_PLATE_IDS].sort())
  })

  it.each(REQUIRED_ERA_IDS)('era %s has non-empty descriptions at every tier', (eraId) => {
    const era = ERAS.find((e) => e.id === eraId)
    expect(era).toBeDefined()
    if (!era) return
    expect(era.descriptionBeginner.length).toBeGreaterThan(0)
    expect(era.descriptionStandard.length).toBeGreaterThan(0)
    expect(era.descriptionAdvanced.length).toBeGreaterThan(0)
  })

  it.each(REQUIRED_PLATE_IDS)('plate %s has consistent vertex count across all eras', (plateId) => {
    const counts = ERAS.map((era) => {
      const plate = era.plates.find((p) => p.id === plateId) as PlateAtEra | undefined
      return plate?.vertices.length ?? 0
    })
    const first = counts[0]
    expect(counts.every((c) => c === first)).toBe(true)
    expect(first).toBeGreaterThanOrEqual(6)
    expect(first).toBeLessThanOrEqual(12)
  })

  it('every plate vertex has latitude in [-90, 90] and longitude in [-180, 180]', () => {
    for (const era of ERAS) {
      for (const plate of era.plates) {
        for (const [lat, lng] of plate.vertices) {
          expect(lat).toBeGreaterThanOrEqual(-90)
          expect(lat).toBeLessThanOrEqual(90)
          expect(lng).toBeGreaterThanOrEqual(-180)
          expect(lng).toBeLessThanOrEqual(180)
        }
      }
    }
  })
})

const REQUIRED_CONTINENT_IDS: ReadonlyArray<ContinentId> = [
  'north-america',
  'south-america',
  'eurasia',
  'africa',
  'india',
  'australia',
  'antarctica',
]

describe('ERAS continents', () => {
  it.each(REQUIRED_ERA_IDS)('era %s has all seven continents', (eraId) => {
    const era = ERAS.find((e) => e.id === eraId)
    expect(era).toBeDefined()
    if (!era) return
    const continentIds = era.continents.map((c) => c.id).sort()
    expect(continentIds).toEqual([...REQUIRED_CONTINENT_IDS].sort())
  })

  it.each(
    REQUIRED_CONTINENT_IDS,
  )('continent %s has consistent vertex count across eras', (continentId) => {
    const counts = ERAS.map(
      (era) => era.continents.find((c) => c.id === continentId)?.vertices.length ?? 0,
    )
    const first = counts[0]
    expect(counts.every((c) => c === first)).toBe(true)
    expect(first).toBeGreaterThanOrEqual(6)
  })

  it('every continent vertex has valid lat/lng range', () => {
    for (const era of ERAS) {
      for (const continent of era.continents) {
        for (const [lat, lng] of continent.vertices) {
          expect(lat).toBeGreaterThanOrEqual(-90)
          expect(lat).toBeLessThanOrEqual(90)
          expect(lng).toBeGreaterThanOrEqual(-180)
          expect(lng).toBeLessThanOrEqual(180)
        }
      }
    }
  })
})
