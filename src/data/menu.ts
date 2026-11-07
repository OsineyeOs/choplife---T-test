import { MenuCategory, Product, Deal } from '../types';
import { APPROVED_BAKERY_PRODUCTS } from './approvedBakery';
import { APPROVED_SMALL_CHOPS_PRODUCTS } from './approvedSmallChops';
import { APPROVED_QSR_PRODUCTS } from './approvedQsr';
import { APPROVED_GRILLS_SNACKS_DRINKS_PRODUCTS } from './approvedGrillsSnacksDrinks';

export const MENU_CATEGORIES: MenuCategory[] = [
  {
    id: 'favourites',
    name: 'Favourites',
    tag: 'Popular & Top Rated',
    description: 'The most loved dishes across Benin City based on live customer demand.',
    icon: '🔥',
    badge: 'Popular',
  },
  {
    id: 'food',
    name: 'Food',
    tag: 'Authentic Nigerian Dishes',
    description: 'Party Jollof, Fried Rice, Village Rice, Yam specials, Egusi, Banga, Black Soup, Swallows & Combos.',
    icon: '🍲',
  },
  {
    id: 'protein',
    name: 'Proteins',
    tag: 'Seasoned & Golden Grills',
    description: 'Crispy Fried Chicken, Golden Turkey, Fried Beef, Fresh Fish, Peppered Gizzard, and Suya.',
    icon: '🍗',
  },
  {
    id: 'small-chops',
    name: 'Small Chops & Platters',
    tag: 'Benin City #1 Ranked',
    description: 'Mini Packs, Munch Boxes, Samosas, Spring Rolls, Puff Puff, Corndogs, Regular, and Party Platters.',
    icon: '🥟',
    badge: 'Signature',
  },
  {
    id: 'snacks',
    name: 'Snacks & Shawarma',
    tag: 'Fresh Daily Pastries',
    description: 'Toasted Chicken Shawarma, Chicken Pies, Doughnuts, Sausage Rolls, and Golden Chips.',
    icon: '🌯',
  },
  {
    id: 'drinks',
    name: 'Drinks',
    tag: 'Chilled Refreshment & Parfaits',
    description: 'Natural Chilled Zobo, Tiger Nut, Chivita, Cold Soft Drinks, Table Water, and Greek Yoghurt Parfaits.',
    icon: '🥤',
  },
  {
    id: 'bakery',
    name: 'Bakery',
    tag: '100% Bromate-Free Bread',
    description: 'Special Bread baked daily (350g, 600g, 800g Family, 1.2kg Jumbo) with whole eggs & full cream milk.',
    icon: '🍞',
    badge: 'Fresh Daily',
  },
  {
    id: 'packaging',
    name: 'Packaging',
    tag: 'Boxes, Bags & Trays',
    description: 'Food-grade disposable meal takeaway packs, foil trays, and branded carrier bags.',
    icon: '📦',
  },
  {
    id: 'events',
    name: 'Experiences & Events',
    tag: 'Paint & Sip Sessions',
    description: 'Creative art sessions, social dining, and reserved spaces at Choplife GRA Benin City.',
    icon: '🎨',
  },
];

export const MASTER_PRODUCTS: Product[] = [
  ...APPROVED_SMALL_CHOPS_PRODUCTS,
  ...APPROVED_BAKERY_PRODUCTS,
  ...APPROVED_QSR_PRODUCTS,
  ...APPROVED_GRILLS_SNACKS_DRINKS_PRODUCTS,
];

// Authoritative Promotions mapped strictly to existing approved Food Combos & Small Chops Platters
export const DEALS_LIST: Deal[] = [
  // 1. Food Combos (Approved Existing Products)
  {
    id: 'prod-qsr-combo-beef',
    title: 'Choplife Beef Combo',
    badge: 'Approved Food Combo',
    tagline: 'Hearty Everyday Meal Combo • Freshly Prepared to Order',
    components: [
      { productId: 'prod-qsr-combo-beef', name: 'Choplife Combo Beef', unitPrice: 4000, quantity: 1 },
    ],
    originalPrice: 4000,
    dealPrice: 4000,
    savings: 0,
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80',
    itemsIncluded: [
      'Full portion of Party Jollof or Fried Rice',
      'Succulent Seasoned Fried Beef',
      'Sweet Fried Plantain Portion',
      'Chilled Soft Drink',
    ],
    description: 'Complete single-serve Nigerian rice meal paired with seasoned beef, sweet plantain, and a cold drink.',
    isPopular: true,
  },
  {
    id: 'prod-qsr-combo-chicken',
    title: 'Choplife Chicken Combo',
    badge: 'Approved Food Combo',
    tagline: 'Bestselling Executive Lunch Combo • Ready in ~15 Mins',
    components: [
      { productId: 'prod-qsr-combo-chicken', name: 'Choplife Combo Chicken', unitPrice: 5000, quantity: 1 },
    ],
    originalPrice: 5000,
    dealPrice: 5000,
    savings: 0,
    image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=1200&q=80',
    itemsIncluded: [
      'Full portion of Party Jollof or Fried Rice',
      'Golden Fried Chicken Quarter',
      'Sweet Fried Plantain Portion',
      'Chilled Soft Drink',
    ],
    description: 'Customer-favourite smoky Jollof or Fried Rice served with golden chicken, plantain, and a chilled drink.',
    isPopular: true,
  },
  {
    id: 'prod-qsr-combo-fish',
    title: 'Choplife Fish Combo',
    badge: 'Approved Food Combo',
    tagline: 'Premium Seafood & Rice Combo • Rich Coastal Spice',
    components: [
      { productId: 'prod-qsr-combo-fish', name: 'Choplife Combo Fish', unitPrice: 6000, quantity: 1 },
    ],
    originalPrice: 6000,
    dealPrice: 6000,
    savings: 0,
    image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1200&q=80',
    itemsIncluded: [
      'Full portion of Party Jollof or Fried Rice',
      'Crispy Croaker/Hake Fish Steak',
      'Sweet Fried Plantain Portion',
      'Chilled Soft Drink',
    ],
    description: 'Crispy seasoned Croaker/Hake fish paired with smoky rice, fried plantain, and a refreshing drink.',
    isPopular: true,
  },
  {
    id: 'prod-qsr-spaghetti-combo',
    title: 'Choplife Spaghetti Combo',
    badge: 'Approved Food Combo',
    tagline: 'Quick Campus & Office Favourite • Savoury Stir-Fry',
    components: [
      { productId: 'prod-qsr-spaghetti-combo', name: 'Choplife Spaghetti Combo', unitPrice: 4000, quantity: 1 },
    ],
    originalPrice: 4000,
    dealPrice: 4000,
    savings: 0,
    image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1200&q=80',
    itemsIncluded: [
      'Full portion of Stir-Fried Jollof Spaghetti',
      'Golden Fried Beef or Chicken',
      'Sweet Fried Plantain Portion',
      'Chilled Soft Drink',
    ],
    description: 'Rich stir-fried Jollof spaghetti served hot with protein, sweet plantain, and a chilled drink.',
    isPopular: true,
  },
  // 2. Small Chops Combos / Platters / Party Packs (Approved Existing Products)
  {
    id: 'prod-sc-regular-21000',
    title: 'Regular (Platter)',
    badge: 'Approved Small Chops Platter',
    tagline: 'Sharing Platter for 3–5 Guests • 14 Pieces + Chips & Shawarma',
    components: [
      { productId: 'prod-sc-regular-21000', name: 'Regular', unitPrice: 21000, quantity: 1 },
    ],
    originalPrice: 21000,
    dealPrice: 21000,
    savings: 0,
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=80',
    itemsIncluded: [
      '2 Medium Golden Fried Turkey Cuts',
      '2 Crunchy Beef Samosas',
      '2 Crispy Spring Rolls',
      '1 Juicy Sausage',
      '5 Sweet Golden Puff Puff',
      '1 Portion of Hot Crispy Chips',
      '1 Chicken Sharwama (Cut in Two)',
    ],
    description: 'Ideal sharing platter for small hangouts, featuring golden turkey, pastries, hot chips, and shawarma.',
    isPopular: true,
  },
  {
    id: 'prod-sc-orange-24900',
    title: 'Orange Platter',
    badge: 'Approved Small Chops Platter',
    tagline: 'Crowd-Pleaser Platter for 4–6 Guests • 23 Assorted Pieces + Chips',
    components: [
      { productId: 'prod-sc-orange-24900', name: 'Orange (Orange Platter)', unitPrice: 24900, quantity: 1 },
    ],
    originalPrice: 24900,
    dealPrice: 24900,
    savings: 0,
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=80',
    itemsIncluded: [
      '2 Medium Turkey Cuts',
      '3 Small Seasoned Chicken',
      '4 Spicy Beef Samosas',
      '4 Crispy Spring Rolls',
      '1 Portion of Hot Chips',
      '10 Golden Sweet Puff Puff',
    ],
    description: 'Generous family and friends platter loaded with turkey, chicken, samosas, spring rolls, puff puff, and chips.',
    isPopular: true,
  },
  {
    id: 'prod-sc-bronze-49500',
    title: 'Bronze Party Pack',
    badge: 'Approved Party Pack',
    tagline: 'Celebration Party Tray for 10–15 Guests • 88 Freshly Fried Pieces',
    components: [
      { productId: 'prod-sc-bronze-49500', name: 'Bronze', unitPrice: 49500, quantity: 1 },
    ],
    originalPrice: 49500,
    dealPrice: 49500,
    savings: 0,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80',
    itemsIncluded: [
      '15 Spicy Beef Samosas',
      '15 Crispy Spring Rolls',
      '12 Peppered Chicken Cuts',
      '30 Sweet Golden Puff Puff',
      '12 Spicy Gizzard Skewers',
      '4 Cheesy Golden Corndogs',
    ],
    description: 'Event-ready celebration tray packed with 88 freshly fried small chops, chicken, gizzard, and corndogs.',
    isPopular: true,
  },
  {
    id: 'prod-sc-turkey-fest',
    title: 'Turkey Fest',
    badge: 'Approved Event Banquet',
    tagline: 'Ultimate All-Turkey Banquet with 15+ Golden Fried Turkey Cuts & Finger Foods',
    components: [
      { productId: 'prod-sc-turkey-fest', name: 'Turkey Fest', unitPrice: 81500, quantity: 1 },
    ],
    originalPrice: 81500,
    dealPrice: 81500,
    savings: 0,
    image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=1200&q=80',
    itemsIncluded: [
      '15+ Golden Fried Medium Turkey Cuts',
      'Large Assortment of Spring Rolls & Samosas',
      'Golden Sweet Puff Puff Tray',
      'Crispy Seasoned Hot Chips Portion',
    ],
    description: 'The ultimate all-turkey event banquet with 15+ golden fried turkey cuts & sides.',
    isPopular: true,
  },
];

export const DEALS = DEALS_LIST;
