export type PlateId =
  | 'pacific'
  | 'north-american'
  | 'eurasian'
  | 'african'
  | 'south-american'
  | 'antarctic'
  | 'indo-australian'

export interface PlateAtEra {
  id: PlateId
  /**
   * Polygon vertices as [latitude, longitude] degree pairs. Order is treated
   * as counterclockwise when viewed from outside the sphere (the standard
   * three.js front-face winding). If a plate renders inside-out at runtime,
   * reverse the array.
   *
   * Range: latitude [-90, 90], longitude [-180, 180]. Each plate has 6
   * vertices in v1. Counts are uniform across eras so tweenPlates can pair
   * vertices index-by-index.
   */
  vertices: ReadonlyArray<readonly [number, number]>
}

export interface Era {
  id: 'pangaea' | 'late-jurassic' | 'late-cretaceous' | 'eocene' | 'present' | 'future'
  name: string
  mya: number
  descriptionBeginner: string
  descriptionStandard: string
  descriptionAdvanced: string
  plates: ReadonlyArray<PlateAtEra>
}

// Vertex data note: these are simplified hand-authored approximations of
// paleogeographic reconstructions, not academic-grade. They preserve the
// big-picture motion (Pangaea -> rifting -> dispersal -> present -> future
// drift) but individual plate shapes are coarse hexagons. Visual refinement
// is expected as a follow-up pass.

export const ERAS: ReadonlyArray<Era> = [
  {
    id: 'pangaea',
    name: 'Pangaea',
    mya: 250,
    descriptionBeginner:
      'All the continents were joined together as one giant landmass called Pangaea, surrounded by one ocean.',
    descriptionStandard:
      '250 million years ago, all continental crust was fused into the supercontinent Pangaea, encircled by the Panthalassic Ocean. Land animals could walk between regions that today are oceans apart.',
    descriptionAdvanced:
      'Late Permian / Early Triassic. Pangaea spans roughly pole to pole along a north-south axis, with Panthalassa as a single global ocean. Subduction along its western margin builds the proto-Andes; the Tethys Sea curls into the eastern interior.',
    plates: [
      {
        id: 'pacific',
        vertices: [
          [60, -150],
          [60, 175],
          [10, -110],
          [-40, -120],
          [-60, 175],
          [-60, -150],
        ],
      },
      {
        id: 'north-american',
        vertices: [
          [60, -10],
          [55, 30],
          [35, 25],
          [25, 5],
          [25, -15],
          [45, -25],
        ],
      },
      {
        id: 'eurasian',
        vertices: [
          [60, 30],
          [60, 80],
          [45, 75],
          [30, 50],
          [35, 30],
          [55, 30],
        ],
      },
      {
        id: 'african',
        vertices: [
          [25, 5],
          [30, 50],
          [0, 60],
          [-30, 50],
          [-30, 10],
          [0, 0],
        ],
      },
      {
        id: 'south-american',
        vertices: [
          [25, -15],
          [25, 5],
          [0, 0],
          [-30, -10],
          [-30, -30],
          [-5, -30],
        ],
      },
      {
        id: 'antarctic',
        vertices: [
          [-60, -150],
          [-60, -90],
          [-60, -30],
          [-60, 30],
          [-60, 90],
          [-60, 175],
        ],
      },
      {
        id: 'indo-australian',
        vertices: [
          [-30, 10],
          [-30, 50],
          [-50, 70],
          [-60, 60],
          [-60, 10],
          [-45, 0],
        ],
      },
    ],
  },
  {
    id: 'late-jurassic',
    name: 'Late Jurassic',
    mya: 150,
    descriptionBeginner:
      'Pangaea was breaking apart. The North Atlantic Ocean started to open as North America split from Africa.',
    descriptionStandard:
      '150 million years ago, the North Atlantic was a narrow rift between North America and northwest Africa. India was still attached to Antarctica. Dinosaurs roamed across the still-connected southern continents.',
    descriptionAdvanced:
      'Late Jurassic. Pangaea has fractured into Laurasia (north) and Gondwana (south). Central Atlantic seafloor spreading is well underway; the South Atlantic has not yet opened. India remains coupled to East Antarctica.',
    plates: [
      {
        id: 'pacific',
        vertices: [
          [55, -160],
          [35, -135],
          [-15, -120],
          [-55, -140],
          [-55, 175],
          [15, 150],
        ],
      },
      {
        id: 'north-american',
        vertices: [
          [60, -50],
          [60, -10],
          [30, -20],
          [20, -55],
          [30, -80],
          [50, -85],
        ],
      },
      {
        id: 'eurasian',
        vertices: [
          [70, 20],
          [70, 165],
          [40, 130],
          [20, 80],
          [40, 35],
          [60, 15],
        ],
      },
      {
        id: 'african',
        vertices: [
          [25, -5],
          [25, 50],
          [-20, 40],
          [-30, 10],
          [-15, -10],
          [10, -15],
        ],
      },
      {
        id: 'south-american',
        vertices: [
          [15, -65],
          [-5, -30],
          [-50, -50],
          [-50, -65],
          [-20, -75],
          [10, -75],
        ],
      },
      {
        id: 'antarctic',
        vertices: [
          [-60, -150],
          [-60, -90],
          [-60, -30],
          [-60, 30],
          [-60, 90],
          [-60, 150],
        ],
      },
      {
        id: 'indo-australian',
        vertices: [
          [0, 65],
          [-15, 90],
          [-40, 105],
          [-55, 100],
          [-45, 70],
          [-25, 50],
        ],
      },
    ],
  },
  {
    id: 'late-cretaceous',
    name: 'Late Cretaceous',
    mya: 90,
    descriptionBeginner:
      'South America and Africa had fully separated, opening the South Atlantic. India was drifting north toward Asia.',
    descriptionStandard:
      '90 million years ago, the South Atlantic was a fully-formed ocean. India had broken from Antarctica and was racing north as a separate plate. North America still touched Europe at its northeastern edge.',
    descriptionAdvanced:
      'Late Cretaceous. South Atlantic rifting is mature; the Mid-Atlantic Ridge runs the full length of the ocean. India is mid-flight toward Asia at unusually high plate velocities (~15 cm/yr). The Pacific is still the dominant ocean basin.',
    plates: [
      {
        id: 'pacific',
        vertices: [
          [55, -170],
          [35, -130],
          [-10, -115],
          [-55, -135],
          [-50, 170],
          [15, 145],
        ],
      },
      {
        id: 'north-american',
        vertices: [
          [70, -90],
          [70, -55],
          [35, -45],
          [20, -75],
          [35, -110],
          [55, -135],
        ],
      },
      {
        id: 'eurasian',
        vertices: [
          [75, 25],
          [75, 170],
          [45, 145],
          [20, 90],
          [40, 50],
          [60, 20],
        ],
      },
      {
        id: 'african',
        vertices: [
          [30, 0],
          [30, 45],
          [-30, 35],
          [-30, 5],
          [0, -10],
          [25, -10],
        ],
      },
      {
        id: 'south-american',
        vertices: [
          [10, -70],
          [-10, -40],
          [-50, -55],
          [-55, -75],
          [-25, -80],
          [5, -80],
        ],
      },
      {
        id: 'antarctic',
        vertices: [
          [-60, -150],
          [-60, -90],
          [-60, -30],
          [-60, 30],
          [-60, 90],
          [-60, 150],
        ],
      },
      {
        id: 'indo-australian',
        vertices: [
          [-5, 70],
          [-15, 95],
          [-35, 130],
          [-50, 145],
          [-40, 90],
          [-15, 65],
        ],
      },
    ],
  },
  {
    id: 'eocene',
    name: 'Eocene',
    mya: 50,
    descriptionBeginner:
      'India crashed into Asia, beginning to push up the Himalaya mountains. The continents looked much like today.',
    descriptionStandard:
      '50 million years ago, the Indo-Australian plate collided with the Eurasian plate; the Himalayas began rising. North America had completed its separation from Europe. Climate was warmer; ice caps were minimal.',
    descriptionAdvanced:
      'Early-mid Eocene. India-Asia collision is ongoing; the Indus and Tsangpo suture zones are active. The Tethys Ocean has closed across most of its length. Australia has begun moving away from Antarctica; the circum-Antarctic current is forming.',
    plates: [
      {
        id: 'pacific',
        vertices: [
          [55, 175],
          [35, -135],
          [-5, -110],
          [-55, -130],
          [-50, 170],
          [15, 145],
        ],
      },
      {
        id: 'north-american',
        vertices: [
          [75, -95],
          [75, -50],
          [40, -50],
          [20, -80],
          [35, -120],
          [60, -145],
        ],
      },
      {
        id: 'eurasian',
        vertices: [
          [75, 30],
          [75, 170],
          [50, 150],
          [20, 105],
          [40, 50],
          [60, 15],
        ],
      },
      {
        id: 'african',
        vertices: [
          [35, 5],
          [30, 45],
          [-35, 35],
          [-30, 10],
          [5, -10],
          [30, -10],
        ],
      },
      {
        id: 'south-american',
        vertices: [
          [10, -75],
          [-10, -40],
          [-55, -65],
          [-55, -75],
          [-25, -80],
          [5, -85],
        ],
      },
      {
        id: 'antarctic',
        vertices: [
          [-60, -150],
          [-60, -90],
          [-60, -30],
          [-60, 30],
          [-60, 90],
          [-60, 150],
        ],
      },
      {
        id: 'indo-australian',
        vertices: [
          [25, 75],
          [5, 100],
          [-10, 140],
          [-45, 155],
          [-40, 90],
          [10, 65],
        ],
      },
    ],
  },
  {
    id: 'present',
    name: 'Present',
    mya: 0,
    descriptionBeginner:
      "Today's plate arrangement. The Atlantic Ocean is still widening; the Pacific is slowly shrinking.",
    descriptionStandard:
      'Today (0 Mya). Seven major plates carry the continents and ocean floor. The Atlantic widens at ~2 cm/yr along the Mid-Atlantic Ridge; the Pacific narrows along its subduction zones around the Ring of Fire.',
    descriptionAdvanced:
      'Present configuration. Active boundaries include: convergent (Andean, Cascadian, Himalayan), divergent (Mid-Atlantic Ridge, East Pacific Rise, East African Rift), and transform (San Andreas, North Anatolian). Mean plate velocities range 1-10 cm/yr.',
    plates: [
      {
        id: 'pacific',
        vertices: [
          [55, 175],
          [35, -135],
          [-5, -105],
          [-55, -125],
          [-50, 170],
          [20, 145],
        ],
      },
      {
        id: 'north-american',
        vertices: [
          [75, -100],
          [75, -50],
          [40, -55],
          [20, -85],
          [35, -125],
          [60, -150],
        ],
      },
      {
        id: 'eurasian',
        vertices: [
          [75, 30],
          [75, 170],
          [50, 150],
          [15, 105],
          [40, 50],
          [60, 15],
        ],
      },
      {
        id: 'african',
        vertices: [
          [35, 5],
          [30, 45],
          [-35, 35],
          [-35, 10],
          [5, -10],
          [35, -10],
        ],
      },
      {
        id: 'south-american',
        vertices: [
          [10, -75],
          [-10, -40],
          [-55, -65],
          [-55, -75],
          [-25, -80],
          [5, -85],
        ],
      },
      {
        id: 'antarctic',
        vertices: [
          [-60, -150],
          [-60, -90],
          [-60, -30],
          [-60, 30],
          [-60, 90],
          [-60, 150],
        ],
      },
      {
        id: 'indo-australian',
        vertices: [
          [35, 70],
          [5, 100],
          [-10, 145],
          [-45, 160],
          [-40, 90],
          [15, 65],
        ],
      },
    ],
  },
  {
    id: 'future',
    name: 'Future (Projected)',
    mya: -50,
    descriptionBeginner:
      'Looking ahead 50 million years: the continents have drifted further. Africa is pushing into Europe, and Australia is closer to Asia.',
    descriptionStandard:
      'Projected configuration 50 million years from now. Atlantic continues to widen, Pacific to shrink. Africa has rotated and is colliding with southern Europe, closing the Mediterranean. Australia drifts north into Southeast Asia.',
    descriptionAdvanced:
      'Forward projection assuming present plate velocities continue. Closure of the Mediterranean basin produces new collision mountains across southern Europe. East African Rift may have separated the Somali subplate as an oceanic basin. The Pacific Ring of Fire compresses as subduction continues.',
    plates: [
      {
        id: 'pacific',
        vertices: [
          [55, 175],
          [35, -150],
          [-5, -115],
          [-55, -135],
          [-50, 170],
          [15, 150],
        ],
      },
      {
        id: 'north-american',
        vertices: [
          [75, -105],
          [75, -45],
          [45, -50],
          [25, -80],
          [40, -125],
          [60, -155],
        ],
      },
      {
        id: 'eurasian',
        vertices: [
          [75, 35],
          [75, 170],
          [55, 150],
          [20, 110],
          [45, 55],
          [60, 20],
        ],
      },
      {
        id: 'african',
        vertices: [
          [40, 5],
          [35, 45],
          [-30, 35],
          [-30, 10],
          [5, -10],
          [35, -10],
        ],
      },
      {
        id: 'south-american',
        vertices: [
          [15, -70],
          [-10, -35],
          [-55, -60],
          [-55, -75],
          [-25, -80],
          [10, -80],
        ],
      },
      {
        id: 'antarctic',
        vertices: [
          [-60, -150],
          [-60, -90],
          [-60, -30],
          [-60, 30],
          [-60, 90],
          [-60, 150],
        ],
      },
      {
        id: 'indo-australian',
        vertices: [
          [40, 75],
          [10, 100],
          [-5, 140],
          [-40, 160],
          [-35, 90],
          [15, 70],
        ],
      },
    ],
  },
]

/** Lookup map for downstream consumers. */
export const ERAS_BY_ID: Record<Era['id'], Era> = Object.fromEntries(
  ERAS.map((era) => [era.id, era]),
) as Record<Era['id'], Era>

/** Display names for each plate. */
export const PLATE_NAMES: Record<PlateId, string> = {
  pacific: 'Pacific',
  'north-american': 'North American',
  eurasian: 'Eurasian',
  african: 'African',
  'south-american': 'South American',
  antarctic: 'Antarctic',
  'indo-australian': 'Indo-Australian',
}

/** Display colors for each plate (additive on top of the Earth surface). */
export const PLATE_COLORS: Record<PlateId, string> = {
  pacific: '#3a8fb8', // ocean blue
  'north-american': '#c97a5b', // warm rust
  eurasian: '#d4a85c', // muted gold
  african: '#a3b87a', // olive
  'south-american': '#b06a8a', // dusty rose
  antarctic: '#dde6ec', // pale ice
  'indo-australian': '#b9925e', // sandstone
}
