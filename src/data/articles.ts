export interface Article {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  category: 'bakery' | 'culture' | 'events' | 'delivery' | 'recipes';
  author: string;
  readTime: string;
  publishedDate: string;
  tags: string[];
  image: string;
  content: string[];
  relatedProductIds?: string[];
}

export const ARTICLES_LIST: Article[] = [
  {
    id: 'art-bromate-free-bread',
    slug: 'why-bromate-free-bread-matters',
    title: '100% Bromate-Free Bread: Why Our Benin City Bakery Went Clean',
    subtitle: 'Whole eggs, full cream milk, and zero hazardous chemical oxidizers.',
    summary: 'Discover how Choplife Bakery crafts soft, dense, and naturally sweet loaves in GRA and Okabere without potassium bromate or artificial saccharine.',
    category: 'bakery',
    author: 'Chef Osas (Head Baker, Okabere)',
    readTime: '3 min read',
    publishedDate: 'October 2026',
    tags: ['Bakery', 'Bromate-Free', 'Healthy Eating', 'Special Bread', 'Benin Food'],
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
    content: [
      'Potassium bromate has historically been added to bread dough as an artificial flour improver to inflate volume cheaply. However, NAFDAC and global health agencies have banned bromate due to documented health and renal risks.',
      'At Choplife Bakery, our recipe relies on old-fashioned baking excellence: whole farm-fresh eggs, full-cream liquid milk, premium unbleached wheat flour, and natural yeast fermentation.',
      'The result is bread that is naturally golden, fragrant, dense, and crumb-soft. It stays fresh at room temperature for days without crumbling, making it the perfect match for hot Akara, fried eggs, or a cold bottle of Zobo.',
      'Available in Small (₦500), Special (₦1,200), Family (₦1,700), and Jumbo (₦2,000) loaves daily across our Okabere, GRA, and Ugbowo outlets.',
    ],
    relatedProductIds: ['prod-bakery-special-600g', 'prod-bakery-family-800g', 'prod-bakery-jumbo-1200g'],
  },
  {
    id: 'art-small-chops-guide',
    slug: 'ultimate-benin-city-small-chops-guide',
    title: 'The Ultimate Nigerian Small Chops Guide: From Street Food to Elite Shindigs',
    subtitle: 'Golden puff puff, crunchy spring rolls, crispy beef samosas, and peppered gizzard.',
    summary: 'Everything you need to know about crafting the perfect small chops box and why Benin City parties never start without Choplife.',
    category: 'culture',
    author: 'Choplife Republic Culinary Team',
    readTime: '4 min read',
    publishedDate: 'October 2026',
    tags: ['Small Chops', 'Puff Puff', 'Samosa', 'Party Food', 'Benin Life'],
    image: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=80',
    content: [
      'No Edo wedding, birthday, or corporate cocktail is complete without a tray of smoking-hot small chops. The term refers to Nigeria’s beloved bite-sized finger foods.',
      'The anatomy of a proper Choplife Republic box: golden, chewy puff puff with just a touch of nutmeg; hand-rolled beef samosas seasoned with habanero and spring onions; thin-crust spring rolls fried crisp; and succulent peppered gizzard or seasoned beef chunks.',
      'With our Custom Small Chops Box Builder, you can choose exactly how many pieces of each item go into your pack, or choose popular pre-set packs like the 2000 Mini Pack, 3700 Chicken Pack, or the crowd-favourite 5500 Munch Box.',
    ],
    relatedProductIds: ['prod-sc-box-custom', 'prod-sc-2000-mini', 'prod-sc-5500-munch'],
  },
  {
    id: 'art-firewood-party-jollof',
    slug: 'secret-to-firewood-smoky-party-jollof',
    title: 'Firewood Smoky Party Jollof: Why Pot Bottom Crust Hits Different',
    subtitle: 'The authentic technique behind the distinctive smoky party flavour.',
    summary: 'How our chefs achieve that unmistakable outdoor wedding jollof flavour in our commercial kitchens using cast-iron pots and slow wood-fire reduction.',
    category: 'recipes',
    author: 'Chef Ese (QSR Kitchen Lead)',
    readTime: '4 min read',
    publishedDate: 'September 2026',
    tags: ['Party Jollof', 'Nigerian Food', 'Firewood Smoke', 'Suya Chicken', 'QSR'],
    image: 'https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=800&q=80',
    content: [
      'The golden standard of Nigerian Jollof rice is that distinct firewood aroma. It is not just about tomatoes and onions; it is about the gentle charring that happens at the bottom of the pot (known affectionately as "elepo" or the bottom pot).',
      'At Choplife Republic, our jollof base is slowly reduced with roasted tatashe (red bell peppers), rodo (scotch bonnets), fresh ginger, and rich beef stock before the grains are steamed under foil to trap every drop of smoky essence.',
      'Paired with our charcoal-grilled quarter chicken, peppered snails, or crispy fried plantain dodo, it delivers 100% maximum enjoyment every single time.',
    ],
    relatedProductIds: ['prod-rc-jollof-combo', 'prod-gr-chicken-quarter', 'prod-pl-dodo-portion'],
  },
  {
    id: 'art-benin-delivery-logistics',
    slug: 'benin-city-food-delivery-coverage',
    title: 'Benin City Delivery Guide: 30–90 Minute Coverage Across 3 Flagship Axes',
    subtitle: 'Navigating Okabere, GRA, and Ugbowo with thermal-sealed packaging.',
    summary: 'Learn how our dispatch dispatchers and motorcycle fleet deliver piping-hot food across Benin City with thermal insulated bags and real-time tracking.',
    category: 'delivery',
    author: 'Choplife Logistics Desk',
    readTime: '3 min read',
    publishedDate: 'October 2026',
    tags: ['Delivery', 'Benin City', 'Logistics', 'GRA', 'Ugbowo', 'Okabere'],
    image: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=800&q=80',
    content: [
      'Benin City is vibrant, expansive, and fast-moving. To guarantee that crispy small chops do not turn soggy and whole grilled fish stays burning hot, Choplife Republic operates three strategically positioned distribution hubs:',
      '1. Okabere Kitchen (2 Okabere Street, Off Sapele Road, Benin City, Edo)\n2. GRA Kitchen (8a Okogo Street, Opposite Wesley Hotel, Off Akhionbare, G.R.A., Benin City, Edo)\n3. Ugbowo Kitchen (Petom Filling Station, Opposite S & T Barracks, Isihor, Edo)',
      'Every order is sealed in thermal heat-retention bags with tamper-evident seals. Standard delivery takes 30 to 90 minutes depending on peak traffic. You can track your rider in real time and receive browser push notifications as soon as your meal departs.',
    ],
    relatedProductIds: ['prod-sc-5500-munch', 'prod-sh-chicken'],
  },
  {
    id: 'art-hosting-parties',
    slug: 'hosting-feasts-and-events-in-benin',
    title: 'The Party Host’s Playbook: Estimating Small Chops & Feasts for 10 to 500 Guests',
    subtitle: 'Calculate quantities, avoid food waste, and keep all your guests raving.',
    summary: 'A simple, practical guide for event planners, brides, and corporate hosts on ordering small chops platters and party packs.',
    category: 'events',
    author: 'Choplife Events Team',
    readTime: '5 min read',
    publishedDate: 'September 2026',
    tags: ['Catering', 'Events', 'Party Platter', 'Corporate Feasts', 'Planners'],
    image: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=800&q=80',
    content: [
      'Planning an event in Benin City often brings the same anxiety: "Will the food be enough, and will it be hot when guests arrive?"',
      'The rule of thumb: for casual get-togethers (10–20 guests), estimate 3 pieces of puff puff, 1 samosa, 1 spring roll, and 1 protein per person (our Regular or Bronze Pack). For evening cocktail events, increase the finger-food ratio.',
      'For large celebrations over 50 guests, Choplife Republic provides specialized hot chafing dish setups, on-site live small chops frying stations, and branded customized takeaway packs.',
    ],
    relatedProductIds: ['prod-sc-regular-21000', 'prod-sc-bronze-49500'],
  },
];
