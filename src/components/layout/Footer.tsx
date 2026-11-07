import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  MapPin,
  Phone,
  Clock,
  MessageCircle,
  Heart,
  ExternalLink,
  Award,
  Lock,
  Monitor,
  Bike,
  Instagram,
  Facebook,
  Music2,
} from 'lucide-react';
import { BrandLogo } from '../ui/BrandLogo';

export interface FooterProps {
  onNavigateRoute?: (route: 'storefront' | 'pos' | 'admin') => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateRoute }) => {
  const {
    branches,
    selectedBranchId,
    setSelectedBranchId,
    getBranchWhatsAppUrl,
    setIsCateringModalOpen,
    setIsLocationsModalOpen,
    setIsReviewModalOpen,
    setIsStaffPosOpen,
    setIsRiderPortalOpen,
    setIsAdminModalOpen,
    setIsStaffLoginModalOpen,
    navigateToOperations,
    currentStaff,
    setActiveCategory,
    cmsContent,
  } = useApp();

  const footerCms = cmsContent?.footer;
  const contactCms = cmsContent?.contact;

  const brandTagline =
    footerCms?.brandTagline ||
    "Benin City's Home of Maximum Enjoyment! Freshly fried Small Chops, 100% Bromate-Free Special Bread, Smoky Party Jollof, and Loaded Shawarma across our 3 verified Benin City branches.";

  const copyrightText =
    footerCms?.copyrightText ||
    `© ${new Date().getFullYear()} Choplife Republic Ltd (Benin City, Edo State, Nigeria). All Rights Reserved.`;

  const instagramUrl =
    (contactCms as any)?.instagramUrl || 'https://www.instagram.com/choplife_republic/';
  const tiktokUrl =
    (contactCms as any)?.tiktokUrl || 'https://www.tiktok.com/@choplife.republic';
  const facebookUrl =
    (contactCms as any)?.facebookUrl || 'https://www.facebook.com/people/Choplife-Republic/100067941283627/';

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    const el = document.getElementById('menu-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#241311] text-white border-t-4 border-[#E62E00] pb-28 lg:pb-4" id="site-footer">
      {/* Main Footer Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 pb-8 border-b border-white/10">
          {/* Column 1: Brand Identity + Official Social Media */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF8E7] flex items-center justify-center shadow-lg border-2 border-[#FFC700] overflow-hidden p-0.5 shrink-0">
                <BrandLogo className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="font-titan text-2xl tracking-tight text-white leading-none">
                  CHOPLIFE
                </span>
                <span className="font-titan text-xs tracking-widest text-[#FFC700] uppercase">
                  REPUBLIC • BENIN CITY
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-white/75 font-montserrat leading-relaxed max-w-xl">
              {brandTagline}
            </p>

            <div className="pt-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 bg-[#4D080F] text-[#FFC700] px-3 py-1.5 rounded-xl text-xs font-titan border border-[#FFC700]/30">
                <Award className="w-3.5 h-3.5 text-[#E62E00]" />
                100% Bromate-Free Bakery
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/10 text-white/90 px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold">
                3 Active Benin Branches
              </span>
            </div>

            {/* Official Social Media Links (Part O1) */}
            <div className="pt-2">
              <p className="text-[11px] font-titan uppercase tracking-wider text-[#FFC700] mb-2">
                Follow Choplife Republic
              </p>
              <div className="flex flex-wrap items-center gap-2.5" id="footer-social-links">
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow Choplife Republic on Instagram"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-[#E62E00] text-white text-xs font-montserrat font-bold border border-white/15 transition-colors"
                >
                  <Instagram className="w-4 h-4 text-[#FFC700]" />
                  <span>Instagram</span>
                </a>
                <a
                  href={tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow Choplife Republic on TikTok"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-[#E62E00] text-white text-xs font-montserrat font-bold border border-white/15 transition-colors"
                >
                  <Music2 className="w-4 h-4 text-[#FFC700]" />
                  <span>TikTok</span>
                </a>
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow Choplife Republic on Facebook"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-[#E62E00] text-white text-xs font-montserrat font-bold border border-white/15 transition-colors"
                >
                  <Facebook className="w-4 h-4 text-[#FFC700]" />
                  <span>Facebook</span>
                </a>
              </div>
            </div>
          </div>

          {/* Column 2: Quick Menu Categories */}
          <div className="lg:col-span-5 space-y-3">
            <h4 className="font-titan text-base text-[#FFC700] uppercase tracking-wider">
              Explore Menu &amp; Services
            </h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 text-xs sm:text-sm font-montserrat text-white/80">
              <li>
                <button
                  type="button"
                  onClick={() => scrollToCategory('small-chops')}
                  className="hover:text-[#FFC700] transition-colors text-left"
                >
                  🥟 Small Chops &amp; Party Platters
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToCategory('bakery')}
                  className="hover:text-[#FFC700] transition-colors text-left"
                >
                  🍞 Choplife Special Bread (350g - 1.2kg)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToCategory('food')}
                  className="hover:text-[#FFC700] transition-colors text-left"
                >
                  🍛 Jollof, Fried &amp; Asun Rice Combos
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToCategory('snacks')}
                  className="hover:text-[#FFC700] transition-colors text-left"
                >
                  🌯 Loaded Shawarma &amp; Meat Pies
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToCategory('protein')}
                  className="hover:text-[#FFC700] transition-colors text-left"
                >
                  🍗 Grilled Turkey, Peppered Chicken &amp; Catfish
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setIsCateringModalOpen(true)}
                  className="text-[#FFC700] font-bold hover:underline pt-1 inline-block text-left"
                >
                  🎉 Book Event Catering &amp; Wholesale →
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Full-Width 3 Benin City Branches Row */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="font-titan text-base text-[#FFC700] uppercase tracking-wider">
                Our 3 Benin City Branches
              </h4>
              <p className="text-xs text-white/65 font-montserrat">
                Tap any branch card below to switch your active ordering kitchen or contact the branch directly.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsLocationsModalOpen(true)}
              className="text-xs font-montserrat font-bold text-[#FFC700] hover:underline inline-flex items-center gap-1 self-start sm:self-auto"
            >
              View Map &amp; Delivery Zones <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {branches.map((branch) => {
              const isSelected = branch.id === selectedBranchId;
              return (
                <div
                  key={branch.id}
                  onClick={() => setSelectedBranchId(branch.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-[#4D080F] border-[#FFC700] shadow-md'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                  id={`footer-branch-${branch.id}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-titan text-sm text-[#FFC700]">
                        {branch.shortName}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] bg-[#E62E00] text-white px-2 py-0.5 rounded-full font-bold uppercase shrink-0">
                          Active Branch
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/85 font-montserrat leading-snug mb-2 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 text-[#E62E00] shrink-0" />
                      <span>{branch.address}</span>
                    </p>
                    <p className="text-[11px] text-white/65 font-montserrat flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#FFC700] shrink-0" />
                      <span>{(branch as any).hoursSummary || branch.openingHours}</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
                    <a
                      href={`tel:${((branch as any).phonePrimary || branch.phone || '').replace(/\s+/g, '')}`}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#FFC700] shrink-0" />
                      <span>Call Branch</span>
                    </a>
                    <a
                      href={getBranchWhatsAppUrl(
                        branch.id,
                        `Hello Choplife Republic (${branch.shortName}), I would like to place an order!`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="bg-[#25D366]/20 hover:bg-[#25D366]/35 text-[#43E29F] border border-[#25D366]/40 text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Legal & Admin Bar */}
      <div className="bg-black/40 border-t border-white/10 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/60 font-montserrat">
          <div className="flex items-center gap-1">
            <span>{copyrightText}</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setIsReviewModalOpen(true)}
              className="hover:text-[#FFC700] transition-colors"
            >
              Rate a Completed Order
            </button>
            <span>•</span>
            {currentStaff ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateRoute) onNavigateRoute('pos');
                    else navigateToOperations('pos');
                  }}
                  className="hover:text-[#FFC700] transition-colors flex items-center gap-1 text-[#FFC700] font-semibold"
                >
                  <Monitor className="w-3 h-3 text-[#E62E00]" />
                  POS & Kitchen KDS
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateRoute) onNavigateRoute('pos');
                    else navigateToOperations('dispatch');
                  }}
                  className="hover:text-[#FFC700] transition-colors flex items-center gap-1"
                >
                  <Bike className="w-3 h-3 text-emerald-400" />
                  Rider Dispatch App
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateRoute) onNavigateRoute('admin');
                    else navigateToOperations('pos');
                  }}
                  className="hover:text-[#FFC700] transition-colors flex items-center gap-1"
                >
                  <Lock className="w-3 h-3 text-emerald-400" />
                  Operations & Stock
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsStaffLoginModalOpen(true)}
                className="hover:text-[#FFC700] transition-colors flex items-center gap-1 text-white/60 hover:text-white"
                id="footer-staff-login-btn"
              >
                <Lock className="w-3 h-3 text-[#FFC700]" />
                Staff Portal Login
              </button>
            )}
            <span>•</span>
            <span className="flex items-center gap-1 text-white/80">
              Made with <Heart className="w-3 h-3 text-[#E62E00] fill-[#E62E00]" /> for Benin City
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
