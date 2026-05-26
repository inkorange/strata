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
   * Range: latitude [-90, 90], longitude [-180, 180]. Each plate has 12
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
          [50, -180],
          [50, -100],
          [30, -85],
          [10, -75],
          [-15, -75],
          [-35, -85],
          [-55, -100],
          [-55, -150],
          [-30, 170],
          [0, 170],
          [25, 175],
          [45, 180],
        ],
      },
      {
        id: 'north-american',
        vertices: [
          [55, -5],
          [60, 10],
          [55, 25],
          [45, 28],
          [35, 25],
          [30, 15],
          [28, 5],
          [32, -5],
          [38, -12],
          [45, -18],
          [50, -15],
          [53, -10],
        ],
      },
      {
        id: 'eurasian',
        vertices: [
          [60, 35],
          [65, 55],
          [60, 75],
          [50, 85],
          [40, 80],
          [35, 70],
          [30, 55],
          [32, 45],
          [38, 38],
          [45, 35],
          [52, 33],
          [56, 35],
        ],
      },
      {
        id: 'african',
        vertices: [
          [25, 5],
          [28, 25],
          [15, 50],
          [0, 55],
          [-15, 55],
          [-25, 45],
          [-30, 30],
          [-30, 15],
          [-20, 5],
          [-10, 0],
          [0, -5],
          [15, 0],
        ],
      },
      {
        id: 'south-american',
        vertices: [
          [18, -15],
          [15, -5],
          [5, -3],
          [-5, -5],
          [-15, -10],
          [-22, -18],
          [-25, -25],
          [-22, -30],
          [-15, -30],
          [-5, -28],
          [5, -25],
          [12, -20],
        ],
      },
      {
        id: 'antarctic',
        vertices: [
          [-60, -160],
          [-65, -130],
          [-65, -90],
          [-60, -50],
          [-55, -10],
          [-55, 30],
          [-60, 70],
          [-65, 100],
          [-70, 130],
          [-75, 160],
          [-70, -170],
          [-65, -170],
        ],
      },
      {
        id: 'indo-australian',
        vertices: [
          [-15, 45],
          [-20, 58],
          [-28, 65],
          [-38, 70],
          [-48, 75],
          [-55, 72],
          [-55, 60],
          [-48, 52],
          [-40, 48],
          [-30, 45],
          [-22, 45],
          [-18, 45],
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
          [55, -170],
          [50, -145],
          [35, -130],
          [10, -120],
          [-15, -115],
          [-40, -125],
          [-55, -140],
          [-55, 175],
          [-25, 168],
          [5, 158],
          [25, 152],
          [45, 158],
        ],
      },
      {
        id: 'north-american',
        vertices: [
          [65, -50],
          [70, -25],
          [60, 0],
          [40, -5],
          [30, -15],
          [25, -30],
          [22, -45],
          [25, -60],
          [30, -72],
          [40, -80],
          [50, -82],
          [58, -70],
        ],
      },
      {
        id: 'eurasian',
        vertices: [
          [72, 10],
          [75, 60],
          [72, 110],
          [65, 150],
          [50, 145],
          [38, 130],
          [22, 95],
          [18, 75],
          [25, 50],
          [38, 35],
          [50, 20],
          [62, 12],
        ],
      },
      {
        id: 'african',
        vertices: [
          [30, -5],
          [30, 30],
          [10, 45],
          [-10, 45],
          [-25, 35],
          [-30, 18],
          [-25, 5],
          [-15, -5],
          [-5, -10],
          [5, -12],
          [15, -10],
          [25, -8],
        ],
      },
      {
        id: 'south-american',
        vertices: [
          [12, -65],
          [10, -45],
          [0, -35],
          [-15, -35],
          [-30, -42],
          [-42, -55],
          [-50, -65],
          [-48, -75],
          [-35, -78],
          [-20, -78],
          [-5, -75],
          [5, -72],
        ],
      },
      {
        id: 'antarctic',
        vertices: [
          [-60, -160],
          [-62, -130],
          [-62, -95],
          [-58, -60],
          [-55, -25],
          [-55, 10],
          [-58, 45],
          [-62, 80],
          [-65, 115],
          [-68, 150],
          [-65, -175],
          [-62, -170],
        ],
      },
      {
        id: 'indo-australian',
        vertices: [
          [-5, 60],
          [-15, 75],
          [-30, 88],
          [-45, 95],
          [-52, 90],
          [-55, 80],
          [-52, 65],
          [-45, 55],
          [-35, 50],
          [-22, 48],
          [-15, 52],
          [-8, 55],
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
          [55, -175],
          [48, -148],
          [32, -128],
          [8, -115],
          [-15, -110],
          [-40, -120],
          [-55, -135],
          [-55, 175],
          [-25, 168],
          [8, 152],
          [28, 148],
          [48, 155],
        ],
      },
      {
        id: 'north-american',
        vertices: [
          [72, -80],
          [75, -55],
          [60, -35],
          [45, -38],
          [30, -50],
          [22, -68],
          [18, -82],
          [22, -98],
          [30, -110],
          [40, -118],
          [55, -125],
          [65, -110],
        ],
      },
      {
        id: 'eurasian',
        vertices: [
          [75, 20],
          [75, 75],
          [75, 130],
          [60, 152],
          [45, 142],
          [30, 125],
          [18, 95],
          [15, 75],
          [22, 55],
          [35, 40],
          [48, 28],
          [60, 18],
        ],
      },
      {
        id: 'african',
        vertices: [
          [33, 0],
          [33, 35],
          [15, 50],
          [-5, 50],
          [-25, 40],
          [-32, 20],
          [-30, 5],
          [-22, -8],
          [-10, -10],
          [0, -10],
          [12, -10],
          [25, -8],
        ],
      },
      {
        id: 'south-american',
        vertices: [
          [12, -68],
          [10, -45],
          [0, -38],
          [-15, -38],
          [-30, -45],
          [-42, -55],
          [-52, -68],
          [-52, -78],
          [-38, -80],
          [-22, -78],
          [-5, -75],
          [5, -72],
        ],
      },
      {
        id: 'antarctic',
        vertices: [
          [-60, -160],
          [-62, -130],
          [-62, -95],
          [-58, -60],
          [-55, -25],
          [-55, 10],
          [-58, 45],
          [-62, 78],
          [-65, 110],
          [-68, 145],
          [-65, -175],
          [-62, -170],
        ],
      },
      {
        id: 'indo-australian',
        vertices: [
          [0, 65],
          [-12, 80],
          [-25, 92],
          [-38, 100],
          [-48, 105],
          [-52, 95],
          [-50, 80],
          [-42, 65],
          [-32, 58],
          [-22, 55],
          [-12, 60],
          [-3, 62],
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
          [55, -178],
          [48, -148],
          [35, -125],
          [12, -110],
          [-8, -100],
          [-32, -90],
          [-55, -110],
          [-55, -172],
          [-28, 168],
          [5, 148],
          [28, 142],
          [48, 152],
        ],
      },
      {
        id: 'north-american',
        vertices: [
          [75, -100],
          [78, -55],
          [60, -38],
          [45, -52],
          [30, -75],
          [22, -85],
          [15, -90],
          [22, -100],
          [30, -110],
          [42, -120],
          [55, -130],
          [68, -135],
        ],
      },
      {
        id: 'eurasian',
        vertices: [
          [75, 15],
          [75, 75],
          [75, 135],
          [60, 155],
          [45, 142],
          [32, 125],
          [18, 95],
          [20, 75],
          [28, 60],
          [38, 38],
          [50, 25],
          [62, 12],
        ],
      },
      {
        id: 'african',
        vertices: [
          [35, -2],
          [35, 30],
          [12, 50],
          [-5, 50],
          [-25, 38],
          [-33, 22],
          [-32, 8],
          [-22, -5],
          [-12, -8],
          [0, -10],
          [15, -10],
          [28, -8],
        ],
      },
      {
        id: 'south-american',
        vertices: [
          [12, -72],
          [12, -55],
          [2, -42],
          [-15, -38],
          [-30, -42],
          [-42, -52],
          [-52, -65],
          [-52, -75],
          [-40, -78],
          [-22, -78],
          [-5, -78],
          [5, -75],
        ],
      },
      {
        id: 'antarctic',
        vertices: [
          [-60, -160],
          [-62, -130],
          [-62, -95],
          [-58, -60],
          [-55, -25],
          [-55, 10],
          [-58, 45],
          [-62, 78],
          [-65, 110],
          [-68, 145],
          [-65, -175],
          [-62, -170],
        ],
      },
      {
        id: 'indo-australian',
        vertices: [
          [28, 75],
          [18, 92],
          [0, 105],
          [-15, 130],
          [-30, 150],
          [-45, 158],
          [-50, 140],
          [-48, 110],
          [-30, 100],
          [-20, 85],
          [-10, 75],
          [10, 70],
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
          [55, -180],
          [50, -150],
          [40, -128],
          [25, -112],
          [10, -100],
          [-5, -85],
          [-25, -82],
          [-55, -100],
          [-55, -170],
          [-30, 170],
          [5, 145],
          [35, 142],
        ],
      },
      {
        id: 'north-american',
        vertices: [
          [75, -150],
          [75, -80],
          [78, -25],
          [55, -45],
          [45, -55],
          [25, -80],
          [15, -85],
          [10, -90],
          [20, -107],
          [32, -118],
          [45, -125],
          [60, -145],
        ],
      },
      {
        id: 'eurasian',
        vertices: [
          [75, 10],
          [75, 50],
          [75, 100],
          [75, 165],
          [55, 160],
          [40, 138],
          [25, 105],
          [10, 100],
          [28, 75],
          [40, 35],
          [35, 20],
          [55, -10],
        ],
      },
      {
        id: 'african',
        vertices: [
          [35, -5],
          [35, 30],
          [10, 50],
          [-5, 50],
          [-25, 35],
          [-35, 25],
          [-35, 15],
          [-25, 10],
          [-15, 8],
          [0, 5],
          [15, -18],
          [25, -10],
        ],
      },
      {
        id: 'south-american',
        vertices: [
          [12, -75],
          [12, -60],
          [5, -52],
          [0, -45],
          [-15, -38],
          [-25, -45],
          [-40, -55],
          [-55, -65],
          [-55, -75],
          [-35, -75],
          [-15, -78],
          [0, -80],
        ],
      },
      {
        id: 'antarctic',
        vertices: [
          [-60, -180],
          [-65, -150],
          [-60, -120],
          [-65, -90],
          [-60, -60],
          [-65, -30],
          [-60, 0],
          [-65, 30],
          [-60, 60],
          [-65, 90],
          [-60, 120],
          [-65, 150],
        ],
      },
      {
        id: 'indo-australian',
        vertices: [
          [35, 70],
          [28, 88],
          [10, 100],
          [-5, 110],
          [-10, 138],
          [-15, 150],
          [-45, 158],
          [-50, 140],
          [-50, 110],
          [-30, 100],
          [-15, 85],
          [5, 75],
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
          [55, -178],
          [50, -155],
          [40, -135],
          [25, -118],
          [10, -105],
          [-5, -90],
          [-25, -85],
          [-55, -105],
          [-55, -172],
          [-30, 168],
          [10, 148],
          [38, 145],
        ],
      },
      {
        id: 'north-american',
        vertices: [
          [75, -155],
          [75, -82],
          [78, -22],
          [55, -42],
          [45, -52],
          [25, -78],
          [15, -88],
          [10, -95],
          [20, -112],
          [32, -122],
          [45, -130],
          [60, -150],
        ],
      },
      {
        id: 'eurasian',
        vertices: [
          [75, 15],
          [75, 55],
          [75, 105],
          [75, 168],
          [55, 162],
          [40, 142],
          [28, 110],
          [15, 105],
          [30, 78],
          [42, 40],
          [38, 25],
          [58, -5],
        ],
      },
      {
        id: 'african',
        vertices: [
          [40, -2],
          [38, 32],
          [12, 52],
          [-3, 50],
          [-25, 35],
          [-35, 25],
          [-35, 15],
          [-25, 10],
          [-15, 8],
          [0, 5],
          [18, -18],
          [28, -8],
        ],
      },
      {
        id: 'south-american',
        vertices: [
          [15, -70],
          [15, -55],
          [5, -45],
          [0, -42],
          [-15, -35],
          [-25, -42],
          [-42, -50],
          [-55, -60],
          [-55, -72],
          [-35, -72],
          [-15, -75],
          [0, -78],
        ],
      },
      {
        id: 'antarctic',
        vertices: [
          [-60, -180],
          [-65, -150],
          [-60, -120],
          [-65, -90],
          [-60, -60],
          [-65, -30],
          [-60, 0],
          [-65, 30],
          [-60, 60],
          [-65, 90],
          [-60, 120],
          [-65, 150],
        ],
      },
      {
        id: 'indo-australian',
        vertices: [
          [40, 75],
          [32, 90],
          [12, 100],
          [-2, 112],
          [-8, 140],
          [-12, 152],
          [-42, 158],
          [-48, 138],
          [-48, 110],
          [-28, 100],
          [-12, 88],
          [10, 78],
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
