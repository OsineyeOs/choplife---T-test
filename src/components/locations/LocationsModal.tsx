import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { BranchId } from '../../types';
import {
  X,
  MapPin,
  Clock,
  Phone,
  MessageCircle,
  ExternalLink,
  CheckCircle2,
  Search,
  Truck,
  Check,
  ChevronDown,
} from 'lucide-react';

export const LocationsModal: React.FC = () => {
  const {
    isLocationsModalOpen,
    setIsLocationsModalOpen,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    formatNaira,
    getBranchWhatsAppUrl,
  } = useApp();

  const [activeTabBranchId, setActiveTabBranchId] = useState<BranchId>(selectedBranchId);
  const [deliverySearchQuery, setDeliverySearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<{ name: string; fee: number } | null>(null);

  const currentActiveBranch = branches.find((b) => b.id === activeTabBranchId) || branches[0];

  // Filter delivery zones based on search query
  const matchingZones = useMemo(() => {
    if (!deliverySearchQuery.trim()) return [];
    const query = deliverySearchQuery.toLowerCase();
    return currentActiveBranch.deliveryZones.filter((z) =>
      z.name.toLowerCase().includes(query)
    );
  }, [currentActiveBranch, deliverySearchQuery]);

  if (!isLocationsModalOpen) return null;

  const handleSelectBranch = (branchId: BranchId) => {
    setSelectedBranchId(branchId);
    setIsLocationsModalOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      id="locations-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsLocationsModalOpen(false);
        }
      }}
    >
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl border border-[#E5DEC9] flex flex-col justify-between">
        
        {/* Header */}
        <div className="bg-[#4D080F] text-white p-5 sm:p-6 rounded-t-3xl flex items-center justify-between sticky top-0 z-20 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFC700] text-[#4D080F] flex items-center justify-center font-titan text-xl shrink-0">
              📍
            </div>
            <div>
              <span className="text-[10px] font-titan uppercase tracking-widest text-[#FFC700] block">
                BENIN CITY RESTAURANTS & DELIVERY
              </span>
              <h2 className="font-titan text-lg sm:text-xl text-white">
                SELECT BRANCH & DELIVERY LOCATION
              </h2>
            </div>
          </div>

          <button
            onClick={() => setIsLocationsModalOpen(false)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            id="close-locations-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 flex-1">
          
          {/* Branch Selector Tabs */}
          <div>
            <label className="font-titan text-xs text-[#4D080F] uppercase tracking-wider block mb-2">
              1. CHOOSE YOUR NEAREST KITCHEN / BRANCH
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {branches.map((branch) => {
                const isSelected = activeTabBranchId === branch.id;
                const isCurrentActiveOrderBranch = selectedBranchId === branch.id;
                return (
                  <button
                    key={branch.id}
                    onClick={() => {
                      setActiveTabBranchId(branch.id);
                      setSelectedZone(null);
                    }}
                    className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#E62E00] bg-[#FFF8E7] shadow-sm ring-1 ring-[#E62E00]/20'
                        : 'border-[#E5DEC9] bg-[#FAF7F2] hover:bg-white'
                    }`}
                    id={`branch-tab-${branch.id}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-titan text-xs sm:text-sm text-[#4D080F]">
                        {branch.name}
                      </span>
                      {isCurrentActiveOrderBranch && (
                        <span className="bg-[#4D080F] text-[#FFC700] text-[8px] font-titan uppercase px-1.5 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#7A6A65] font-montserrat mt-1 line-clamp-1">
                      {branch.tagline}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Branch Operational Card */}
          <div className="bg-[#FAF7F2] p-4 sm:p-5 rounded-2xl border border-[#E5DEC9] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5DEC9] pb-3">
              <div>
                <h3 className="font-titan text-base text-[#4D080F] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#E62E00]" />
                  {currentActiveBranch.name}
                </h3>
                <p className="text-xs text-[#5C4D49] font-montserrat mt-0.5">
                  {currentActiveBranch.address} ({currentActiveBranch.landmark})
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`tel:${currentActiveBranch.phone}`}
                  className="px-3 py-1.5 rounded-xl bg-white border border-[#E5DEC9] text-xs font-montserrat font-bold text-[#4D080F] hover:bg-gray-50 flex items-center gap-1"
                >
                  <Phone className="w-3 h-3 text-[#E62E00]" />
                  <span>Call</span>
                </a>
                <a
                  href={getBranchWhatsAppUrl(currentActiveBranch.id, `Hello Choplife ${currentActiveBranch.shortName}, I want to make an inquiry.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-xs font-montserrat font-bold text-emerald-800 hover:bg-emerald-50 flex items-center gap-1"
                >
                  <MessageCircle className="w-3 h-3 text-emerald-600 fill-emerald-600" />
                  <span>WhatsApp</span>
                </a>
                <a
                  href={currentActiveBranch.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-white border border-[#E5DEC9] text-xs font-montserrat font-bold text-[#5C4D49] hover:bg-gray-50 flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Maps</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-montserrat">
              <div className="bg-white p-2.5 rounded-xl border border-[#E5DEC9] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#4D080F] shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#7A6A65] block">Restaurant Hours</span>
                  <span className="font-semibold text-[#241311]">{currentActiveBranch.dineInHours}</span>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-[#E5DEC9] flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#E62E00] shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#7A6A65] block">Estimated Delivery</span>
                  <span className="font-bold text-[#E62E00]">30–90 minutes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Searchable Delivery Location Dropdown (No Chip Wall!) */}
          <div className="space-y-2">
            <label className="font-titan text-xs text-[#4D080F] uppercase tracking-wider block">
              2. SEARCH YOUR DELIVERY AREA / ZONE
            </label>
            <p className="text-xs text-[#7A6A65] font-montserrat">
              Search your street, neighborhood, or landmark in Benin City to check exact delivery rates.
            </p>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search area (e.g. Airport Road, GRA, Ugbowo, Limit, Etete, Sapele Rd)..."
                value={deliverySearchQuery}
                onChange={(e) => {
                  setDeliverySearchQuery(e.target.value);
                  setSelectedZone(null);
                }}
                className="w-full bg-[#FAF7F2] border-2 border-[#E5DEC9] focus:border-[#E62E00] rounded-2xl pl-10 pr-4 py-3 text-xs font-montserrat text-[#241311] placeholder:text-[#9E8E89] focus:outline-none"
                id="location-search-input"
              />
              <Search className="w-4 h-4 text-[#7A6A65] absolute left-3.5 top-3.5" />
              {deliverySearchQuery && (
                <button
                  onClick={() => setDeliverySearchQuery('')}
                  className="text-xs text-[#7A6A65] hover:text-[#241311] absolute right-3.5 top-3.5 font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Dropdown / Search Results */}
            {deliverySearchQuery.trim() && (
              <div className="bg-white border-2 border-[#E5DEC9] rounded-2xl shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-100 animate-in fade-in duration-150">
                {matchingZones.length > 0 ? (
                  matchingZones.map((zone, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedZone(zone);
                        setDeliverySearchQuery(zone.name);
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs font-montserrat hover:bg-[#FFF8E7] flex items-center justify-between transition-colors"
                    >
                      <span className="font-semibold text-[#241311]">{zone.name}</span>
                      <span className="font-titan text-[#E62E00]">{formatNaira(zone.fee)}</span>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-[#7A6A65] font-montserrat">
                    No exact delivery zone matched &ldquo;{deliverySearchQuery}&rdquo;. Check spelling or choose a nearby landmark.
                  </div>
                )}
              </div>
            )}

            {/* Compact Selected Location Confirmation Card */}
            {selectedZone && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3.5 flex items-center justify-between animate-in zoom-in-95 duration-150">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-montserrat font-bold text-emerald-900">
                      Delivery to: {selectedZone.name}
                    </p>
                    <p className="text-[11px] text-emerald-700 font-montserrat">
                      Estimated dispatch time: <strong>30–90 minutes</strong>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Delivery Fee</span>
                  <span className="font-titan text-sm text-emerald-900">
                    {formatNaira(selectedZone.fee)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action CTA */}
          <div className="pt-2">
            <button
              onClick={() => handleSelectBranch(activeTabBranchId)}
              className="w-full bg-[#E62E00] hover:bg-[#C92200] text-white font-titan text-sm py-3.5 rounded-2xl shadow-md transition-transform active:scale-98 flex items-center justify-center gap-2"
              id="confirm-branch-selection-btn"
            >
              <Check className="w-4 h-4 text-[#FFC700]" />
              <span>START ORDERING FROM {currentActiveBranch.name.toUpperCase()}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
