import type {
  DbDatabase,
  DbProductItem,
  DbPackageComponent,
  DbDiscountConfig,
  DbWholesalePricingConfig,
  DbPromotionRulesConfig,
  DbCheckItem,
} from '../db/schemaTypes.ts';

export const ARCHIVED_PDF_PRODUCT_IDS = [
  'prod-sc-big-flex',
  'prod-sc-genz-baddie',
  'prod-sc-big-mood',
  'prod-sc-chicken-chips',
  'prod-sc-turkey-chips',
  'prod-sc-ashes',
  'prod-sc-gold',
  'prod-sc-sapphire',
  'prod-sc-mango',
  'prod-sc-silver',
  'prod-sc-tripple',
  'prod-sc-maroon',
  'prod-sc-lime',
  'prod-sc-easy',
  'prod-sc-bobo',
  'prod-sc-purple',
  'prod-sc-delight',
  'prod-sc-special',
  'prod-sc-oga-platter',
  'prod-sc-red',
  'prod-sc-lemon',
  'prod-qsr-bloom',
  'prod-sc-deluxe-package',
  'prod-sc-big-chief',
  'prod-sc-queens-order',
  'prod-sc-royal',
  'prod-sc-wine',
  'prod-sc-peach',
  'prod-sc-ceo-151000',
  'prod-qsr-royalty',
  'prod-qsr-crown',
  'prod-sc-gbam',
  'prod-sc-classic-package',
  'prod-sc-grey',
  'prod-sc-chicken-chips-big',
  'prod-sc-turkey-fest',
  'prod-qsr-jolly-pack',
  'prod-qsr-quick-chow',
  'prod-qsr-combo-fish',
  'prod-qsr-belle-full',
] as const;

export const CANONICAL_PACKAGE_COMPOSITIONS: Record<
  string,
  {
    name?: string;
    basePrice?: number;
    status?: 'published' | 'paused' | 'archived' | 'draft';
    productType: 'package' | 'combo' | 'platter';
    compositionVersion: number;
    components: DbPackageComponent[];
    packaging?: {
      productId: string;
      name: string;
      quantity: number;
    };
    priceUnresolvedInArchivedPdf?: boolean;
    packagingUnspecifiedInArchivedPdf?: boolean;
    activationBlockedReason?: string;
  }
> = {
  'prod-sc-1000-mini': {
    productType: 'package',
    compositionVersion: 1,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-mini-meatpie', name: 'Mini Meat Pie (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 800, category: 'snacks' },
    ],
  },
  'prod-sc-1500-mini': {
    productType: 'package',
    compositionVersion: 1,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 500, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-300', name: 'Pack 300', quantity: 1 },
  },
  'prod-sc-2000-mini': {
    productType: 'package',
    compositionVersion: 1,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 3, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-sc-beef-single', name: 'Beef Small Chops', quantity: 1, unit: 'pcs', unitPrice: 400, category: 'small-chops' },
    ],
    packaging: { productId: 'prod-pack-300', name: 'Pack 300', quantity: 1 },
  },
  'prod-sc-2500-mini': {
    productType: 'package',
    compositionVersion: 1,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-sc-beef-single', name: 'Beef Small Chops', quantity: 2, unit: 'pcs', unitPrice: 400, category: 'small-chops' },
    ],
    packaging: { productId: 'prod-pack-300', name: 'Pack 300', quantity: 1 },
  },
  'prod-sc-3700-mini': {
    productType: 'package',
    compositionVersion: 1,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 2000, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-300', name: 'Pack 300', quantity: 1 },
  },
  'prod-sc-4200-mini': {
    productType: 'package',
    compositionVersion: 1,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 5, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-sc-beef-single', name: 'Beef Small Chops', quantity: 3, unit: 'pcs', unitPrice: 400, category: 'small-chops' },
    ],
    packaging: { productId: 'prod-pack-400', name: 'Pack 400', quantity: 1 },
  },
  'prod-sc-5500-munch': {
    productType: 'package',
    compositionVersion: 2,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 5, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-gizzard-cutout', name: 'Gizzard Cut Out (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 300, category: 'protein' },
      { productId: 'prod-meat-chicken-medium', name: 'Medium Chicken (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 2700, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-400', name: 'Pack 400', quantity: 1 },
  },
  'prod-sc-star-7500': {
    productType: 'package',
    compositionVersion: 1,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 2000, category: 'protein' },
      { productId: 'prod-meat-corn-dog', name: 'Corn Dog (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 600, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-500', name: 'Pack 500', quantity: 1 },
  },
  'prod-sc-easy-chow-8200': {
    productType: 'package',
    compositionVersion: 1,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 6, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 5000, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-500', name: 'Pack 500', quantity: 1 },
  },
  'prod-sc-new-white-9000': {
    productType: 'package',
    compositionVersion: 1,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 5, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 3, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 3, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-gizzard-cutout', name: 'Gizzard Cut Out (1 pc)', quantity: 3, unit: 'pcs', unitPrice: 300, category: 'protein' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 2000, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-500', name: 'Pack 500', quantity: 1 },
  },
  'prod-sc-pink-10500': {
    productType: 'package',
    compositionVersion: 1,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 8, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 3, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 3, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-sc-beef-single', name: 'Beef Small Chops', quantity: 3, unit: 'pcs', unitPrice: 400, category: 'small-chops' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 2000, category: 'protein' },
      { productId: 'prod-meat-gizzard-cutout', name: 'Gizzard Cut Out (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 300, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-600', name: 'Pack 600', quantity: 1 },
  },
  'prod-sc-white-13200': {
    productType: 'package',
    compositionVersion: 1,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-gizzard-cutout', name: 'Gizzard Cut Out (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 300, category: 'protein' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 3, unit: 'pcs', unitPrice: 2000, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-1000', name: 'Pack 1000', quantity: 1 },
  },
  'prod-sc-blue-14500': {
    productType: 'package',
    compositionVersion: 1,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 5, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 5, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 2000, category: 'protein' },
      { productId: 'prod-meat-gizzard-cutout', name: 'Gizzard Cut Out (1 pc)', quantity: 3, unit: 'pcs', unitPrice: 300, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-600', name: 'Pack 600', quantity: 1 },
  },
  'prod-sc-regular-21000': {
    status: 'published',
    productType: 'package',
    compositionVersion: 1,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 5, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-sausage-single', name: 'Sausage (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 600, category: 'snacks' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 1, unit: 'portion', unitPrice: 2000, category: 'snacks' },
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-snack-shawarma', name: 'Shawarma cut in 2', quantity: 1, unit: 'pcs', unitPrice: 3500, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-1000', name: 'Pack 1000', quantity: 1 },
  },
  'prod-sc-orange-24900': {
    status: 'published',
    productType: 'platter',
    compositionVersion: 1,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-gizzard-cutout', name: 'Gizzard Cut Out (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 300, category: 'protein' },
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 2000, category: 'protein' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 1, unit: 'portion', unitPrice: 2000, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-1000', name: 'Pack 1000', quantity: 1 },
  },
  'prod-sc-apple-31500': {
    status: 'published',
    productType: 'platter',
    compositionVersion: 1,
    components: [
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 5, unit: 'pcs', unitPrice: 100, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-1000', name: 'Pack 1000', quantity: 1 },
  },
  'prod-sc-bronze-49500': {
    status: 'published',
    productType: 'platter',
    compositionVersion: 1,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 30, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 15, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 15, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-gizzard-cutout', name: 'Gizzard Cut Out (1 pc)', quantity: 12, unit: 'pcs', unitPrice: 300, category: 'protein' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 12, unit: 'pcs', unitPrice: 2000, category: 'protein' },
      { productId: 'prod-meat-corn-dog', name: 'Corn Dog (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 600, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-1500', name: 'Pack 1500', quantity: 1 },
  },
  'prod-sc-prince-order': {
    status: 'published',
    productType: 'platter',
    compositionVersion: 1,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 20, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 25, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 25, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 22, unit: 'pcs', unitPrice: 2000, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-1500', name: 'Pack 1500', quantity: 1 },
  },
  'prod-sc-big-yellow': {
    status: 'published',
    productType: 'platter',
    compositionVersion: 1,
    components: [
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 30, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 30, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 25, unit: 'pcs', unitPrice: 2000, category: 'protein' },
      { productId: 'prod-meat-gizzard-cutout', name: 'Gizzard Cut Out (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 300, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-2000', name: 'Pack 2000', quantity: 1 },
  },
  'prod-sc-yellow-95800': {
    status: 'published',
    productType: 'platter',
    compositionVersion: 1,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 50, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 30, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 30, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 24, unit: 'pcs', unitPrice: 2000, category: 'protein' },
      { productId: 'prod-meat-corn-dog', name: 'Corn Dog (1 pc)', quantity: 8, unit: 'pcs', unitPrice: 600, category: 'protein' },
      { productId: 'prod-meat-gizzard-cutout', name: 'Gizzard Cut Out (1 pc)', quantity: 20, unit: 'pcs', unitPrice: 300, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-2000', name: 'Pack 2000', quantity: 1 },
  },
  'prod-qsr-combo-chicken': {
    status: 'published',
    productType: 'combo',
    compositionVersion: 2,
    components: [
      { productId: 'prod-qsr-jollof-rice', name: 'Jollof Rice (Portion)', quantity: 2, unit: 'portion', unitPrice: 1000, category: 'food' },
      { productId: 'prod-qsr-fried-rice', name: 'Fried Rice (Portion)', quantity: 2, unit: 'portion', unitPrice: 1000, category: 'food' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 2000, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-400', name: 'Pack 400', quantity: 1 },
  },
  'prod-qsr-combo-beef': {
    status: 'published',
    productType: 'combo',
    compositionVersion: 2,
    components: [
      { productId: 'prod-qsr-jollof-rice', name: 'Jollof Rice (Portion)', quantity: 2, unit: 'portion', unitPrice: 1000, category: 'food' },
      { productId: 'prod-qsr-fried-rice', name: 'Fried Rice (Portion)', quantity: 2, unit: 'portion', unitPrice: 1000, category: 'food' },
      { productId: 'prod-meat-fried-beef', name: 'Fried Beef (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 1400, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-400', name: 'Pack 400', quantity: 1 },
  },
  'prod-qsr-spaghetti-combo': {
    productType: 'combo',
    compositionVersion: 1,
    components: [
      { productId: 'prod-qsr-spaghetti', name: 'Spaghetti (Portion)', quantity: 3, unit: 'portion', unitPrice: 700, category: 'food' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 2000, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-400', name: 'Pack 400', quantity: 1 },
  },
  // ==========================================================
  // 31 PLATTERS & COMBOS FROM ACHIVED.pdf (Updated & Paused)
  // ==========================================================
  'prod-sc-big-flex': {
    name: 'Big Flex',
    basePrice: 20000,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-meat-chicken-medium', name: 'Medium Chicken (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 2700, category: 'protein' },
      { productId: 'prod-snack-shawarma', name: 'Shawarma cut in 2', quantity: 1, unit: 'pcs', unitPrice: 4500, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 1, unit: 'portion', unitPrice: 1700, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-1000', name: 'Pack 1000', quantity: 1 },
  },
  'prod-sc-genz-baddie': {
    name: 'Gen Z Baddie',
    basePrice: 9000,
    status: 'published',
    productType: 'package',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 3, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 3, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 5, unit: 'pcs', unitPrice: 100, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-500', name: 'Pack 500', quantity: 1 },
  },
  'prod-sc-big-mood': {
    name: 'Big Mood',
    basePrice: 14100,
    status: 'published',
    productType: 'package',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 3, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 3, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 5, unit: 'pcs', unitPrice: 100, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-600', name: 'Pack 600', quantity: 1 },
  },
  'prod-sc-chicken-chips': {
    name: 'Chicken and Chips',
    basePrice: 6500,
    status: 'published',
    productType: 'combo',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-chicken-big', name: 'Big Chicken (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 4000, category: 'protein' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 1, unit: 'portion', unitPrice: 1700, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-500', name: 'Pack 500', quantity: 1 },
  },
  'prod-sc-turkey-chips': {
    name: 'Turkey and Chips',
    basePrice: 10500,
    status: 'published',
    productType: 'combo',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-turkey-big', name: 'Big Turkey (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 8000, category: 'protein' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 1, unit: 'portion', unitPrice: 1700, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-500', name: 'Pack 500', quantity: 1 },
  },
  'prod-sc-ashes': {
    name: 'Ashes',
    basePrice: 52000,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 15, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 15, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 20, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 6, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 2, unit: 'portion', unitPrice: 1700, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-1500', name: 'Pack 1500', quantity: 1 },
  },
  'prod-sc-gold': {
    name: 'Gold',
    basePrice: 70500,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 18, unit: 'pcs', unitPrice: 2000, category: 'protein' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 22, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 22, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 30, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-meat-gizzard-cutout', name: 'Gizzard Cut Out (1 pc)', quantity: 15, unit: 'pcs', unitPrice: 300, category: 'protein' },
      { productId: 'prod-meat-corn-dog', name: 'Corn Dog (1 pc)', quantity: 5, unit: 'pcs', unitPrice: 600, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-2000', name: 'Pack 2000', quantity: 1 },
  },
  'prod-sc-sapphire': {
    name: 'Sapphire',
    basePrice: 18800,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 20, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-meat-gizzard-cutout', name: 'Gizzard Cut Out (1 pc)', quantity: 6, unit: 'pcs', unitPrice: 300, category: 'protein' },
      { productId: 'prod-meat-turkey-big', name: 'Big Turkey (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 8000, category: 'protein' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 3, unit: 'pcs', unitPrice: 2000, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-1000', name: 'Pack 1000', quantity: 1 },
  },
  'prod-sc-mango': {
    name: 'Mango',
    basePrice: 13600,
    status: 'published',
    productType: 'package',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-chicken-big', name: 'Big Chicken (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 4000, category: 'protein' },
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-600', name: 'Pack 600', quantity: 1 },
  },
  'prod-sc-silver': {
    name: 'Silver',
    basePrice: 13300,
    status: 'published',
    productType: 'package',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-chicken-big', name: 'Big Chicken (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 4000, category: 'protein' },
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 5, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-meat-chicken-kebab', name: 'Kebab (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 1500, category: 'protein' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 1, unit: 'portion', unitPrice: 1700, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-600', name: 'Pack 600', quantity: 1 },
  },
  'prod-sc-tripple': {
    name: 'Tripple',
    basePrice: 17300,
    status: 'published',
    productType: 'package',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 3, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 1, unit: 'portion', unitPrice: 1700, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-600', name: 'Pack 600', quantity: 1 },
  },
  'prod-sc-maroon': {
    name: 'Maroon',
    basePrice: 23700,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 1, unit: 'portion', unitPrice: 1700, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-1000', name: 'Pack 1000', quantity: 1 },
  },
  'prod-sc-lime': {
    name: 'Lime',
    basePrice: 14500,
    status: 'published',
    productType: 'package',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-500', name: 'Pack 500', quantity: 1 },
  },
  'prod-sc-easy': {
    name: 'Easy',
    basePrice: 14800,
    status: 'published',
    productType: 'package',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-chicken-medium', name: 'Medium Chicken (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 2700, category: 'protein' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 2, unit: 'portion', unitPrice: 1700, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-600', name: 'Pack 600', quantity: 1 },
  },
  'prod-sc-bobo': {
    name: 'Bobo',
    basePrice: 18400,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 20, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 2, unit: 'portion', unitPrice: 1700, category: 'snacks' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 6, unit: 'pcs', unitPrice: 2000, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-1000', name: 'Pack 1000', quantity: 1 },
  },
  'prod-sc-purple': {
    name: 'Purple',
    basePrice: 26900,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 6, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 6, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 6, unit: 'pcs', unitPrice: 2000, category: 'protein' },
      { productId: 'prod-meat-chicken-big', name: 'Big Chicken (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 4000, category: 'protein' },
      { productId: 'prod-meat-gizzard-cutout', name: 'Gizzard Cut Out (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 300, category: 'protein' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 1, unit: 'portion', unitPrice: 1700, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-1000', name: 'Pack 1000', quantity: 1 },
  },
  'prod-sc-delight': {
    name: 'Delight',
    basePrice: 12800,
    status: 'published',
    productType: 'package',
    compositionVersion: 2,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-meat-turkey-big', name: 'Big Turkey (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 8000, category: 'protein' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 1, unit: 'portion', unitPrice: 1700, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-600', name: 'Pack 600', quantity: 1 },
  },
  'prod-sc-special': {
    name: 'Special',
    basePrice: 30200,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-turkey-big', name: 'Big Turkey (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 8000, category: 'protein' },
      { productId: 'prod-meat-chicken-big', name: 'Big Chicken (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 4000, category: 'protein' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 5, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 1, unit: 'portion', unitPrice: 1700, category: 'snacks' },
      { productId: 'prod-snack-sausage-single', name: 'Sausage (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-chicken-kebab', name: 'Kebab (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 1500, category: 'protein' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 2000, category: 'protein' },
      { productId: 'prod-snack-shawarma', name: 'Shawarma cut in 2', quantity: 1, unit: 'pcs', unitPrice: 4500, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-1500', name: 'Pack 1500', quantity: 1 },
  },
  'prod-sc-oga-platter': {
    name: 'Oga Platter',
    basePrice: 38700,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-chicken-kebab', name: 'Kebab (1 pc)', quantity: 5, unit: 'pcs', unitPrice: 1500, category: 'protein' },
      { productId: 'prod-meat-corn-dog', name: 'Corn Dog (1 pc)', quantity: 5, unit: 'pcs', unitPrice: 600, category: 'protein' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 3, unit: 'portion', unitPrice: 1700, category: 'snacks' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 6, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 8, unit: 'pcs', unitPrice: 2000, category: 'protein' },
      { productId: 'prod-meat-gizzard-cutout', name: 'Gizzard Cut Out (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 300, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-1500', name: 'Pack 1500', quantity: 1 },
  },
  'prod-sc-red': {
    name: 'Red',
    basePrice: 32400,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-chicken-big', name: 'Big Chicken (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 4000, category: 'protein' },
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 2, unit: 'portion', unitPrice: 1700, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 12, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 8, unit: 'pcs', unitPrice: 500, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-1000', name: 'Pack 1000', quantity: 1 },
  },
  'prod-sc-lemon': {
    name: 'Lemon',
    basePrice: 42400,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 2000, category: 'protein' },
      { productId: 'prod-meat-gizzard-cutout', name: 'Gizzard Cut Out (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 300, category: 'protein' },
      { productId: 'prod-meat-chicken-big', name: 'Big Chicken (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 4000, category: 'protein' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 20, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 1, unit: 'portion', unitPrice: 1700, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-1500', name: 'Pack 1500', quantity: 1 },
  },
  'prod-qsr-bloom': {
    name: 'Bloom',
    basePrice: 22500,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-drink-chi-active', name: 'Chivita Active', quantity: 1, unit: 'pcs', unitPrice: 2200, category: 'drinks' },
      { productId: 'prod-qsr-fried-rice', name: 'Fried Rice (Portion)', quantity: 3, unit: 'portion', unitPrice: 1200, category: 'food' },
      { productId: 'prod-qsr-jollof-rice', name: 'Jollof Rice (Portion)', quantity: 3, unit: 'portion', unitPrice: 1000, category: 'food' },
    ],
    packaging: { productId: 'prod-pack-2300', name: 'Pack 2300 (food tray)', quantity: 1 },
  },
  'prod-sc-deluxe-package': {
    name: 'Deluxe Package',
    basePrice: 42800,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-turkey-big', name: 'Big Turkey (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 8000, category: 'protein' },
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-gizzard-cutout', name: 'Gizzard Cut Out (1 pc)', quantity: 5, unit: 'pcs', unitPrice: 300, category: 'protein' },
      { productId: 'prod-meat-chicken-kebab', name: 'Kebab (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 1500, category: 'protein' },
      { productId: 'prod-snack-sausage-single', name: 'Sausage (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 2, unit: 'portion', unitPrice: 1700, category: 'snacks' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 2000, category: 'protein' },
      { productId: 'prod-snack-shawarma', name: 'Shawarma cut in 2', quantity: 1, unit: 'pcs', unitPrice: 4500, category: 'snacks' },
      { productId: 'prod-drink-hollandia', name: 'Hollandia Yoghurt', quantity: 1, unit: 'pcs', unitPrice: 2400, category: 'drinks' },
      { productId: 'prod-drink-chiexotic', name: 'Chi Exotic', quantity: 1, unit: 'pcs', unitPrice: 2200, category: 'drinks' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 8, unit: 'pcs', unitPrice: 100, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-1500', name: 'Pack 1500', quantity: 1 },
  },
  'prod-sc-big-chief': {
    name: 'Big Chief',
    basePrice: 64900,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 12, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 2, unit: 'portion', unitPrice: 1700, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-1500', name: 'Pack 1500', quantity: 1 },
  },
  'prod-sc-queens-order': {
    name: 'Queen’s Order',
    basePrice: 38200,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-snack-sausage-single', name: 'Sausage (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-corn-dog', name: 'Corn Dog (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 600, category: 'protein' },
      { productId: 'prod-meat-chicken-kebab', name: 'Kebab (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 1500, category: 'protein' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 2, unit: 'portion', unitPrice: 1700, category: 'snacks' },
      { productId: 'prod-meat-turkey-big', name: 'Big Turkey (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 8000, category: 'protein' },
      { productId: 'prod-meat-chicken-medium', name: 'Medium Chicken (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 2700, category: 'protein' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 5, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-1500', name: 'Pack 1500', quantity: 1 },
  },
  'prod-sc-royal': {
    name: 'Royal',
    basePrice: 49500,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-turkey-big', name: 'Big Turkey (1 pc)', quantity: 3, unit: 'pcs', unitPrice: 8000, category: 'protein' },
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-meat-gizzard-cutout', name: 'Gizzard Cut Out (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 300, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-1500', name: 'Pack 1500', quantity: 1 },
  },
  'prod-sc-wine': {
    name: 'Wine',
    basePrice: 64000,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 20, unit: 'pcs', unitPrice: 100, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-2000', name: 'Pack 2000', quantity: 1 },
  },
  'prod-sc-peach': {
    name: 'Peach',
    basePrice: 47300,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 2, unit: 'portion', unitPrice: 1700, category: 'snacks' },
      { productId: 'prod-meat-turkey-big', name: 'Big Turkey (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 8000, category: 'protein' },
      { productId: 'prod-meat-chicken-big', name: 'Big Chicken (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 4000, category: 'protein' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 22, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 15, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 15, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-gizzard-cutout', name: 'Gizzard Cut Out (1 pc)', quantity: 5, unit: 'pcs', unitPrice: 300, category: 'protein' },
      { productId: 'prod-meat-chicken-medium', name: 'Medium Chicken (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 2700, category: 'protein' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 2000, category: 'protein' },
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 5000, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-1500', name: 'Pack 1500', quantity: 1 },
  },
  'prod-sc-ceo-151000': {
    name: 'CEO',
    basePrice: 156000,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-snack-shawarma', name: 'Shawarma cut in 2', quantity: 3, unit: 'pcs', unitPrice: 4500, category: 'snacks' },
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 20, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-meat-corn-dog', name: 'Corn Dog (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 600, category: 'protein' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 15, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-chicken-kebab', name: 'Kebab (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 1500, category: 'protein' },
      { productId: 'prod-meat-gizzard-cutout', name: 'Gizzard Cut Out (1 pc)', quantity: 20, unit: 'pcs', unitPrice: 300, category: 'protein' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 2, unit: 'portion', unitPrice: 1700, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-4000', name: 'Pack 4000', quantity: 1 },
  },
  'prod-qsr-royalty': {
    name: 'Royalty',
    basePrice: 30900,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-drink-chi-active', name: 'Chivita Active', quantity: 1, unit: 'pcs', unitPrice: 2200, category: 'drinks' },
      { productId: 'prod-drink-schweppes', name: 'Schweppes', quantity: 1, unit: 'pcs', unitPrice: 800, category: 'drinks' },
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-meat-chicken-medium', name: 'Medium Chicken (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 2700, category: 'protein' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-qsr-jollof-rice', name: 'Jollof Rice (Portion)', quantity: 3, unit: 'portion', unitPrice: 1000, category: 'food' },
      { productId: 'prod-qsr-fried-rice', name: 'Fried Rice (Portion)', quantity: 3, unit: 'portion', unitPrice: 1200, category: 'food' },
    ],
    packaging: { productId: 'prod-pack-3500', name: 'Pack 3500 (food tray)', quantity: 1 },
  },
  'prod-qsr-crown': {
    name: 'Crown',
    basePrice: 36800,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-qsr-jollof-rice', name: 'Jollof Rice (Portion)', quantity: 2, unit: 'portion', unitPrice: 1000, category: 'food' },
      { productId: 'prod-qsr-fried-rice', name: 'Fried Rice (Portion)', quantity: 2, unit: 'portion', unitPrice: 1200, category: 'food' },
      { productId: 'prod-qsr-village-rice', name: 'Village Rice (Portion)', quantity: 2, unit: 'portion', unitPrice: 1600, category: 'food' },
      { productId: 'prod-qsr-spaghetti', name: 'Spaghetti (Portion)', quantity: 2, unit: 'portion', unitPrice: 700, category: 'food' },
      { productId: 'prod-qsr-plantain', name: 'Plantain (Portion)', quantity: 2, unit: 'portion', unitPrice: 500, category: 'food' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 7, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-fish-croaker', name: 'Fish (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 3000, category: 'protein' },
      { productId: 'prod-meat-chicken-big', name: 'Big Chicken (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 4000, category: 'protein' },
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-qsr-moi-moi', name: 'Moi Moi', quantity: 1, unit: 'pcs', unitPrice: 1200, category: 'food' },
      { productId: 'prod-drink-chiexotic', name: 'Chi Exotic', quantity: 1, unit: 'pcs', unitPrice: 2200, category: 'drinks' },
      { productId: 'prod-snack-salad', name: 'Salad / Coleslaw', quantity: 1, unit: 'portion', unitPrice: 800, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-3500', name: 'Pack 3500 (food tray)', quantity: 1 },
    packagingUnspecifiedInArchivedPdf: true,
  },
  'prod-sc-gbam': {
    name: 'Gbam',
    basePrice: 6300,
    status: 'published',
    productType: 'package',
    compositionVersion: 2,
    components: [
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 8, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 2000, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-500', name: 'Pack 500', quantity: 1 },
  },
  'prod-sc-classic-package': {
    name: 'Classic',
    basePrice: 11300,
    status: 'published',
    productType: 'package',
    compositionVersion: 2,
    components: [
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-meat-chicken-kebab', name: 'Kebab (1 pc)', quantity: 4, unit: 'pcs', unitPrice: 1500, category: 'protein' },
      { productId: 'prod-qsr-pepper-sauce', name: 'Extra Pepper Sauce', quantity: 1, unit: 'portion', unitPrice: 300, category: 'food' },
    ],
    packaging: { productId: 'prod-pack-600', name: 'Pack 600', quantity: 1 },
  },
  'prod-sc-grey': {
    name: 'Grey',
    basePrice: 20700,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-turkey-medium', name: 'Medium Turkey (1 pc)', quantity: 2, unit: 'pcs', unitPrice: 5000, category: 'protein' },
      { productId: 'prod-meat-chicken-big', name: 'Big Chicken (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 4000, category: 'protein' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 1, unit: 'portion', unitPrice: 1700, category: 'snacks' },
      { productId: 'prod-snack-puff-puff-single', name: 'Puff Puff (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 100, category: 'snacks' },
      { productId: 'prod-snack-samosa-single', name: 'Samosa (1 pc)', quantity: 3, unit: 'pcs', unitPrice: 500, category: 'snacks' },
      { productId: 'prod-snack-springroll-single', name: 'Spring Roll (1 pc)', quantity: 3, unit: 'pcs', unitPrice: 500, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-1000', name: 'Pack 1000', quantity: 1 },
  },
  'prod-sc-chicken-chips-big': {
    name: 'Chicken and Chips Big Size',
    basePrice: 52300,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 22, unit: 'pcs', unitPrice: 2000, category: 'protein' },
      { productId: 'prod-snack-chips-portion', name: 'Portion of Chips', quantity: 4, unit: 'portion', unitPrice: 1700, category: 'snacks' },
    ],
    packaging: { productId: 'prod-pack-1500', name: 'Pack 1500', quantity: 1 },
  },
  'prod-sc-turkey-fest': {
    name: 'Turkey Fest',
    basePrice: 81500,
    status: 'published',
    productType: 'platter',
    compositionVersion: 2,
    components: [
      { productId: 'prod-meat-turkey-big', name: 'Big Turkey (1 pc)', quantity: 10, unit: 'pcs', unitPrice: 8000, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-1500', name: 'Pack 1500', quantity: 1 },
  },
  'prod-qsr-jolly-pack': {
    name: 'Jolly Pack',
    basePrice: 6100,
    status: 'published',
    productType: 'combo',
    compositionVersion: 2,
    components: [
      { productId: 'prod-qsr-jollof-rice', name: 'Jollof Rice (Portion)', quantity: 3, unit: 'portion', unitPrice: 1000, category: 'food' },
      { productId: 'prod-meat-chicken-medium', name: 'Medium Chicken (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 2700, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-400', name: 'Pack 400', quantity: 1 },
  },
  'prod-qsr-quick-chow': {
    name: 'Quick Chow',
    basePrice: 9600,
    status: 'published',
    productType: 'combo',
    compositionVersion: 2,
    components: [
      { productId: 'prod-qsr-jollof-rice', name: 'Jollof Rice (Portion)', quantity: 5, unit: 'portion', unitPrice: 1000, category: 'food' },
      { productId: 'prod-meat-fried-beef', name: 'Fried Beef (1 pc)', quantity: 3, unit: 'pcs', unitPrice: 1400, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-400', name: 'Pack 400', quantity: 1 },
  },
  'prod-qsr-combo-fish': {
    name: 'Fish Combo',
    status: 'published',
    productType: 'combo',
    compositionVersion: 2,
    components: [
      { productId: 'prod-qsr-jollof-rice', name: 'Jollof Rice (Portion)', quantity: 2, unit: 'portion', unitPrice: 1000, category: 'food' },
      { productId: 'prod-qsr-fried-rice', name: 'Fried Rice (Portion)', quantity: 2, unit: 'portion', unitPrice: 1200, category: 'food' },
      { productId: 'prod-fish-croaker', name: 'Fish (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 3000, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-400', name: 'Pack 400', quantity: 1 },
    priceUnresolvedInArchivedPdf: true,
    activationBlockedReason: 'Price not stated in ACHIVED (2).pdf — requires authorised price confirmation before activation.',
  },
  'prod-qsr-belle-full': {
    name: 'Belleful',
    basePrice: 5400,
    status: 'published',
    productType: 'combo',
    compositionVersion: 2,
    components: [
      { productId: 'prod-qsr-jollof-rice', name: 'Jollof Rice (Portion)', quantity: 3, unit: 'portion', unitPrice: 1000, category: 'food' },
      { productId: 'prod-meat-chicken-small', name: 'Small Chicken (1 pc)', quantity: 1, unit: 'pcs', unitPrice: 2000, category: 'protein' },
    ],
    packaging: { productId: 'prod-pack-400', name: 'Pack 400', quantity: 1 },
  },
};

export const CANONICAL_BREAD_WHOLESALE_CONFIGS: Record<string, DbWholesalePricingConfig> = {
  'prod-bakery-special-350g': {
    enabled: true,
    retailPrice: 500,
    wholesalePrice: 400,
    minQuantity: 20,
    allowSkuPooling: false,
    poolingGroup: 'bread',
    preventExtraDiscount: false,
    tiers: [
      { minQuantity: 20, unitPrice: 400, label: 'Wholesale (20+ loaves)' },
      { minQuantity: 50, unitPrice: 380, label: 'Distributor (50+ loaves)' },
    ],
  },
  'prod-bakery-special-600g': {
    enabled: true,
    retailPrice: 1200,
    wholesalePrice: 900,
    minQuantity: 10,
    allowSkuPooling: false,
    poolingGroup: 'bread',
    preventExtraDiscount: false,
    tiers: [
      { minQuantity: 10, unitPrice: 900, label: 'Wholesale (10+ loaves)' },
      { minQuantity: 30, unitPrice: 850, label: 'Distributor (30+ loaves)' },
    ],
  },
  'prod-bakery-family-800g': {
    enabled: true,
    retailPrice: 1700,
    wholesalePrice: 1500,
    minQuantity: 10,
    allowSkuPooling: false,
    poolingGroup: 'bread',
    preventExtraDiscount: false,
    tiers: [
      { minQuantity: 10, unitPrice: 1500, label: 'Wholesale (10+ loaves)' },
      { minQuantity: 30, unitPrice: 1450, label: 'Distributor (30+ loaves)' },
    ],
  },
  'prod-bakery-jumbo-1200g': {
    enabled: true,
    retailPrice: 2000,
    wholesalePrice: 1800,
    minQuantity: 5,
    allowSkuPooling: false,
    poolingGroup: 'bread',
    preventExtraDiscount: false,
    tiers: [
      { minQuantity: 5, unitPrice: 1800, label: 'Wholesale (5+ loaves)' },
      { minQuantity: 20, unitPrice: 1700, label: 'Distributor (20+ loaves)' },
    ],
  },
};

export interface PackageValidationResult {
  valid: boolean;
  errors: string[];
  normalizedComponents?: DbPackageComponent[];
  normalizedPackaging?: {
    productId: string;
    name: string;
    quantity: number;
  };
  normalizedDiscountConfig?: DbDiscountConfig;
  normalizedWholesalePricing?: DbWholesalePricingConfig;
  normalizedPromotionRules?: DbPromotionRulesConfig;
}

/**
 * Validates productType, package/combo/platter composition, circular references,
 * discount rules, wholesale pricing tiers, packaging associations, and conditional promotion rules.
 */
export function validateProductCommercialConfig(
  db: DbDatabase,
  productId: string,
  payload: {
    productType?: string;
    status?: string;
    basePrice?: number;
    components?: any[];
    packaging?: any;
    discountConfig?: any;
    wholesalePricing?: any;
    promotionRules?: any;
  }
): PackageValidationResult {
  const errors: string[] = [];
  const menuProducts = db.menuProducts || {};
  const productType = (payload.productType || 'standard') as DbProductItem['productType'];
  const validTypes = ['standard', 'combo', 'platter', 'package', 'promotion'];

  if (!validTypes.includes(String(productType))) {
    errors.push(`Invalid productType '${productType}'. Allowed: ${validTypes.join(', ')}.`);
  }

  const isCompositeType = productType === 'package' || productType === 'combo' || productType === 'platter';
  let normalizedComponents: DbPackageComponent[] | undefined = undefined;

  if (Array.isArray(payload.components) && payload.components.length > 0) {
    normalizedComponents = [];
    const seenComponentIds = new Set<string>();

    for (let i = 0; i < payload.components.length; i++) {
      const rawComp = payload.components[i];
      const compId = String(rawComp?.productId || '').trim();
      const qty = Number(rawComp?.quantity);

      if (!compId) {
        errors.push(`Component #${i + 1} is missing a valid productId.`);
        continue;
      }
      if (compId === productId) {
        errors.push(`Package '${productId}' cannot reference itself as a component.`);
        continue;
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        errors.push(`Component '${compId}' must have a positive quantity greater than 0.`);
        continue;
      }

      const targetProd = menuProducts[compId];
      if (!targetProd && !rawComp?.name) {
        errors.push(`Component product '${compId}' does not exist in the menu catalogue.`);
        continue;
      }

      // Circular dependency check up to depth 4
      const visited = new Set<string>([productId]);
      const checkCycle = (currentId: string, depth: number): boolean => {
        if (depth > 4) return true;
        if (visited.has(currentId)) return true;
        const curr = menuProducts[currentId];
        if (!curr || !Array.isArray(curr.components) || curr.components.length === 0) return false;
        visited.add(currentId);
        for (const child of curr.components) {
          if (checkCycle(child.productId, depth + 1)) return true;
        }
        visited.delete(currentId);
        return false;
      };

      if (checkCycle(compId, 1)) {
        errors.push(`Circular or overly deep package reference detected involving component '${compId}'.`);
        continue;
      }

      if (seenComponentIds.has(compId)) {
        // Merge duplicate component rows cleanly or flag if needed
        const existing = normalizedComponents.find((c) => c.productId === compId);
        if (existing) {
          existing.quantity += qty;
          continue;
        }
      }
      seenComponentIds.add(compId);

      normalizedComponents.push({
        productId: compId,
        name: targetProd?.name || String(rawComp.name || compId),
        quantity: qty,
        unit: String(rawComp.unit || 'pcs'),
        unitPrice: Number(targetProd?.basePrice ?? rawComp.unitPrice ?? 0),
        category: targetProd?.category,
      });
    }
  } else if (isCompositeType && payload.status === 'published') {
    errors.push(`A published ${productType} must contain at least one valid component product.`);
  }

  // Validate discountConfig if provided
  let normalizedDiscountConfig: DbDiscountConfig | undefined = undefined;
  if (payload.discountConfig && typeof payload.discountConfig === 'object') {
    const dc = payload.discountConfig;
    const enabled = Boolean(dc.enabled);
    const rawType = dc.type || dc.discountType;
    const type = rawType === 'fixed' ? 'fixed' : 'percentage';
    const value = Number(dc.value ?? dc.discountValue ?? 0);
    if (enabled) {
      if (!Number.isFinite(value) || value < 0) {
        errors.push('Discount value must be a non-negative number.');
      }
      if (type === 'percentage' && value > 100) {
        errors.push('Percentage discount cannot exceed 100%.');
      }
      if (type === 'fixed' && payload.basePrice !== undefined && value > Number(payload.basePrice)) {
        errors.push(`Fixed discount (₦${value}) cannot exceed the product base price (₦${payload.basePrice}).`);
      }
    }
    normalizedDiscountConfig = {
      enabled,
      type,
      discountType: type,
      value: Math.max(0, value || 0),
      discountValue: Math.max(0, value || 0),
      reason: (dc.reason || dc.label) ? String(dc.reason || dc.label).trim() : undefined,
      startDate: dc.startDate ? String(dc.startDate).trim() : undefined,
      endDate: dc.endDate ? String(dc.endDate).trim() : undefined,
      allowedBranches: Array.isArray(dc.allowedBranches) ? dc.allowedBranches : undefined,
      allowedChannels: Array.isArray(dc.allowedChannels) ? dc.allowedChannels : undefined,
      stackableWithOrderDiscount: Boolean(dc.stackableWithOrderDiscount),
    } as DbDiscountConfig;
  }

  // Validate wholesalePricing if provided
  let normalizedWholesalePricing: DbWholesalePricingConfig | undefined = undefined;
  if (payload.wholesalePricing && typeof payload.wholesalePricing === 'object') {
    const wp = payload.wholesalePricing;
    const enabled = Boolean(wp.enabled);
    const wholesalePrice = Number(wp.wholesalePrice ?? 0);
    const minQuantity = Math.floor(Number(wp.minQuantity ?? wp.minWholesaleQty ?? 1));

    if (enabled) {
      if (!Number.isFinite(wholesalePrice) || wholesalePrice <= 0) {
        errors.push('Wholesale unit price must be greater than ₦0 when wholesale pricing is enabled.');
      }
      if (!Number.isFinite(minQuantity) || minQuantity < 2) {
        errors.push('Minimum wholesale quantity must be at least 2 units.');
      }
    }

    const tiers = Array.isArray(wp.tiers)
      ? wp.tiers
          .map((t: any) => ({
            minQuantity: Math.max(2, Math.floor(Number(t.minQuantity ?? t.minQty) || minQuantity)),
            unitPrice: Math.max(1, Number(t.unitPrice ?? t.price) || wholesalePrice),
            label: t.label ? String(t.label).trim() : undefined,
          }))
          .sort((a: any, b: any) => a.minQuantity - b.minQuantity)
      : undefined;

    normalizedWholesalePricing = {
      enabled,
      retailPrice: wp.retailPrice !== undefined ? Number(wp.retailPrice) : payload.basePrice,
      wholesalePrice: Math.max(0, wholesalePrice || 0),
      minQuantity: Math.max(1, minQuantity || 1),
      minWholesaleQty: Math.max(1, minQuantity || 1),
      allowSkuPooling: Boolean(wp.allowSkuPooling),
      poolingGroup: wp.poolingGroup ? String(wp.poolingGroup).trim() : 'bread',
      tiers,
      allowedBranches: Array.isArray(wp.allowedBranches) ? wp.allowedBranches : undefined,
      allowedChannels: Array.isArray(wp.allowedChannels) ? wp.allowedChannels : undefined,
      effectiveStartDate: wp.effectiveStartDate ? String(wp.effectiveStartDate).trim() : undefined,
      effectiveEndDate: wp.effectiveEndDate ? String(wp.effectiveEndDate).trim() : undefined,
      preventExtraDiscount: wp.preventExtraDiscount !== undefined ? Boolean(wp.preventExtraDiscount) : false,
    } as DbWholesalePricingConfig;
  }

  // Validate promotionRules if provided
  let normalizedPromotionRules: DbPromotionRulesConfig | undefined = undefined;
  if (payload.promotionRules && typeof payload.promotionRules === 'object') {
    const pr = payload.promotionRules;
    const freeProductId = String(pr.freeProductId || '').trim();
    const freeQuantity = Math.max(1, Math.floor(Number(pr.freeQuantity) || 1));
    const maxRewardsPerOrder = Math.max(1, Math.floor(Number(pr.maxRewardsPerOrder) || 1));

    if (productType === 'promotion' && payload.status === 'published') {
      if (!freeProductId || !menuProducts[freeProductId]) {
        errors.push(`Promotion must specify a valid existing reward product (freeProductId).`);
      }
    } else if (freeProductId && !menuProducts[freeProductId]) {
      errors.push(`Promotion reward product '${freeProductId}' does not exist in catalogue.`);
    }

    const qualifyingProductIds = Array.isArray(pr.qualifyingProductIds)
      ? pr.qualifyingProductIds.filter(Boolean)
      : pr.qualifyingProductId
      ? [String(pr.qualifyingProductId).trim()]
      : [];

    normalizedPromotionRules = {
      promoType: pr.promoType || 'buy_x_get_y',
      qualifyingProductId: qualifyingProductIds[0] || pr.qualifyingProductId || undefined,
      qualifyingProductIds,
      qualifyingCategoryIds: Array.isArray(pr.qualifyingCategoryIds) ? pr.qualifyingCategoryIds : undefined,
      qualifyingMinQty: pr.qualifyingMinQty !== undefined ? Math.max(1, Number(pr.qualifyingMinQty)) : 1,
      qualifyingMinSpend: pr.qualifyingMinSpend !== undefined ? Math.max(0, Number(pr.qualifyingMinSpend)) : 0,
      freeProductId: freeProductId || undefined,
      freeProductName: freeProductId && menuProducts[freeProductId] ? menuProducts[freeProductId].name : pr.freeProductName,
      freeQuantity,
      maxRewardsPerOrder,
      startDate: pr.startDate ? String(pr.startDate).trim() : undefined,
      endDate: pr.endDate ? String(pr.endDate).trim() : undefined,
      allowedBranches: Array.isArray(pr.allowedBranches) ? pr.allowedBranches : undefined,
      allowedChannels: Array.isArray(pr.allowedChannels) ? pr.allowedChannels : undefined,
      stackable: pr.stackable !== undefined ? Boolean(pr.stackable) : true,
    };
  }

  // Validate packaging if provided
  let normalizedPackaging: { productId: string; name: string; quantity: number } | undefined = undefined;
  if (payload.packaging && typeof payload.packaging === 'object') {
    const pkgId = String(payload.packaging.productId || '').trim();
    const pkgQty = Number(payload.packaging.quantity) || 1;
    if (pkgId) {
      const pkgProd = menuProducts[pkgId];
      normalizedPackaging = {
        productId: pkgId,
        name: pkgProd?.name || String(payload.packaging.name || pkgId),
        quantity: Math.max(1, pkgQty),
      };
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    normalizedComponents,
    normalizedPackaging,
    normalizedDiscountConfig,
    normalizedWholesalePricing,
    normalizedPromotionRules,
  };
}

function isWithinDateWindow(startDate?: string, endDate?: string, nowMs: number = Date.now()): boolean {
  if (startDate) {
    const startMs = new Date(startDate).getTime();
    if (!Number.isNaN(startMs) && nowMs < startMs) return false;
  }
  if (endDate) {
    const endMs = new Date(endDate).getTime() + 86399999; // inclusive of end date
    if (!Number.isNaN(endMs) && nowMs > endMs) return false;
  }
  return true;
}

export interface AuthoritativePricingContext {
  branchId: string;
  channel: 'pos' | 'website';
  orderDiscountPercent?: number;
  orderDiscountAmount?: number;
  allowClientUnitPriceOverride?: boolean;
}

export interface AuthoritativePricingResult {
  items: DbCheckItem[];
  grossItemsSubtotal: number;
  grossSubtotalBeforeItemDiscounts: number;
  itemLevelDiscountTotal: number;
  subtotalAfterItemDiscounts: number;
  orderDiscountAmount: number;
  orderDiscountPercent: number;
  appliedPromotions: Array<{
    promoId: string;
    promoName: string;
    freeProductId: string;
    freeProductName: string;
    freeQuantity: number;
  }>;
  validationErrors: string[];
}

/**
 * Authoritatively computes unit prices, package prices, bread wholesale tiers,
 * item/package discounts, and conditional free-item promotions.
 */
export function calculateAuthoritativeItemAndOrderPricing(
  db: DbDatabase,
  rawItems: any[],
  ctx: AuthoritativePricingContext
): AuthoritativePricingResult {
  const menuProducts = db.menuProducts || {};
  const validationErrors: string[] = [];
  const nowMs = Date.now();

  // 1. Strip out previously auto-injected promo rewards so we recompute cleanly from paid items
  const paidInputItems = (Array.isArray(rawItems) ? rawItems : []).filter(
    (it) => !it?.isPromoReward && !String(it?.id || '').startsWith('promo-reward-')
  );

  // 2. First pass: resolve catalog products and compute pooled quantities for wholesale SKU pooling
  const resolvedRows = paidInputItems.map((it, idx) => {
    const rawQtyVal = it.quantity;
    const parsedQty = Number(rawQtyVal);
    if (
      rawQtyVal === undefined ||
      rawQtyVal === null ||
      String(rawQtyVal).trim() === '' ||
      !Number.isFinite(parsedQty) ||
      parsedQty <= 0 ||
      !Number.isInteger(parsedQty) ||
      parsedQty > 10000
    ) {
      validationErrors.push(
        `Invalid quantity '${rawQtyVal}' for item '${it.name || it.productId || `Row ${idx + 1}`}': quantity must be a positive whole number between 1 and 10,000.`
      );
    }
    const qty = Number.isFinite(parsedQty) && parsedQty >= 1 ? Math.floor(parsedQty) : 1;
    const lookupId = String(it.productId || it.menuItemId || it.id || '').trim();
    const product =
      menuProducts[lookupId] ||
      Object.values(menuProducts).find(
        (mp) => mp.id === lookupId || (it.name && mp.name.toLowerCase() === String(it.name).trim().toLowerCase())
      );
    return { raw: it, idx, qty, lookupId, product };
  });

  const pooledQuantities: Record<string, number> = {};
  for (const row of resolvedRows) {
    const wp = row.product?.wholesalePricing;
    if (wp && wp.enabled && wp.allowSkuPooling) {
      const group = wp.poolingGroup || 'bread';
      pooledQuantities[group] = (pooledQuantities[group] || 0) + row.qty;
    }
  }

  // 3. Second pass: price each line item authoritatively
  const pricedItems: DbCheckItem[] = [];
  let grossItemsSubtotal = 0;
  let itemLevelDiscountTotal = 0;

  for (const row of resolvedRows) {
    const { raw, idx, qty, lookupId, product } = row;

    if (!product) {
      // Custom/ad-hoc item fallback
      const fallbackPrice = Math.max(0, Number(raw.unitPrice ?? raw.price ?? 0));
      const lineTotal = fallbackPrice * qty;
      grossItemsSubtotal += lineTotal;
      pricedItems.push({
        id: raw.id || `item-${Date.now()}-${idx}`,
        productId: lookupId || 'prod-custom',
        name: raw.name || 'Menu Item',
        quantity: qty,
        unitPrice: fallbackPrice,
        originalUnitPrice: fallbackPrice,
        itemDiscountAmount: 0,
        unitCost: typeof raw.unitCost === 'number' ? raw.unitCost : undefined,
        totalPrice: lineTotal,
        notes: raw.notes,
        status: raw.status || 'pending',
        sentToKitchenAt: raw.sentToKitchenAt,
        customization: raw.customization,
      });
      continue;
    }

    if ((product.status && product.status !== 'published') || (product as any).isActive === false) {
      validationErrors.push(
        `Item '${product.name}' (${product.id}) is currently ${product.status || 'archived'} and unavailable for sale.`
      );
    }

    // Verified add-ons delta
    let verifiedExtrasDelta = 0;
    const addOnsList = raw.selectedAddOns || raw.customization?.selectedAddOns;
    if (Array.isArray(addOnsList) && Array.isArray(product.availableAddOns)) {
      for (const addOn of addOnsList) {
        const addOnId = typeof addOn === 'string' ? addOn : addOn?.id || addOn?.addOnId;
        const matchedAddOn = product.availableAddOns.find(
          (a: any) => a.id === addOnId || a.name === addOn?.name
        );
        if (matchedAddOn) {
          verifiedExtrasDelta += Number(matchedAddOn.price || 0) * Math.max(1, Number(addOn?.quantity) || 1);
        } else if (typeof addOn?.price === 'number' && addOn.price > 0) {
          verifiedExtrasDelta += addOn.price;
        }
      }
    }

    // Authoritative branch or base retail price (for packages, this is the package selling price, e.g., ₦2,000)
    const branchOrBasePrice = Number(
      product.branchPrices?.[ctx.branchId] !== undefined
        ? product.branchPrices[ctx.branchId]
        : product.basePrice
    );
    const retailUnitPrice = Math.max(0, branchOrBasePrice + verifiedExtrasDelta);

    let effectiveUnitPrice = retailUnitPrice;
    let appliedTierLabel: string | undefined = undefined;
    let isWholesaleApplied = false;

    // A. Dedicated Wholesale SKU check (e.g. prod-bakery-special-350g-ws)
    if (product.isWholesale && product.minOrderQty && product.wholesaleUnitPrice) {
      const minQty = Number(product.minOrderQty);
      const wsUnit = Number(product.wholesaleUnitPrice);
      if (qty >= minQty) {
        // Ordered in individual loaves meeting threshold
        effectiveUnitPrice = wsUnit + verifiedExtrasDelta;
        isWholesaleApplied = true;
        appliedTierLabel = `Wholesale (${minQty}+ loaves @ ₦${wsUnit.toLocaleString()})`;
      } else if (qty === 1 && branchOrBasePrice === minQty * wsUnit) {
        // Ordered 1 crate at full crate price (e.g. 1 crate of 20 loaves = ₦8,000)
        effectiveUnitPrice = branchOrBasePrice + verifiedExtrasDelta;
        isWholesaleApplied = true;
        appliedTierLabel = `Wholesale Crate (${minQty} loaves)`;
      } else {
        validationErrors.push(
          `${product.name} requires a minimum wholesale quantity of ${minQty} loaves (ordered: ${qty}).`
        );
      }
    }

    // B. Configurable Wholesale / Tiered Pricing on Retail Bread / Bulk SKUs
    const wp = product.wholesalePricing;
    if (!isWholesaleApplied && wp && wp.enabled) {
      const branchAllowed =
        !Array.isArray(wp.allowedBranches) || wp.allowedBranches.length === 0 || wp.allowedBranches.includes(ctx.branchId);
      const channelAllowed =
        !Array.isArray(wp.allowedChannels) || wp.allowedChannels.length === 0 || wp.allowedChannels.includes(ctx.channel);
      const dateAllowed = isWithinDateWindow(wp.effectiveStartDate, wp.effectiveEndDate, nowMs);

      if (branchAllowed && channelAllowed && dateAllowed) {
        const qualifyingQty = wp.allowSkuPooling
          ? pooledQuantities[wp.poolingGroup || 'bread'] || qty
          : qty;

        let matchedTierPrice: number | null = null;
        let matchedLabel: string | undefined = undefined;

        if (Array.isArray(wp.tiers) && wp.tiers.length > 0) {
          for (const tier of wp.tiers) {
            if (qualifyingQty >= tier.minQuantity) {
              matchedTierPrice = tier.unitPrice;
              matchedLabel = tier.label || `Wholesale (${tier.minQuantity}+ units)`;
            }
          }
        }

        const minWsQty = Number(wp.minQuantity ?? (wp as any).minWholesaleQty ?? 20);
        if (matchedTierPrice === null && qualifyingQty >= minWsQty) {
          matchedTierPrice = wp.wholesalePrice;
          matchedLabel = `Wholesale (${minWsQty}+ units)`;
        }

        if (matchedTierPrice !== null && matchedTierPrice < branchOrBasePrice) {
          effectiveUnitPrice = Math.max(0, matchedTierPrice + verifiedExtrasDelta);
          isWholesaleApplied = true;
          appliedTierLabel = matchedLabel;
        }
      }
    }

    // C. Product / Package Discount Configuration (discountConfig)
    const dc = product.discountConfig;
    const dcValue = Number(dc?.value ?? (dc as any)?.discountValue ?? 0);
    const dcType = (dc?.type || (dc as any)?.discountType) === 'fixed' ? 'fixed' : 'percentage';
    const canApplyProductDiscount =
      dc &&
      dc.enabled &&
      dcValue > 0 &&
      (!isWholesaleApplied || !wp?.preventExtraDiscount) &&
      (!Array.isArray(dc.allowedBranches) || dc.allowedBranches.length === 0 || dc.allowedBranches.includes(ctx.branchId)) &&
      (!Array.isArray(dc.allowedChannels) || dc.allowedChannels.length === 0 || dc.allowedChannels.includes(ctx.channel)) &&
      isWithinDateWindow(dc.startDate, dc.endDate, nowMs);

    if (canApplyProductDiscount && dc) {
      const baseForDiscount = effectiveUnitPrice;
      const unitDisc =
        dcType === 'percentage'
          ? Math.round((baseForDiscount * Math.min(100, dcValue)) / 100)
          : Math.min(baseForDiscount, Math.round(dcValue));
      effectiveUnitPrice = Math.max(0, baseForDiscount - unitDisc);
      const discLabel =
        dcType === 'percentage' ? `Promo -${dcValue}%` : `Promo -₦${dcValue.toLocaleString()}`;
      appliedTierLabel = appliedTierLabel ? `${appliedTierLabel} + ${discLabel}` : discLabel;
    }

    const lineGross = retailUnitPrice * qty;
    const lineNet = effectiveUnitPrice * qty;
    const lineDiscount = Math.max(0, lineGross - lineNet);

    grossItemsSubtotal += lineGross;
    itemLevelDiscountTotal += lineDiscount;

    // Attach immutable package composition snapshot if this product is a package/combo/platter
    const isComposite =
      product.productType === 'package' ||
      product.productType === 'combo' ||
      product.productType === 'platter' ||
      (Array.isArray(product.components) && product.components.length > 0);

    const compositionSnapshot = isComposite
      ? Array.isArray(raw.compositionSnapshot) && raw.compositionSnapshot.length > 0
        ? raw.compositionSnapshot
        : Array.isArray(product.components) && product.components.length > 0
        ? JSON.parse(JSON.stringify(product.components))
        : CANONICAL_PACKAGE_COMPOSITIONS[product.id]?.components
        ? JSON.parse(JSON.stringify(CANONICAL_PACKAGE_COMPOSITIONS[product.id].components))
        : undefined
      : undefined;

    pricedItems.push({
      id: raw.id || `item-${Date.now()}-${idx}`,
      productId: product.id,
      name: product.name,
      quantity: qty,
      unitPrice: effectiveUnitPrice,
      originalUnitPrice: retailUnitPrice,
      itemDiscountAmount: lineDiscount,
      appliedTierLabel,
      isWholesaleApplied,
      productType: product.productType || (isComposite ? 'package' : 'standard'),
      compositionVersion: product.compositionVersion || (isComposite ? 1 : undefined),
      compositionSnapshot,
      unitCost: typeof raw.unitCost === 'number' ? raw.unitCost : undefined,
      totalPrice: lineNet,
      notes: raw.notes,
      status: raw.status || 'pending',
      sentToKitchenAt: raw.sentToKitchenAt,
      customization: raw.customization,
    });
  }

  const subtotalAfterItemDiscounts = Math.max(0, grossItemsSubtotal - itemLevelDiscountTotal);

  // 4. Evaluate Active Conditional Free-Item Promotions
  const appliedPromotions: AuthoritativePricingResult['appliedPromotions'] = [];
  const promoProducts = Object.values(menuProducts).filter(
    (p) =>
      p.status === 'published' &&
      p.promotionRules &&
      p.promotionRules.freeProductId &&
      (p.productType === 'promotion' || Boolean(p.promotionRules.freeProductId))
  );

  for (const promoProd of promoProducts) {
    const pr = promoProd.promotionRules!;
    if (!pr.freeProductId) continue;

    const branchAllowed =
      !Array.isArray(pr.allowedBranches) || pr.allowedBranches.length === 0 || pr.allowedBranches.includes(ctx.branchId);
    const channelAllowed =
      !Array.isArray(pr.allowedChannels) || pr.allowedChannels.length === 0 || pr.allowedChannels.includes(ctx.channel);
    const dateAllowed = isWithinDateWindow(pr.startDate, pr.endDate, nowMs);

    if (!branchAllowed || !channelAllowed || !dateAllowed) continue;

    const qualProdIds = new Set<string>([
      ...(Array.isArray(pr.qualifyingProductIds) ? pr.qualifyingProductIds : []),
      ...(pr.qualifyingProductId ? [pr.qualifyingProductId] : []),
    ]);
    const qualCatIds = new Set<string>(Array.isArray(pr.qualifyingCategoryIds) ? pr.qualifyingCategoryIds : []);

    let matchingQty = 0;
    let matchingSpend = 0;

    for (const item of pricedItems) {
      if (item.isPromoReward) continue;
      const itemProd = menuProducts[item.productId];
      const matchesProduct =
        qualProdIds.size === 0 && qualCatIds.size === 0
          ? true
          : qualProdIds.has(item.productId) || (itemProd && qualCatIds.has(itemProd.category));

      if (matchesProduct) {
        matchingQty += item.quantity;
        matchingSpend += item.totalPrice;
      }
    }

    const minQtyRequired = Math.max(1, Number(pr.qualifyingMinQty || 1));
    const minSpendRequired = Math.max(0, Number(pr.qualifyingMinSpend || 0));

    const meetsQty = matchingQty >= minQtyRequired;
    const meetsSpend = minSpendRequired <= 0 || matchingSpend >= minSpendRequired;

    if (meetsQty && meetsSpend && matchingQty > 0) {
      const rewardProd = menuProducts[pr.freeProductId];
      if (!rewardProd) continue;

      const multiplier =
        minSpendRequired > 0
          ? Math.floor(matchingSpend / minSpendRequired)
          : Math.floor(matchingQty / minQtyRequired);
      const maxRewards = Math.max(1, Number(pr.maxRewardsPerOrder || 1));
      const rewardApplications = Math.max(1, Math.min(maxRewards, multiplier));
      const freeQty = rewardApplications * Math.max(1, Number(pr.freeQuantity || 1));

      pricedItems.push({
        id: `promo-reward-${promoProd.id}-${rewardProd.id}`,
        productId: rewardProd.id,
        name: `${rewardProd.name} (FREE PROMO — ${promoProd.name})`,
        quantity: freeQty,
        unitPrice: 0,
        originalUnitPrice: rewardProd.basePrice,
        itemDiscountAmount: rewardProd.basePrice * freeQty,
        appliedTierLabel: `FREE PROMO: ${promoProd.name}`,
        isPromoReward: true,
        promoSourceId: promoProd.id,
        promoName: promoProd.name,
        productType: rewardProd.productType || 'standard',
        unitCost: undefined,
        totalPrice: 0,
        notes: `Conditional Free Reward from ${promoProd.name}`,
        status: 'pending',
      });

      appliedPromotions.push({
        promoId: promoProd.id,
        promoName: promoProd.name,
        freeProductId: rewardProd.id,
        freeProductName: rewardProd.name,
        freeQuantity: freeQty,
      });
    }
  }

  // 5. Order-level / Check-level discount calculation
  const pct = Math.max(0, Math.min(100, Number(ctx.orderDiscountPercent) || 0));
  let orderDiscAmt = Math.max(0, Number(ctx.orderDiscountAmount) || 0);
  if (pct > 0) {
    orderDiscAmt = Math.min(subtotalAfterItemDiscounts, Math.round((subtotalAfterItemDiscounts * pct) / 100));
  } else {
    orderDiscAmt = Math.min(subtotalAfterItemDiscounts, orderDiscAmt);
  }

  return {
    items: pricedItems,
    grossItemsSubtotal,
    grossSubtotalBeforeItemDiscounts: grossItemsSubtotal,
    itemLevelDiscountTotal,
    subtotalAfterItemDiscounts,
    orderDiscountAmount: orderDiscAmt,
    orderDiscountPercent: pct,
    appliedPromotions,
    validationErrors,
  };
}

export interface ComponentDemandRecord {
  productId: string;
  name: string;
  category: string;
  standaloneUnitsSold: number;
  promoFreeUnits: number;
  unitsIncludedInPackages: number;
  totalComponentDemand: number;
  standaloneRevenue: number;
}

export interface PackageSaleSummaryRecord {
  productId: string;
  name: string;
  category: string;
  packagesSold: number;
  grossPackageRevenue: number;
  packageDiscountAmount: number;
  netPackageRevenue: number;
  packageRevenue: number;
  compositionVersion: number;
  components: DbPackageComponent[];
  expandedComponentTotals: Array<{
    productId: string;
    name: string;
    quantityPerPackage: number;
    totalIncludedUnits: number;
  }>;
}

export interface OrderPackageExpansionSummary {
  packagesSoldCount: number;
  totalPackageRevenue: number;
  packageSales: PackageSaleSummaryRecord[];
  packagesSold: PackageSaleSummaryRecord[];
  componentDemand: ComponentDemandRecord[];
  componentDemandMap: Record<string, ComponentDemandRecord>;
}

/**
 * Shared authoritative service that expands any list of sold check/order items into:
 * - Commercial package sales & package revenue (recognized once per package)
 * - Standalone units sold
 * - Promotional free units granted
 * - Units included inside packages (e.g. 1 x 2000 Mini Pack -> 3 Puff Puff, 1 Samosa, 1 Spring Roll, 1 Beef)
 * - Total component demand = Standalone + Promo Free + Included in Packages
 */
export function expandOrderItemsWithPackages(
  db: DbDatabase,
  items: any[]
): OrderPackageExpansionSummary {
  const menuProducts = db.menuProducts || {};
  const packageSalesMap: Record<string, PackageSaleSummaryRecord> = {};
  const componentDemandMap: Record<string, ComponentDemandRecord> = {};

  const ensureDemandRecord = (productId: string, fallbackName: string, fallbackCat = 'snacks'): ComponentDemandRecord => {
    if (!componentDemandMap[productId]) {
      const catProd = menuProducts[productId];
      componentDemandMap[productId] = {
        productId,
        name: catProd?.name || fallbackName || productId,
        category: catProd?.category || fallbackCat,
        standaloneUnitsSold: 0,
        promoFreeUnits: 0,
        unitsIncludedInPackages: 0,
        totalComponentDemand: 0,
        standaloneRevenue: 0,
      };
    }
    return componentDemandMap[productId];
  };

  let packagesSoldCount = 0;
  let totalPackageRevenue = 0;

  for (const rawItem of Array.isArray(items) ? items : []) {
    if (!rawItem || rawItem.status === 'voided') continue;
    const qty = Math.max(1, Number(rawItem.quantity) || 1);
    const prodId = String(rawItem.productId || rawItem.menuItemId || rawItem.id || '').trim();
    const catProd =
      menuProducts[prodId] ||
      Object.values(menuProducts).find(
        (mp) => mp.id === prodId || (rawItem.name && mp.name.toLowerCase() === String(rawItem.name).trim().toLowerCase())
      );
    const resolvedId = catProd?.id || prodId || 'prod-custom';
    const resolvedName = catProd?.name || rawItem.name || 'Menu Item';
    const resolvedCategory = catProd?.category || 'general';

    const lineNetRevenue = Number(rawItem.totalPrice ?? (Number(rawItem.unitPrice || 0) * qty));
    const lineDiscount = Number(rawItem.itemDiscountAmount || 0);
    const lineGrossRevenue = lineNetRevenue + lineDiscount;

    // Determine if this item is a composite package/combo/platter
    const snapshotComponents: DbPackageComponent[] | undefined =
      Array.isArray(rawItem.compositionSnapshot) && rawItem.compositionSnapshot.length > 0
        ? rawItem.compositionSnapshot
        : Array.isArray(catProd?.components) && catProd!.components!.length > 0
        ? catProd!.components
        : CANONICAL_PACKAGE_COMPOSITIONS[resolvedId]?.components;

    const isPackage = Boolean(snapshotComponents && snapshotComponents.length > 0);

    if (isPackage && snapshotComponents) {
      packagesSoldCount += qty;
      totalPackageRevenue += lineNetRevenue;

      if (!packageSalesMap[resolvedId]) {
        packageSalesMap[resolvedId] = {
          productId: resolvedId,
          name: resolvedName,
          category: resolvedCategory,
          packagesSold: 0,
          grossPackageRevenue: 0,
          packageDiscountAmount: 0,
          netPackageRevenue: 0,
          packageRevenue: 0,
          compositionVersion: Number(rawItem.compositionVersion || catProd?.compositionVersion || 1),
          components: snapshotComponents,
          expandedComponentTotals: snapshotComponents.map((c) => ({
            productId: c.productId,
            name: menuProducts[c.productId]?.name || c.name,
            quantityPerPackage: Number(c.quantity) || 1,
            totalIncludedUnits: 0,
          })),
        } as any;
      }

      const pkgRec = packageSalesMap[resolvedId] as any;
      pkgRec.packagesSold += qty;
      pkgRec.grossPackageRevenue += lineGrossRevenue;
      pkgRec.packageDiscountAmount += lineDiscount;
      pkgRec.netPackageRevenue += lineNetRevenue;
      pkgRec.packageRevenue += lineNetRevenue;

      for (const comp of snapshotComponents) {
        const compQtyPerPack = Math.max(1, Number(comp.quantity) || 1);
        const includedUnits = qty * compQtyPerPack;
        const compProd = menuProducts[comp.productId];
        const dRec = ensureDemandRecord(
          comp.productId,
          compProd?.name || comp.name,
          compProd?.category || comp.category || 'snacks'
        );
        dRec.unitsIncludedInPackages += includedUnits;
        dRec.totalComponentDemand += includedUnits;

        const expEntry = pkgRec.expandedComponentTotals.find((e: any) => e.productId === comp.productId);
        if (expEntry) {
          expEntry.totalIncludedUnits += includedUnits;
        }
      }
    } else {
      // Standalone item (or wholesale bread SKU or free promo item)
      let targetDemandProductId = resolvedId;
      let targetDemandName = resolvedName;
      let effectiveUnitQty = qty;

      if (resolvedId.endsWith('-ws')) {
        const baseRetailId = resolvedId.replace(/-ws$/, '');
        const retailProd = menuProducts[baseRetailId];
        const minOrderQty = Number(catProd?.minOrderQty || 1);
        const wsUnitPrice = Number(catProd?.wholesaleUnitPrice || 0);
        if (retailProd) {
          targetDemandProductId = retailProd.id;
          targetDemandName = retailProd.name;
        }
        if (qty < minOrderQty && wsUnitPrice > 0 && Number(rawItem.unitPrice) >= minOrderQty * wsUnitPrice) {
          effectiveUnitQty = qty * minOrderQty;
        }
      }

      const dRec = ensureDemandRecord(targetDemandProductId, targetDemandName, resolvedCategory);
      if (rawItem.isPromoReward) {
        dRec.promoFreeUnits += effectiveUnitQty;
      } else {
        dRec.standaloneUnitsSold += effectiveUnitQty;
        dRec.standaloneRevenue += lineNetRevenue;
      }
      dRec.totalComponentDemand += effectiveUnitQty;
    }
  }

  const packageSalesList = Object.values(packageSalesMap);
  return {
    packagesSoldCount,
    totalPackageRevenue,
    packageSales: packageSalesList,
    packagesSold: packageSalesList,
    componentDemand: Object.values(componentDemandMap),
    componentDemandMap,
  } as any;
}

/**
 * Default Pack 400 Policy:
 * - For takeaway/pickup/delivery orders containing standalone food or protein portions that do not
 *   already include their own predefined package container, default packaging is `Pack 400` (`prod-pack-400`, ₦400).
 * - Capacity rule: 1 `Pack 400` per up to 4 standalone food/protein portions (`Math.ceil(foodProteinPortions / 4)`).
 * - Standalone snacks, drinks, bakery loaves, events, and predefined packages/combos/platters with built-in packaging
 *   do NOT trigger automatic `Pack 400` charges.
 * - Supports custom packaging override (`AWAITING_PACKAGING_APPROVAL`) and dine-in zero-packaging default.
 */
export function calculateDefaultPackagingForItems(
  db: DbDatabase,
  items: Array<{ productId?: string; menuItemId?: string; name?: string; quantity: number; category?: string }>,
  options?: {
    orderType?: string;
    selectedPackagingProductId?: string;
    selectedPackagingQuantity?: number;
    requestCustomPackagingApproval?: boolean;
    customPackagingFee?: number;
    customPackagingSkuId?: string;
  }
): {
  packagingSkuId: string;
  packagingName: string;
  packagingSkuName: string;
  packagingUnitPrice: number;
  packagingQuantity: number;
  packagingFee: number;
  qualifyingFoodProteinPortions: number;
  awaitingPackagingApproval: boolean;
} {
  const orderType = String(options?.orderType || 'delivery').toLowerCase().replace('-', '_');
  const requestedSkuId = options?.customPackagingSkuId || options?.selectedPackagingProductId;
  if (
    orderType === 'dine_in' &&
    !requestedSkuId &&
    options?.selectedPackagingQuantity === undefined &&
    options?.customPackagingFee === undefined
  ) {
    return {
      packagingSkuId: 'prod-pack-400',
      packagingName: 'Pack 400',
      packagingSkuName: 'Pack 400',
      packagingUnitPrice: 400,
      packagingQuantity: 0,
      packagingFee: 0,
      qualifyingFoodProteinPortions: 0,
      awaitingPackagingApproval: false,
    };
  }

  const menuProducts = db.menuProducts || {};
  let qualifyingFoodProteinPortions = 0;
  let explicitPackagingItemsFee = 0;
  let explicitPackagingItemsCount = 0;

  for (const rawItem of items || []) {
    const prodId = String(rawItem.productId || rawItem.menuItemId || '').trim();
    const qty = Math.max(1, Math.floor(Number(rawItem.quantity) || 1));
    const catProd =
      menuProducts[prodId] ||
      Object.values(menuProducts).find(
        (mp) => mp.id === prodId || (rawItem.name && mp.name.toLowerCase() === String(rawItem.name).trim().toLowerCase())
      );
    const resolvedId = catProd?.id || prodId;
    const category = String(catProd?.category || rawItem.category || '').toLowerCase();

    if (category === 'packaging' || resolvedId.startsWith('prod-pack-')) {
      explicitPackagingItemsCount += qty;
      explicitPackagingItemsFee += qty * Number(catProd?.basePrice || 400);
      continue;
    }

    const canonical = CANONICAL_PACKAGE_COMPOSITIONS[resolvedId];
    const hasOwnPackaging = Boolean(
      catProd?.packaging?.productId ||
        canonical?.packaging?.productId ||
        catProd?.productType === 'package' ||
        catProd?.productType === 'combo' ||
        catProd?.productType === 'platter' ||
        canonical
    );
    if (hasOwnPackaging) {
      // Predefined packages/combos/platters already include their container in their selling price
      continue;
    }

    if (
      category === 'food' ||
      category === 'protein' ||
      category === 'proteins' ||
      category === 'sides' ||
      category === 'rice-meals' ||
      category === 'soups-swallows' ||
      category === 'qsr' ||
      category === 'grills' ||
      category === 'meat'
    ) {
      qualifyingFoodProteinPortions += qty;
    }
  }

  const selectedSkuId = requestedSkuId || 'prod-pack-400';
  const selectedSkuProd = menuProducts[selectedSkuId];
  const unitPrice = Number(selectedSkuProd?.basePrice || 400);
  const packagingName = selectedSkuProd?.name || 'Pack 400';

  if (options?.requestCustomPackagingApproval) {
    const customQty =
      options?.selectedPackagingQuantity !== undefined
        ? Math.max(0, Math.floor(Number(options.selectedPackagingQuantity)))
        : qualifyingFoodProteinPortions > 0
        ? Math.ceil(qualifyingFoodProteinPortions / 4)
        : 0;
    const fee =
      options?.customPackagingFee !== undefined
        ? Math.max(0, Number(options.customPackagingFee) || 0)
        : customQty * unitPrice;
    return {
      packagingSkuId: selectedSkuId,
      packagingName,
      packagingSkuName: packagingName,
      packagingUnitPrice: unitPrice,
      packagingQuantity: customQty,
      packagingFee: fee,
      qualifyingFoodProteinPortions,
      awaitingPackagingApproval: true,
    };
  }

  if (explicitPackagingItemsCount > 0 && options?.customPackagingFee === undefined && !requestedSkuId) {
    return {
      packagingSkuId: selectedSkuId,
      packagingName,
      packagingSkuName: packagingName,
      packagingUnitPrice: unitPrice,
      packagingQuantity: 0,
      packagingFee: 0,
      qualifyingFoodProteinPortions,
      awaitingPackagingApproval: false,
    };
  }

  const defaultPackQty =
    options?.selectedPackagingQuantity !== undefined
      ? Math.max(0, Math.floor(Number(options.selectedPackagingQuantity)))
      : qualifyingFoodProteinPortions > 0
      ? Math.ceil(qualifyingFoodProteinPortions / 4)
      : requestedSkuId || (options?.customPackagingFee !== undefined && options.customPackagingFee > 0)
      ? 1
      : 0;

  const computedFee =
    options?.customPackagingFee !== undefined
      ? Math.max(0, Number(options.customPackagingFee) || 0)
      : defaultPackQty * unitPrice;

  return {
    packagingSkuId: selectedSkuId,
    packagingName,
    packagingSkuName: packagingName,
    packagingUnitPrice: unitPrice,
    packagingQuantity: computedFee === 0 ? 0 : Math.max(1, defaultPackQty),
    packagingFee: computedFee,
    qualifyingFoodProteinPortions,
    awaitingPackagingApproval: false,
  };
}

