'use client'

import { cn } from '@/lib/utils'
import { useStore } from '@/src/store'
import { SCENARIO_LIST } from '@/src/systems/carbonModel'
import { MAX_FOSSIL } from '@/src/systems/step'
import { LeverSlider } from './LeverSlider'
import { ReservoirGauges } from './ReservoirGauges'
import { SystemsTimeline } from './SystemsTimeline'

const FOSSIL_ACCENT = '#ff6b6b'
const LAND_ACCENT = '#7ad9aa'

/**
 * Earth Systems module body, mounted into the ModuleFrame sidebar (desktop
 * left card / mobile floating bottom card). Holds the two forcing levers and
 * the scenario presets. The gauges and playback scrubber portal themselves to
 * the body so the sidebar's overflow doesn't clip them.
 */
export function SystemsBody() {
  const fossilLever = useStore((s) => s.fossilLever)
  const landLever = useStore((s) => s.landLever)
  const scenario = useStore((s) => s.scenario)
  const setFossilLever = useStore((s) => s.setFossilLever)
  const setLandLever = useStore((s) => s.setLandLever)
  const setScenario = useStore((s) => s.setScenario)

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
          Carbon cycle
        </div>
        <p className="text-[13px] leading-relaxed text-white/85">
          Carbon never disappears — it moves between four reservoirs. Push the levers, press play,
          and watch the atmosphere fill as the lithosphere drains, with the ocean and biosphere
          sinks fighting back.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <LeverSlider
          label="Fossil-fuel emissions"
          value={fossilLever}
          min={0}
          max={1}
          onChange={setFossilLever}
          accent={FOSSIL_ACCENT}
          format={(v) => `${(v * MAX_FOSSIL).toFixed(1)} GtC/yr`}
        />
        <LeverSlider
          label="Land use (plant ↔ clear forest)"
          value={landLever}
          min={-1}
          max={1}
          onChange={setLandLever}
          accent={LAND_ACCENT}
          format={(v) => (v > 0.02 ? 'deforesting' : v < -0.02 ? 'reforesting' : 'neutral')}
        />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
          Scenario
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {SCENARIO_LIST.map((sc) => {
            const active = scenario === sc.id
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => setScenario(sc.id)}
                aria-pressed={active}
                className={cn(
                  'rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors',
                  active
                    ? 'border-[#7ad9aa] bg-[rgba(122,217,170,0.18)] text-[#7ad9aa]'
                    : 'border-white/[0.08] bg-white/[0.03] text-white/65 hover:text-white/90 hover:bg-white/[0.06]',
                )}
              >
                {sc.label}
              </button>
            )
          })}
        </div>
      </div>

      <ReservoirGauges />
      <SystemsTimeline />
    </>
  )
}
