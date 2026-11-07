import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Sparkles,
  Gamepad2,
  Users,
  PartyPopper,
  CalendarCheck,
  CheckCircle2,
  MapPin,
  Clock,
  ArrowRight,
} from 'lucide-react';

export const ExperienceSection: React.FC = () => {
  const { setIsCateringModalOpen, setIsLocationsModalOpen, currentBranch } = useApp();
  const [isReservedSuccess, setIsReservedSuccess] = useState(false);
  const [reservationCode, setReservationCode] = useState<string | null>(null);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [isSubmittingReservation, setIsSubmittingReservation] = useState(false);
  const [reservationData, setReservationData] = useState({
    name: '',
    phone: '',
    date: '',
    time: '19:00',
    guests: '4',
    branch: 'gra',
    specialReq: '',
  });

  const handleTableBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setReservationError(null);
    setIsSubmittingReservation(true);
    try {
      const res = await fetch('/api/reservations/table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservationData),
      });
      const data = await res.json();
      if (!res.ok) {
        setReservationError(data.error || 'Could not complete table reservation.');
        setIsSubmittingReservation(false);
        return;
      }
      setReservationCode(data.reservation?.reservationCode || null);
      setIsReservedSuccess(true);
      setIsSubmittingReservation(false);
      setTimeout(() => {
        setIsReservedSuccess(false);
        setReservationCode(null);
        setReservationData({
          name: '',
          phone: '',
          date: '',
          time: '19:00',
          guests: '4',
          branch: 'gra',
          specialReq: '',
        });
      }, 6000);
    } catch {
      setReservationError('Network error while submitting table reservation.');
      setIsSubmittingReservation(false);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14" id="experience-section">
      <div className="bg-[#FAF7F2] rounded-3xl p-6 sm:p-10 lg:p-12 border border-[#E5DEC9] shadow-md space-y-10">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-2 bg-[#4D080F] text-[#FFC700] px-3.5 py-1 rounded-full text-xs font-titan tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 text-[#FFC700]" />
            DINE-IN • LOUNGE • CELEBRATIONS
          </div>
          <h2 className="font-titan text-3xl sm:text-4xl text-[#4D080F] tracking-tight">
            THE REPUBLIC EXPERIENCE
          </h2>
          <p className="text-xs sm:text-sm text-[#7A6A65] font-montserrat">
            More than just delicious food. Experience the vibrant Choplife vibe across our flagship lounges in GRA and Ugbowo.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Games & Lounge */}
          <div className="bg-white rounded-3xl p-6 border border-[#E5DEC9] shadow-sm hover:shadow-md transition-all space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E62E00]/10 text-[#E62E00] flex items-center justify-center">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <h3 className="font-titan text-lg text-[#4D080F]">Games & Chill Lounge</h3>
            <p className="text-xs text-[#5C4D49] font-montserrat leading-relaxed">
              Board games, PlayStation tournaments, Ayo Olopon, and chilled acoustic Afrobeat playlists at our GRA & Ugbowo patios.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs font-montserrat font-bold text-[#E62E00]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Free WiFi & Air Conditioning
            </div>
          </div>

          {/* Card 2: Birthdays & Celebrations */}
          <div className="bg-white rounded-3xl p-6 border border-[#E5DEC9] shadow-sm hover:shadow-md transition-all space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FFC700]/20 text-[#4D080F] flex items-center justify-center">
              <PartyPopper className="w-6 h-6 text-[#E62E00]" />
            </div>
            <h3 className="font-titan text-lg text-[#4D080F]">Birthdays & Celebrations</h3>
            <p className="text-xs text-[#5C4D49] font-montserrat leading-relaxed">
              Custom birthday setups, photo-ready backdrops, personalized cake presentations, and customized small chops mega platters.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs font-montserrat font-bold text-[#E62E00]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Table & Space Reservations
            </div>
          </div>

          {/* Card 3: Corporate & Group Dining */}
          <div className="bg-white rounded-3xl p-6 border border-[#E5DEC9] shadow-sm hover:shadow-md transition-all space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#43E29F]/20 text-[#006039] flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-titan text-lg text-[#4D080F]">Corporate & Group Feasts</h3>
            <p className="text-xs text-[#5C4D49] font-montserrat leading-relaxed">
              Office team lunches, business meetings, and alumni get-togethers with dedicated server attention and bulk billing.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs font-montserrat font-bold text-[#E62E00]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Reserved Group Seating
            </div>
          </div>

        </div>

        {/* Table Reservation & Inquiry Strip */}
        <div className="bg-[#4D080F] text-white rounded-3xl p-6 sm:p-8 border border-[#FFC700]/30 shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            <div className="lg:col-span-5 space-y-2">
              <span className="text-xs font-titan uppercase tracking-widest text-[#FFC700]">
                RESERVE A DINE-IN TABLE
              </span>
              <h3 className="font-titan text-2xl sm:text-3xl text-white">
                PLANNING A DINE-IN VISIT?
              </h3>
              <p className="text-xs text-white/80 font-montserrat leading-relaxed">
                Skip the wait during peak weekend hours. Reserve your table at Choplife Republic GRA or Ugbowo with ease.
              </p>
              <div className="pt-2 flex items-center gap-4 text-xs font-montserrat text-white/70">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#FFC700]" /> GRA & Ugbowo
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#43E29F]" /> Instant Confirmation
                </span>
              </div>
            </div>

            <div className="lg:col-span-7">
              {isReservedSuccess ? (
                <div className="bg-emerald-900/80 border border-emerald-400 text-white p-6 rounded-2xl text-center space-y-2 animate-in zoom-in-95 duration-200">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <h4 className="font-titan text-lg text-white">
                    Table Reservation Confirmed {reservationCode ? `(${reservationCode})` : ''}!
                  </h4>
                  <p className="text-xs font-montserrat text-white/90">
                    Your table reservation has been logged with our host desk. We will WhatsApp or call {reservationData.phone || 'you'} shortly to confirm your seating.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleTableBooking} className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="table-booking-form">
                  {reservationError && (
                    <div className="sm:col-span-2 bg-red-900/60 border border-red-400/50 text-red-100 rounded-xl px-3 py-2 text-xs font-montserrat">
                      {reservationError}
                    </div>
                  )}
                  <input
                    type="text"
                    required
                    placeholder="Your Full Name"
                    value={reservationData.name}
                    onChange={(e) => setReservationData({ ...reservationData, name: e.target.value })}
                    className="bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/60 font-montserrat focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Phone / WhatsApp Number"
                    value={reservationData.phone}
                    onChange={(e) => setReservationData({ ...reservationData, phone: e.target.value })}
                    className="bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/60 font-montserrat focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                  />
                  <input
                    type="date"
                    required
                    value={reservationData.date}
                    onChange={(e) => setReservationData({ ...reservationData, date: e.target.value })}
                    className="bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-xs text-white font-montserrat focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                  />
                  <select
                    value={reservationData.branch}
                    onChange={(e) => setReservationData({ ...reservationData, branch: e.target.value })}
                    className="bg-[#4D080F] border border-white/20 rounded-xl px-3 py-2.5 text-xs text-white font-montserrat focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                  >
                    <option value="gra">Choplife Republic GRA</option>
                    <option value="ugbowo">Choplife Republic Ugbowo</option>
                    <option value="okabere">Choplife Republic Okabere</option>
                  </select>

                  <div className="sm:col-span-2 flex items-center gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={isSubmittingReservation}
                      className="flex-1 bg-[#FFC700] hover:bg-[#FFD733] disabled:opacity-60 text-[#4D080F] font-titan text-xs py-3 rounded-xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2"
                      id="submit-table-reservation-btn"
                    >
                      <CalendarCheck className="w-4 h-4" />
                      {isSubmittingReservation ? 'RESERVING TABLE...' : 'RESERVE MY TABLE'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCateringModalOpen(true)}
                      className="bg-white/10 hover:bg-white/20 text-white font-montserrat font-bold text-xs px-4 py-3 rounded-xl border border-white/20"
                    >
                      Event Catering Quote →
                    </button>
                  </div>
                </form>
              )}
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
