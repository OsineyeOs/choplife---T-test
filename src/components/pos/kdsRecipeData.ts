export interface RecipeSOP {
  id: string;
  name: string;
  station: 'grill' | 'kitchen' | 'bakery_fryer';
  stationLabel: string;
  prepTime: string;
  criticalTemp: string;
  yieldInfo: string;
  holdingStandard: string;
  ingredients: string[];
  steps: string[];
  chefTip: string;
}

export const CHOPLIFE_SOP_RECIPES: RecipeSOP[] = [
  {
    id: 'sop-asun',
    name: 'ChopLife Charcoal Asun (Spiced Goat Meat)',
    station: 'grill',
    stationLabel: 'GRILL & FLAME STATION',
    prepTime: '45 mins prep • 4 mins flash sauté',
    criticalTemp: 'Core Meat Temp ≥ 71°C (160°F)',
    yieldInfo: 'Batch yields 12 standard portions (250g each)',
    holdingStandard: 'Hot Cambro pan hold at ≥ 65°C for maximum 2 hours',
    ingredients: [
      '3.5kg Boneless goat meat (skin-on, cut into 1-inch cubes)',
      '150g Scotch bonnet (fresh ata rodo, coarsely crushed)',
      '200g Red bell peppers (tatashe, diced into 1/2-inch squares)',
      '300g Red onions (half diced for sauté, half cut into rings for garnish)',
      '40g Choplife signature suya & pepper rub seasoning',
      '30g Fresh ginger & garlic paste',
      '80ml Pure refined vegetable oil',
      '20g Dried thyme & seasoning cubes',
    ],
    steps: [
      'Pre-cook: Season goat meat cubes with garlic, ginger, thyme, and stock cubes. Steam in pressurized pot for 30 minutes until tender with light chew.',
      'Char-Grill: Transfer strained meat to hot open hardwood charcoal grill. Sear for 8–10 minutes until edges develop dark golden smoky caramelization.',
      'Sauté Reduction: Heat vegetable oil in high-heat wok until lightly smoking. Flash fry coarsely crushed scotch bonnets and diced onions for 60 seconds.',
      'Toss & Infuse: Dump grilled meat cubes and tatashe into wok. Dust with signature suya seasoning and flash-toss vigorously for 90 seconds.',
      'Plating: Top immediately with raw crispy red onion rings. Transfer to heat-retaining thermal packaging or hot line holding pan.',
    ],
    chefTip: 'Never over-boil the goat meat during step 1. The meat must retain enough structural elasticity to crisp on the charcoal grill without falling apart into shreds.',
  },
  {
    id: 'sop-jollof',
    name: 'Smoky Firewood-Style Party Jollof Rice',
    station: 'kitchen',
    stationLabel: 'MAIN KITCHEN / CALDERA',
    prepTime: '20 mins base • 45 mins pressurized steam',
    criticalTemp: 'Steam Core Temp ≥ 85°C • Hot Well ≥ 65°C',
    yieldInfo: 'Commercial caldera yields 45 standard portions',
    holdingStandard: 'Steam table well hold at 68°C–72°C; fluff with fork every 30 mins',
    ingredients: [
      '5.0kg Premium parboiled long-grain rice (washed in hot water 3 times)',
      '1.2kg Tomato paste (double concentrated)',
      '2.0kg Blended fresh base (50% red bell peppers, 30% scotch bonnet, 20% fresh tomatoes)',
      '800g Chopped white onions',
      '1.0L Refined vegetable oil',
      '2.5L Rich concentrated chicken/beef bone marrow stock',
      '50g Ground Nigerian curry powder & dried thyme',
      '12 Whole dried bay leaves',
      '150g Unsalted creamery butter',
    ],
    steps: [
      'Base Frying: Heat vegetable oil in heavy-gauge cast aluminum pot. Caramelize chopped onions, then add tomato paste and fry for 12 minutes until oil turns deep ruby red.',
      'Pepper Reduction: Stir in blended fresh pepper puree, bay leaves, curry, and thyme. Fry on medium heat until moisture evaporates and oil floats on top.',
      'Stock & Balance: Pour in simmering bone marrow stock. Taste and calibrate salt levels—stock should taste slightly saltier than usual to absorb rice starches.',
      'Rice Fold: Add thoroughly washed, drained parboiled rice. Liquid level should stand exactly 1 inch above rice grain surface. Fold once.',
      'Steam Trap & Smoke: Cap pot with heavy-duty aluminum foil, then clamp cast lid down. Simmer on low heat for 35 mins. Allow bottom layer to lightly toast for authentic party smoke aroma.',
      'Finish: Open steam trap, drop butter cubes across surface, and fluff gently with two large serving forks.',
    ],
    chefTip: 'Do not stir the rice repeatedly during simmering. Repeated stirring releases rice starch and creates mushy porridge instead of distinct, smoky party grains.',
  },
  {
    id: 'sop-puff-puff',
    name: 'Golden Nigerian Puff-Puff (ChopLife Standard)',
    station: 'bakery_fryer',
    stationLabel: 'FRYER & BAKERY STATION',
    prepTime: '15 mins mix • 45 mins proofing • 4 mins fry',
    criticalTemp: 'Fryer Oil Temp 175°C (347°F)',
    yieldInfo: 'Batch yields 120 cocktail size pieces',
    holdingStandard: 'Ventilated wire rack; serve fresh within 35 mins',
    ingredients: [
      '2.0kg Bakers high-grade patent wheat flour',
      '450g Granulated white sugar',
      '35g Instant active dry yeast',
      '15g Finely grated fresh nutmeg',
      '10g Fine sea salt',
      '1.6L Lukewarm filtered water (approx 38°C)',
      'Clean vegetable oil for deep frying (high smoke point)',
    ],
    steps: [
      'Yeast Activation & Mix: Whisk flour, sugar, yeast, nutmeg, and salt together in a large clean mixing bowl. Pour in lukewarm water gradually.',
      'Slap Aeration: Beat batter vigorously with an open hand for 5 minutes, slapping against the bowl wall to develop gluten elasticity and incorporate trapped air bubbles.',
      'Proofing: Cover mixing bowl with warm damp proofing towel. Rest in proofing cabinet (28°C–32°C) for 45 minutes until doubled in volume with frothy bubbles.',
      'Fryer Temp Check: Verify fryer digital thermometer reads exactly 175°C. Oil that is too cold causes oily puff-puff; oil that is too hot burns the exterior while raw inside.',
      'Drop & Fry: Squeeze batter through palm and web between thumb and index finger to release spherical balls directly into hot oil. Fry for 3.5–4 mins, rolling with spider skimmer.',
      'Drain: Transfer to stainless wire mesh draining screen. Allow surface oil to drip off for 90 seconds before packaging.',
    ],
    chefTip: 'Nutmeg must be freshly grated. Pre-ground commercial nutmeg loses its aromatic essential oils and dims the signature Choplife bakery fragrance.',
  },
  {
    id: 'sop-samosa-springroll',
    name: 'Crispy Cocktail Samosas & Spring Rolls',
    station: 'bakery_fryer',
    stationLabel: 'FRYER STATION',
    prepTime: '2 mins inspect • 4 mins deep fry',
    criticalTemp: 'Fryer Oil 180°C (356°F) • Internal Core ≥ 74°C (165°F)',
    yieldInfo: '80 pieces per fry basket maximum',
    holdingStandard: 'Holding hot cabinet at 65°C for up to 45 mins',
    ingredients: [
      'Pre-rolled Choplife cocktail beef/chicken samosas',
      'Pre-rolled Choplife seasoned vegetable spring rolls',
      'Commercial deep frying vegetable shortening or sunflower oil',
      'Choplife sweet scotch bonnet dipping sauce',
    ],
    steps: [
      'Seal Check: Inspect edges of pastry wrappers. Discard or re-seal any wraps with cracked pastry corners to prevent oil seepage into filling.',
      'Basket Loading: Place pieces loosely in fry basket without overloading (maximum 40 pieces per standard commercial basket).',
      'Submerge & Timer: Lower basket into 180°C oil. Shake basket gently for first 15 seconds to prevent pieces from sticking together.',
      'Fry: Cook undisturbed for 3.5 to 4 minutes until pastry turns blistered golden crisp.',
      'Drain & Core Check: Lift basket, hang on rear hook, and allow oil to drain for 60 seconds. Verify core temperature with needle probe.',
    ],
    chefTip: 'Never drop frozen items directly into oil below 175°C. Oil temperature drop leads to soggy, greasy pastry shells instead of brittle, shattering crunch.',
  },
  {
    id: 'sop-chicken',
    name: 'Flame-Grilled Quarter Chicken (Suya-Glazed)',
    station: 'grill',
    stationLabel: 'GRILL & FLAME STATION',
    prepTime: '24hr brine • 18 mins charcoal roast',
    criticalTemp: 'Thickest Thigh Core Temp ≥ 74°C (165°F)',
    yieldInfo: '24 quarter cuts per charcoal grill rack',
    holdingStandard: 'Hot holding cabinet at 70°C for up to 90 mins',
    ingredients: [
      '24 Fresh jumbo chicken quarters (scored with 3 parallel diagonal cuts across thigh)',
      '100g Garlic & ginger marinade',
      '40g Bouillon seasoning & sea salt',
      '150ml Vegetable oil',
      '120g Choplife suya pepper basting oil (ground kuli-kuli, ginger, chili, onion powder)',
    ],
    steps: [
      'Brine & Score: Quarters must be brined for minimum 4 hours and scored to allow heat and marinade to reach the bone marrow.',
      'Embers Setup: Rake hardwood lump charcoal to medium-high heat. Place chicken skin-side up first to render fat without flare-ups.',
      'Turn & Sear: Turn quarters every 4 minutes. Brush generously with suya basting oil on each flip.',
      'Probe Temp: Insert digital probe into the deepest portion of the thigh bone joint. Must reach 74°C (165°F) with clear running juices.',
      'Rest: Rest on warm stainless board for 3 minutes before packing to allow muscle fibers to reabsorb juices.',
    ],
    chefTip: 'If grill flare-ups occur due to dripping chicken fat, shift chicken to indirect heat zone rather than spraying water, which leaves ash deposits on the skin.',
  },
];
