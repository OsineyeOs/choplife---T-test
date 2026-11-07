import React from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowRight, Box, Award } from 'lucide-react';

export const SmallChopsHighlight: React.FC = () => {
  const {
    setIsSmallChopsBuilderOpen,
    products,
    selectedBranchId,
    getProductPrice,
    isProductAvailable,
    formatNaira,
    setActiveCategory,
  } = useApp();

  const activeMiniPacks = products.filter((p) => {
    if (!isProductAvailable(p.id, selectedBranchId)) return false;
    const price = getProductPrice(p, selectedBranchId);
    return (
      p.id.startsWith('prod-sc-mini-') ||
      p.name.toLowerCase().includes('mini pack') ||
      (p.category === 'small-chops' && price >= 1000 && price <= 3000)
    );
  });

  const lowestMiniPackPrice =
    activeMiniPacks.length > 0
      ? Math.min(...activeMiniPacks.map((p) => getProductPrice(p, selectedBranchId) || 1000))
      : 1000;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" id="small-chops-spotlight">
      <div className="bg-gradient-to-br from-[#4D080F] via-[#3D0007] to-[#240004] text-white rounded-3xl p-6 sm:p-10 lg:p-12 border-2 border-[#FFC700] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FFC700]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#E62E00]/20 rounded-full blur-2xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 bg-[#FFC700] text-[#4D080F] px-3.5 py-1 rounded-full text-xs font-titan tracking-wider uppercase shadow-md">
              <Award className="w-3.5 h-3.5 text-[#E62E00]" />
              BENIN CITY SIGNATURE SMALL CHOPS
            </div>

            <div className="space-y-2">
              <h2 className="font-titan text-3xl sm:text-5xl text-white tracking-tight leading-tight">
                BUILD YOUR OWN <br />
                <span className="text-[#FFC700]">SMALL CHOPS BOX</span>
              </h2>
              <p className="text-white/80 font-montserrat text-sm sm:text-base leading-relaxed max-w-xl">
                Crispy hand-rolled spring rolls, spiced minced meat samosas, pillowy sweet puff-puff, glazed peppered chicken, and spicy gizzard skewers. Hand-pick your exact mix in real-time.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
                <span className="text-xl">🥟</span>
                <p className="font-titan text-xs text-[#FFC700] mt-1">Spring Rolls & Samosa</p>
                <p className="text-[11px] text-white/70 font-montserrat">Crispy golden shells</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
                <span className="text-xl">🟡</span>
                <p className="font-titan text-xs text-[#FFC700] mt-1">Fluffy Puff-Puff</p>
                <p className="text-[11px] text-white/70 font-montserrat">Golden warm dough</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
                <span className="text-xl">🍗</span>
                <p className="font-titan text-xs text-[#FFC700] mt-1">Peppered Chicken & Gizzard</p>
                <p className="text-[11px] text-white/70 font-montserrat">Spicy pepper relish</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSmallChopsBuilderOpen(true)}
                className="w-full sm:w-auto bg-[#FFC700] hover:bg-[#FFD733] text-[#4D080F] font-titan text-sm sm:text-base px-8 py-4 rounded-2xl shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-2 group"
                id="open-box-builder-btn"
              >
                <Box className="w-5 h-5 text-[#4D080F]" />
                <span>BUILD YOUR BOX</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveCategory('small-chops');
                  setIsSmallChopsBuilderOpen(true);
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('choplife:open-mini-packs'));
                  }, 10);
                }}
                className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white font-montserrat font-bold text-xs sm:text-sm px-6 py-4 rounded-2xl border border-white/20 transition-all"
                id="quick-add-custom-box-btn"
              >
                Mini Packs (From {formatNaira(lowestMiniPackPrice)})
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="relative rounded-3xl overflow-hidden border-4 border-[#FFC700]/50 shadow-2xl bg-black">
              <img
                src="https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=80"
                alt="Choplife Republic Small Chops Box"
                className="w-full h-80 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#4D080F] via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 bg-[#FAF7F2] text-[#4D080F] p-3 rounded-2xl shadow-lg border border-[#E5DEC9] flex items-center justify-between">
                <div>
                  <p className="font-titan text-xs text-[#E62E00]">PARTY READY PACKS</p>
                  <p className="font-montserrat text-xs font-bold text-[#241311]">Mini Packs, Munch Boxes & Platters</p>
                </div>
                <span className="font-titan text-sm text-[#E62E00] bg-[#FFF8E7] px-3 py-1 rounded-xl">
                  HOT & CRISP
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
