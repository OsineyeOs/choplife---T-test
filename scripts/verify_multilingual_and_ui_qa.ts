import { SUPPORTED_LANGUAGES } from '../src/context/LanguageContext';
import { BRANCHES } from '../src/data/branches';
import { APPROVED_BAKERY_PRODUCTS } from '../src/data/approvedBakery';
import fs from 'fs';
import path from 'path';

function runVerification() {
  console.log('================================================================================');
  console.log('CHOPLIFE REPUBLIC — RESPONSIVE MULTILINGUAL & FORENSIC UI VERIFICATION HARNESS');
  console.log('================================================================================');

  let passedChecks = 0;
  let totalChecks = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalChecks++;
    if (condition) {
      passedChecks++;
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}${detail ? `: ${detail}` : ''}`);
    }
  }

  // 1. Multilingual Language Coverage & Dictionary Integrity
  console.log('\n1. MULTILINGUAL LANGUAGE COVERAGE & TRANSLATION CATALOG');
  assert(SUPPORTED_LANGUAGES.length === 5, 'Exactly 5 supported languages defined');
  const expectedCodes = ['en', 'pcm', 'bin', 'fr', 'yo'];
  const actualCodes = SUPPORTED_LANGUAGES.map((l) => l.code);
  assert(
    expectedCodes.every((c) => actualCodes.includes(c as any)),
    'Supported languages include en, pcm, bin, fr, yo'
  );

  const langContextPath = path.resolve('src/context/LanguageContext.tsx');
  const langContextSrc = fs.readFileSync(langContextPath, 'utf8');

  // Verify key categories present across languages
  const sampleKeys = [
    'announcement.slogan',
    'nav.ordering_from',
    'nav.delivery',
    'nav.pickup',
    'hero.tagline',
    'hero.order_small_chops',
    'cat.all',
    'cat.small_chops',
    'card.add_to_cart',
    'card.in_cart',
    'bakery.title',
    'bakery.zero_bromate',
    'cart.title',
    'cart.total',
    'paddy.title',
    'paddy.greeting',
    'review.title',
    'footer.about',
  ];

  sampleKeys.forEach((k) => {
    assert(langContextSrc.includes(`'${k}'`), `Key '${k}' exists in translation definitions`);
  });

  assert(
    langContextSrc.includes('document.documentElement.lang = language'),
    'LanguageProvider reactively updates document.documentElement.lang'
  );

  // 2. Responsive Language Switcher & Accessibility
  console.log('\n2. RESPONSIVE LANGUAGE SWITCHER ACCESSIBILITY');
  const switcherPath = path.resolve('src/components/common/LanguageSwitcher.tsx');
  const switcherSrc = fs.readFileSync(switcherPath, 'utf8');
  assert(
    switcherSrc.includes("event.key === 'Escape'"),
    'LanguageSwitcher listens for Escape key to close'
  );
  assert(
    switcherSrc.includes('max-w-[calc(100vw-1.5rem)]'),
    'LanguageSwitcher clamps menu width within mobile viewports'
  );
  assert(
    switcherSrc.includes('handleClickOutside'),
    'LanguageSwitcher handles click outside to dismiss'
  );

  // 3. Navigation & Section IDs
  console.log('\n3. NAVIGATION & CATEGORY SCROLL TARGETS');
  const menuExplorerPath = path.resolve('src/components/menu/MenuExplorer.tsx');
  const menuExplorerSrc = fs.readFileSync(menuExplorerPath, 'utf8');
  assert(
    menuExplorerSrc.includes('id="menu-section"'),
    'MenuExplorer defines authoritative id="menu-section"'
  );
  assert(
    menuExplorerSrc.includes('scroll-mt-24') || menuExplorerSrc.includes('scroll-mt-28'),
    'MenuExplorer includes sticky header scroll margin offset'
  );

  const navbarPath = path.resolve('src/components/layout/Navbar.tsx');
  const navbarSrc = fs.readFileSync(navbarPath, 'utf8');
  assert(
    navbarSrc.includes("if (onNavigateRoute) onNavigateRoute('storefront')"),
    'Navbar brand logo navigates to storefront on click'
  );
  assert(
    navbarSrc.includes("window.scrollTo({ top: 0, behavior: 'smooth' })"),
    'Navbar brand logo scrolls smoothly to top'
  );

  // 4. Chop Paddy Chat Panel Viewport & Ergonomics
  console.log('\n4. CHOP PADDY VIEWPORT-AWARE RESILIENCE');
  const paddyPath = path.resolve('src/components/ai/AiChatbotModal.tsx');
  const paddySrc = fs.readFileSync(paddyPath, 'utf8');
  assert(
    paddySrc.includes('h-[100dvh]') && paddySrc.includes('max-h-[100dvh]'),
    'Chop Paddy uses viewport-aware 100dvh height'
  );
  assert(
    paddySrc.includes('safe-area-inset-bottom'),
    'Chop Paddy respects safe area insets on mobile'
  );
  assert(
    paddySrc.includes("e.key === 'Escape'"),
    'Chop Paddy closes on Escape key'
  );
  assert(
    paddySrc.includes('overscroll-contain'),
    'Chop Paddy transcript uses overscroll-contain for independent scrolling'
  );

  // 5. Quantity Discipline (MenuExplorer & BakerySection)
  console.log('\n5. PRODUCT QUANTITY ZERO-DEFAULT DISCIPLINE');
  assert(
    menuExplorerSrc.includes('cartQty > 0'),
    'MenuExplorer stepper only renders when cartQty > 0'
  );
  assert(
    menuExplorerSrc.includes('In Cart'),
    'MenuExplorer renders In Cart badge/button when item is selected'
  );

  const bakeryPath = path.resolve('src/components/home/BakerySection.tsx');
  const bakerySrc = fs.readFileSync(bakeryPath, 'utf8');
  assert(
    bakerySrc.includes('qty === 0'),
    'BakerySection checks for qty === 0 initial state'
  );
  assert(
    bakerySrc.includes('In Cart'),
    'BakerySection displays In Cart count when selected'
  );
  assert(
    APPROVED_BAKERY_PRODUCTS.length >= 8,
    `Approved bakery items loaded: ${APPROVED_BAKERY_PRODUCTS.length}`
  );

  // 6. Return to Top Collision Prevention
  console.log('\n6. RETURN TO TOP BUTTON PLACEMENT');
  const rttPath = path.resolve('src/components/layout/ReturnToTopButton.tsx');
  const rttSrc = fs.readFileSync(rttPath, 'utf8');
  assert(
    rttSrc.includes('left-4') && rttSrc.includes('sm:left-6'),
    'ReturnToTopButton positioned on bottom-left away from Chop Paddy & drawer'
  );

  // 7. Authoritative Branch Operating Hours
  console.log('\n7. AUTHORITATIVE BRANCH OPERATING HOURS');
  const gra = BRANCHES.find((b) => b.id === 'gra');
  const okabere = BRANCHES.find((b) => b.id === 'okabere');
  const ugbowo = BRANCHES.find((b) => b.id === 'ugbowo');

  assert(Boolean(gra && gra.openingHours.includes('08:00 – 23:00')), 'GRA operating hours: 08:00 – 23:00');
  assert(Boolean(okabere && okabere.openingHours.includes('08:00 – 22:00')), 'Okabere operating hours: 08:00 – 22:00');
  assert(Boolean(ugbowo && ugbowo.openingHours.includes('08:00 – 22:00')), 'Ugbowo operating hours: 08:00 – 22:00');

  // 8. Official Social Media Handles in Footer
  console.log('\n8. OFFICIAL FOOTER SOCIAL MEDIA LINKS');
  const footerPath = path.resolve('src/components/layout/Footer.tsx');
  const footerSrc = fs.readFileSync(footerPath, 'utf8');
  assert(
    footerSrc.includes('https://www.instagram.com/choplife_republic/'),
    'Footer Instagram: @choplife_republic'
  );
  assert(
    footerSrc.includes('https://www.tiktok.com/@choplife.republic'),
    'Footer TikTok: choplife.republic'
  );
  assert(
    footerSrc.includes('https://www.facebook.com/people/Choplife-Republic/100067941283627/'),
    'Footer Facebook: Choplife-Republic/100067941283627/'
  );

  console.log('\n================================================================================');
  console.log(`SUMMARY: ${passedChecks}/${totalChecks} CHECKS PASSED (${((passedChecks / totalChecks) * 100).toFixed(1)}%)`);
  console.log('================================================================================');

  if (passedChecks !== totalChecks) {
    process.exit(1);
  }
}

runVerification();
