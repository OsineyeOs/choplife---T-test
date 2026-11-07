import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BranchId } from '../../types';
import {
  MapPin,
  Clock,
  Truck,
  CheckCircle2,
  Navigation,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  Store,
  Sparkles,
} from 'lucide-react';

export const QuickBranchPicker: React.FC = () => {
  const {
    branches,
    selectedBranchId,
    setSelectedBranchId,
    orderType,
    setOrderType,
    getBranchWhatsAppUrl,
  } = useApp();

  const [detectedNearBranch, setDetectedNearBranch] = useState<BranchId | null>(null);
  const [detectionDistanceKm, setDetectionDistanceKm] = useState<number | null>(null);
  const [detectionMessage, setDetectionMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  // Haversine formula to calculate distance between user coordinates and branch coordinates
  const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleAutoDetectNearestBranch = () => {
    if (!('geolocation' in navigator)) {
      setDetectionMessage({
        text: 'Geolocation is not supported by your browser. Please select your branch manually.',
        type: 'error',
      });
      return;
    }

    setIsDetecting(true);
    setDetectionMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;

        let nearestBranchId: BranchId | null = null;
        let minDistanceKm = Infinity;

        branches.forEach((branch) => {
          if (branch.latitude !== undefined && branch.longitude !== undefined) {
            const dist = calculateHaversineDistance(userLat, userLon, branch.latitude, branch.longitude);
            if (dist < minDistanceKm) {
              minDistanceKm = dist;
              nearestBranchId = branch.id;
            }
          }
        });

        setIsDetecting(false);

        if (nearestBranchId) {
          setDetectedNearBranch(nearestBranchId);
          setDetectionDistanceKm(parseFloat(minDistanceKm.toFixed(1)));
          setSelectedBranchId(nearestBranchId);

          const matchedBranch = branches.find((b) => b.id === nearestBranchId);
          setDetectionMessage({
            text: `Detected location! Nearest branch: ${matchedBranch?.shortName || nearestBranchId} (~${minDistanceKm.toFixed(1)} km away).`,
            type: 'success',
          });
        } else {
          setDetectionMessage({
            text: 'Branch coordinate configuration missing. Please select a branch manually below.',
            type: 'error',
          });
        }
      },
      (error) => {
        setIsDetecting(false);
        let errorMsg = 'Could not determine location. Please manually select a branch below.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location permission was denied. Please select your branch manually from the choices below.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Location request timed out. Please select your branch manually below.';
        }
        setDetectionMessage({
          text: errorMsg,
          type: 'error',
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 sm:-mt-12 relative z-20" id="branch-picker-section">
      <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-xl border border-[#E5DEC9]">
        
        {/* Header Strip */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-[#F0EAE1]">
          <div>
            <span className="text-xs font-titan uppercase tracking-widest text-[#E62E00] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#FFC700]" />
              LOCATION-SPECIFIC KITCHENS & HUBS
            </span>
            <h2 className="font-titan text-2xl sm:text-3xl text-[#4D080F] tracking-tight">
              WHERE ARE YOU ORDERING FROM?
            </h2>
            <p className="text-xs sm:text-sm text-[#7A6A65] font-montserrat">
              Select your nearest Choplife branch for the freshest menu, accurate delivery fees, and fastest hot dispatch.
            </p>
          </div>

          {/* Location Auto-detect Helper Button */}
          <button
            onClick={handleAutoDetectNearestBranch}
            disabled={isDetecting}
            className="flex items-center gap-2 bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#4D080F] border border-[#E5DEC9] px-4 py-2.5 rounded-2xl text-xs font-montserrat font-bold transition-all shrink-0 active:scale-95 cursor-pointer disabled:opacity-60"
            id="detect-location-btn"
          >
            <Navigation className={`w-4 h-4 text-[#E62E00] ${isDetecting ? 'animate-spin' : ''}`} />
            <span>{isDetecting ? 'Locating in Benin City...' : 'Auto-Detect Nearest Branch'}</span>
          </button>
        </div>

        {/* Geolocation Feedback Message Banner */}
        {detectionMessage && (
          <div
            className={`mt-4 p-3 rounded-2xl text-xs font-montserrat font-semibold flex items-center justify-between ${
              detectionMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
            id="geo-detection-feedback"
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 shrink-0 text-[#E62E00]" />
              <span>{detectionMessage.text}</span>
            </div>
            <button
              onClick={() => setDetectionMessage(null)}
              className="text-xs font-bold hover:underline opacity-75 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 3 Branches Interactive Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
          {branches.map((branch) => {
            const isSelected = selectedBranchId === branch.id;
            return (
              <div
                key={branch.id}
                onClick={() => setSelectedBranchId(branch.id)}
                className={`relative rounded-2xl p-5 border-2 transition-all cursor-pointer flex flex-col justify-between group ${
                  isSelected
                    ? 'border-[#E62E00] bg-[#FFF8E7] shadow-md ring-2 ring-[#E62E00]/20'
                    : 'border-[#E5DEC9] bg-[#FAF7F2] hover:border-[#D62828]/50 hover:bg-white'
                }`}
                id={`branch-card-picker-${branch.id}`}
              >
                {/* Active Selection Badge */}
                {isSelected && (
                  <div className="absolute -top-3 right-4 bg-[#E62E00] text-white px-3 py-0.5 rounded-full font-titan text-[10px] tracking-wider uppercase flex items-center gap-1 shadow-xs">
                    <CheckCircle2 className="w-3 h-3 text-[#FFC700]" />
                    ACTIVE ORDERING BRANCH
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-titan text-sm ${
                        isSelected ? 'bg-[#E62E00] text-white' : 'bg-white text-[#4D080F] border border-[#E5DEC9]'
                      }`}>
                        📍
                      </div>
                      <div>
                        <h3 className="font-titan text-base text-[#4D080F] group-hover:text-[#E62E00] transition-colors">
                          {branch.name}
                        </h3>
                        <p className="text-[10px] font-montserrat font-bold text-[#E62E00]">
                          {branch.tagline}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[#5C4D49] font-montserrat line-clamp-2">
                    {branch.address}
                  </p>

                  {/* Coverage details */}
                  <div className="bg-white/80 p-2.5 rounded-xl border border-[#E5DEC9] space-y-1 text-[11px] font-montserrat">
                    <div className="flex items-center justify-between">
                      <span className="text-[#7A6A65]">Delivery ETA:</span>
                      <span className="font-bold text-emerald-700">{branch.estimatedDeliveryTime}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#7A6A65]">Hours:</span>
                      <span className="font-semibold text-[#241311]">{branch.openingHours}</span>
                    </div>
                  </div>
                </div>

                {/* Card Action footer */}
                <div className="pt-4 mt-2 border-t border-[#E5DEC9]/60 flex items-center justify-between gap-2">
                  <span className={`text-xs font-titan flex items-center gap-1 ${
                    isSelected ? 'text-[#E62E00]' : 'text-[#4D080F]'
                  }`}>
                    {isSelected ? 'Browse This Menu ↓' : 'Select Branch →'}
                  </span>

                  <a
                    href={branch.whatsappCatalogueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 text-xs text-[#25D366] hover:bg-[#25D366]/10 rounded-lg flex items-center gap-1 transition-colors font-montserrat font-bold"
                    title={`View ${branch.shortName} WhatsApp Catalogue`}
                  >
                    <MessageCircle className="w-3.5 h-3.5 fill-[#25D366]" />
                    <span className="text-[10px] hidden sm:inline">WhatsApp</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
