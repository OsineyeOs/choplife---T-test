import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Share2,
  Download,
  Copy,
  Check,
  Film,
  Sparkles,
  Smartphone,
  Tv,
  FileText,
  Clock,
  Layers,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Flame,
  Utensils,
  Store,
} from 'lucide-react';

export interface LaunchVideoShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LaunchVideoShowcaseModal: React.FC<LaunchVideoShowcaseModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'video' | 'vertical' | 'teaser' | 'script' | 'downloads'>('video');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(90); // 90-second launch video
  const [activeChapter, setActiveChapter] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Chapter markers for 90s master video
  const chapters = [
    { title: 'The Hook: Sizzle & Spice', time: 0, duration: 5, description: 'Macro woodfire turkey sizzle & peppered grills.' },
    { title: 'Brand Reveal: Choplife Republic', time: 5, duration: 10, description: 'GRA lounge facade & golden Choplife emblem.' },
    { title: 'The Digital Product Reveal', time: 15, duration: 10, description: 'Smartphone match-cut into live web app interface.' },
    { title: 'Customer Ordering Experience', time: 25, duration: 20, description: 'Branch picker, Small Chops Box Builder & Paystack checkout.' },
    { title: 'Front-Office POS & Kitchen Display', time: 45, duration: 15, description: 'Cashier POS register, bill split & live KDS ticket sync.' },
    { title: 'Ecosystem & Operational Harmony', time: 60, duration: 15, description: 'Inventory management, rider dispatch & dining room.' },
    { title: 'Brand Signature & Call to Action', time: 75, duration: 15, description: '100% Maximum Enjoyment logo reveal & choplife.ng CTA.' },
  ];

  // Voiceover subtitles track
  const subtitles = [
    { start: 0, end: 5, text: 'Sizzle. Spice. Pure satisfaction.' },
    { start: 5, end: 15, text: 'Welcome to Choplife Republic — Benin City’s premiere destination for woodfire grills, party jollof, and legendary small chops.' },
    { start: 15, end: 25, text: 'Now, we’re bringing the entire Choplife experience right to your fingertips with our connected digital platform.' },
    { start: 25, end: 35, text: 'Whether you are ordering from our GRA, Okabere, or Ugbowo branches, discovering your favorite meals takes just a tap.' },
    { start: 35, end: 45, text: 'Customise your Small Chops box, order fresh bromate-free bakery bread, and pay instantly with secure online checkout.' },
    { start: 45, end: 55, text: 'In our branches, our integrated POS and Kitchen Display System sync orders live — keeping our kitchens fast and accurate.' },
    { start: 55, end: 65, text: 'From central stock management to instant order tracking, technology powers every single plate we serve.' },
    { start: 65, end: 75, text: 'Choplife Republic. Enjoy Yourself... Is That Too Much To Ask?' },
    { start: 75, end: 90, text: 'Visit choplife.ng or stop by any of our branches today.' },
  ];

  // Video playback timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  // Update active chapter based on current time
  useEffect(() => {
    const currentChapIdx = chapters.findIndex((chap, idx) => {
      const nextChap = chapters[idx + 1];
      return currentTime >= chap.time && (!nextChap || currentTime < nextChap.time);
    });
    if (currentChapIdx !== -1) {
      setActiveChapter(currentChapIdx);
    }
  }, [currentTime]);

  const currentSubtitle = subtitles.find((sub) => currentTime >= sub.start && currentTime <= sub.end)?.text || '';

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = Number(e.target.value);
    setCurrentTime(targetTime);
  };

  const jumpToChapter = (time: number) => {
    setCurrentTime(time);
    setIsPlaying(true);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyEmbed = () => {
    const embedCode = `<iframe src="${window.location.origin}/#launch-video" width="100%" height="500" frameborder="0" allowfullscreen></iframe>`;
    navigator.clipboard.writeText(embedCode);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-fadeIn font-sans select-none">
      <div className="bg-[#241311] border-2 border-[#FFC700]/50 rounded-3xl w-full max-w-5xl text-white shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header Bar */}
        <header className="px-6 py-4 bg-[#180A09] border-b border-[#4D080F] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFC700] text-[#4D080F] flex items-center justify-center font-titan text-xl shadow-md">
              C
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-titan text-white tracking-tight">
                  CHOPLIFE REPUBLIC &bull; OFFICIAL LAUNCH FILM
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-[#800D15] text-[#FFC700] text-[10px] font-black uppercase tracking-wider">
                  4K MASTER
                </span>
              </div>
              <p className="text-xs text-stone-400 font-montserrat">
                Connected Food Experience &amp; Digital QSR Platform
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-red-600/50 text-white transition-colors border border-white/10"
            title="Close Showcase"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="px-6 bg-[#1F0C0E] border-b border-[#4D080F] flex items-center justify-between overflow-x-auto shrink-0 py-2 gap-2">
          <div className="flex items-center gap-2 min-w-max">
            <button
              onClick={() => setActiveTab('video')}
              className={`px-4 py-2 rounded-xl text-xs font-titan tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'video'
                  ? 'bg-[#FFC700] text-[#4D080F] shadow-md'
                  : 'bg-white/5 text-stone-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>4K Film (16:9)</span>
            </button>
            <button
              onClick={() => setActiveTab('vertical')}
              className={`px-4 py-2 rounded-xl text-xs font-titan tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'vertical'
                  ? 'bg-[#FFC700] text-[#4D080F] shadow-md'
                  : 'bg-white/5 text-stone-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Social Reel (9:16)</span>
            </button>
            <button
              onClick={() => setActiveTab('teaser')}
              className={`px-4 py-2 rounded-xl text-xs font-titan tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'teaser'
                  ? 'bg-[#FFC700] text-[#4D080F] shadow-md'
                  : 'bg-white/5 text-stone-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>15s Teaser</span>
            </button>
            <button
              onClick={() => setActiveTab('script')}
              className={`px-4 py-2 rounded-xl text-xs font-titan tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'script'
                  ? 'bg-[#FFC700] text-[#4D080F] shadow-md'
                  : 'bg-white/5 text-stone-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Script &amp; Storyboard</span>
            </button>
            <button
              onClick={() => setActiveTab('downloads')}
              className={`px-4 py-2 rounded-xl text-xs font-titan tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'downloads'
                  ? 'bg-[#FFC700] text-[#4D080F] shadow-md'
                  : 'bg-white/5 text-stone-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share &amp; Export</span>
            </button>
          </div>
        </div>

        {/* Modal Main Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: MASTER 4K VIDEO PLAYER */}
          {activeTab === 'video' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Video Screen Canvas */}
              <div className="lg:col-span-8 flex flex-col space-y-4">
                {/* Simulated High-Res Video Canvas */}
                <div
                  ref={videoContainerRef}
                  className="relative aspect-video rounded-2xl overflow-hidden border-2 border-[#FFC700]/40 shadow-2xl bg-gradient-to-br from-[#1A080A] via-[#38090E] to-[#120406] flex flex-col justify-between p-6 select-none group"
                >
                  {/* Background Motion Visuals */}
                  <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#FFC700_1px,transparent_1px)] [background-size:16px_16px]" />

                  {/* Top Canvas Bar */}
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-[#800D15]/90 border border-[#FFC700]/50 text-[#FFC700] text-xs font-titan tracking-wider flex items-center gap-1.5 shadow-sm">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{chapters[activeChapter]?.title || 'Choplife Launch Film'}</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-200 bg-black/60 px-2.5 py-1 rounded-lg border border-white/10">
                      4K UHD &bull; 60 FPS
                    </span>
                  </div>

                  {/* Center Visual Visualizer / Screen Frame */}
                  <div className="relative z-10 flex flex-col items-center justify-center my-auto text-center space-y-3 p-4">
                    {/* Scene Illustration Graphic Based on Active Chapter */}
                    {activeChapter === 0 && (
                      <div className="space-y-2 animate-fadeIn">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#E62E00]/20 border border-[#E62E00] flex items-center justify-center text-[#FFC700]">
                          <Flame className="w-8 h-8 animate-bounce" />
                        </div>
                        <h3 className="font-titan text-2xl text-white">THE HOOK: WOODFIRE SIZZLE</h3>
                        <p className="text-xs text-amber-200/80 max-w-md font-montserrat">
                          Macro charcoal grill sizzle &amp; succulent peppered turkey presentation.
                        </p>
                      </div>
                    )}

                    {activeChapter === 1 && (
                      <div className="space-y-2 animate-fadeIn">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#FFC700]/20 border border-[#FFC700] flex items-center justify-center text-[#FFC700]">
                          <Store className="w-8 h-8" />
                        </div>
                        <h3 className="font-titan text-2xl text-white">BRAND REVEAL &bull; BENIN CITY</h3>
                        <p className="text-xs text-amber-200/80 max-w-md font-montserrat">
                          GRA, Okabere &amp; Ugbowo branch facade &amp; golden Choplife emblem.
                        </p>
                      </div>
                    )}

                    {(activeChapter === 2 || activeChapter === 3) && (
                      <div className="space-y-2 animate-fadeIn">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-[#FFC700]">
                          <Utensils className="w-8 h-8" />
                        </div>
                        <h3 className="font-titan text-2xl text-white">CUSTOMER WEB APP DEMO</h3>
                        <p className="text-xs text-amber-200/80 max-w-md font-montserrat">
                          Menu explorer, Small Chops Box Builder &amp; Paystack online checkout.
                        </p>
                      </div>
                    )}

                    {activeChapter === 4 && (
                      <div className="space-y-2 animate-fadeIn">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400">
                          <Layers className="w-8 h-8" />
                        </div>
                        <h3 className="font-titan text-2xl text-white">POS REGISTER &amp; KDS SYNC</h3>
                        <p className="text-xs text-amber-200/80 max-w-md font-montserrat">
                          Cashier POS terminal check creation &amp; real-time kitchen order ticket sync.
                        </p>
                      </div>
                    )}

                    {(activeChapter === 5 || activeChapter === 6) && (
                      <div className="space-y-2 animate-fadeIn">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#800D15] border border-[#FFC700] flex items-center justify-center text-[#FFC700]">
                          <Sparkles className="w-8 h-8" />
                        </div>
                        <h3 className="font-titan text-2xl text-white">100% MAXIMUM ENJOYMENT</h3>
                        <p className="text-xs text-amber-200/80 max-w-md font-montserrat">
                          Connected digital ecosystem powering Benin City hospitality.
                        </p>
                      </div>
                    )}

                    {/* On-screen Subtitle Overlay */}
                    {currentSubtitle && (
                      <div className="mt-4 px-4 py-2 bg-black/80 backdrop-blur-md border border-[#FFC700]/40 rounded-xl text-xs font-montserrat font-bold text-[#FFC700] max-w-lg shadow-lg">
                        "{currentSubtitle}"
                      </div>
                    )}
                  </div>

                  {/* Video Control Bar */}
                  <div className="relative z-10 bg-black/75 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col space-y-2">
                    {/* Scrub Bar */}
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-amber-200 w-10 text-right">
                        {formatTime(currentTime)}
                      </span>
                      <input
                        type="range"
                        min="0"
                        max={duration}
                        value={currentTime}
                        onChange={handleSeek}
                        className="flex-1 h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-[#FFC700]"
                      />
                      <span className="text-[11px] font-mono text-stone-400 w-10">
                        {formatTime(duration)}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setIsPlaying(!isPlaying)}
                          className="w-8 h-8 rounded-lg bg-[#FFC700] text-[#4D080F] flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                        >
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                        </button>
                        <button
                          onClick={() => setIsMuted(!isMuted)}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                        >
                          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        <span className="text-xs text-stone-300 font-montserrat hidden sm:inline">
                          Chapter {activeChapter + 1} of {chapters.length}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#FFC700] font-titan uppercase bg-[#800D15]/80 px-2 py-1 rounded">
                          Official Launch Cut
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Video Info Summary */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-titan text-[#FFC700] uppercase">Product Launch Video Summary</span>
                    <span className="text-stone-400 font-mono">Length: 01:30 &bull; 4K Master</span>
                  </div>
                  <p className="text-xs text-stone-300 leading-relaxed font-montserrat">
                    This official launch film introduces Choplife Republic's connected digital ecosystem in Benin City — bridging online food ordering, Small Chops box customisation, front-office POS terminals, and live Kitchen Display System (KDS) ticketing.
                  </p>
                </div>
              </div>

              {/* Right Column: Interactive Chapter Index */}
              <div className="lg:col-span-4 flex flex-col space-y-3">
                <h3 className="text-xs font-titan text-[#FFC700] uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#FFC700]" /> Film Chapters
                </h3>

                <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
                  {chapters.map((chap, idx) => {
                    const isActive = idx === activeChapter;
                    return (
                      <button
                        key={idx}
                        onClick={() => jumpToChapter(chap.time)}
                        className={`w-full p-3 rounded-2xl text-left border transition-all flex flex-col space-y-1 ${
                          isActive
                            ? 'bg-[#800D15] border-[#FFC700] shadow-md text-white'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 text-stone-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-titan tracking-wide text-[#FFC700]">
                            {idx + 1}. {chap.title}
                          </span>
                          <span className="text-[10px] font-mono font-bold bg-black/40 px-2 py-0.5 rounded text-amber-200">
                            {formatTime(chap.time)}
                          </span>
                        </div>
                        <p className="text-[11px] font-montserrat text-stone-200 line-clamp-2 leading-tight">
                          {chap.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VERTICAL REEL (9:16) */}
          {activeTab === 'vertical' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-5 flex justify-center">
                <div className="w-64 aspect-[9/16] rounded-3xl overflow-hidden border-4 border-[#FFC700] shadow-2xl bg-gradient-to-b from-[#4D080F] to-[#120406] p-4 flex flex-col justify-between text-center relative">
                  <div className="bg-black/60 px-3 py-1 rounded-full text-[10px] font-titan text-[#FFC700] mx-auto">
                    Instagram Reel / TikTok
                  </div>
                  <div className="my-auto space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#FFC700] text-[#4D080F] mx-auto flex items-center justify-center font-titan text-xl">
                      C
                    </div>
                    <h3 className="font-titan text-lg text-white">100% MAXIMUM ENJOYMENT</h3>
                    <p className="text-[11px] text-amber-200 font-montserrat">
                      Order Small Chops &amp; Woodfire Grills online at choplife.ng
                    </p>
                  </div>
                  <div className="bg-[#800D15] text-[#FFC700] text-xs font-titan py-2 rounded-xl border border-[#FFC700]/40">
                    ORDER NOW &rarr;
                  </div>
                </div>
              </div>

              <div className="md:col-span-7 space-y-4">
                <h3 className="font-titan text-xl text-[#FFC700]">VERTICAL SOCIAL MEDIA CUT (9:16)</h3>
                <p className="text-xs text-stone-300 leading-relaxed font-montserrat">
                  Optimized for Instagram Reels, TikTok, YouTube Shorts, and WhatsApp Status updates. Re-framed in native 1080x1920 with high-contrast burn-in subtitles and centered action.
                </p>
                <div className="space-y-2">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-xs font-mono text-amber-200">
                    Target Specs: 1080 &times; 1920 px &bull; 45 Seconds &bull; 60 FPS
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 15s PROMO TEASER */}
          {activeTab === 'teaser' && (
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <h3 className="font-titan text-xl text-[#FFC700]">15-SECOND PROMOTIONAL TEASER</h3>
              <p className="text-xs text-stone-300 font-montserrat leading-relaxed">
                A rapid-fire, high-energy promotional clip engineered for digital paid ad campaigns (Facebook Ads, Instagram Ads, YouTube Bumper Ads).
              </p>
              <div className="p-4 bg-[#180A09] rounded-xl border border-[#FFC700]/30 space-y-2 font-mono text-xs">
                <div className="text-[#FFC700] font-bold">[00:00 - 00:03] Sizzling Peppered Turkey &amp; Smokey Jollof</div>
                <div className="text-white">[00:03 - 00:09] Small Chops Custom Box Builder UI Screencast</div>
                <div className="text-[#FFC700] font-bold">[00:09 - 00:15] Order Online at choplife.ng | GRA &bull; Okabere &bull; Ugbowo</div>
              </div>
            </div>
          )}

          {/* TAB 4: COMPLETE SCRIPT & STORYBOARD */}
          {activeTab === 'script' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-titan text-lg text-[#FFC700]">VOICEOVER SCRIPT &amp; SHOT LIST</h3>
                <span className="text-xs text-stone-400 font-mono">130 WPM Pace &bull; Male Professional VO</span>
              </div>

              <div className="space-y-3">
                {subtitles.map((sub, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3">
                    <span className="px-2 py-1 bg-[#800D15] text-[#FFC700] rounded text-[10px] font-mono font-bold shrink-0">
                      {formatTime(sub.start)} - {formatTime(sub.end)}
                    </span>
                    <div className="space-y-1">
                      <p className="text-xs font-montserrat font-semibold text-white">"{sub.text}"</p>
                      <p className="text-[11px] text-stone-400 italic">Visual Cue: {chapters[idx]?.description || 'On-screen application action'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: SHARE & EXPORT */}
          {activeTab === 'downloads' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <h4 className="font-titan text-sm text-[#FFC700] flex items-center gap-2">
                    <Share2 className="w-4 h-4" /> Share Product Launch Video
                  </h4>
                  <p className="text-xs text-stone-300 font-montserrat">
                    Share the live URL or embed the player directly on stakeholder portals or social media.
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-2 rounded-xl bg-[#800D15] hover:bg-[#A3121B] text-white text-xs font-titan flex items-center gap-2 transition-all shadow-md"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#FFC700]" />}
                      <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
                    </button>
                    <button
                      onClick={handleCopyEmbed}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-titan flex items-center gap-2 transition-all"
                    >
                      {copiedEmbed ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedEmbed ? 'Embed Code Copied!' : 'Copy iFrame Embed'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <h4 className="font-titan text-sm text-[#FFC700] flex items-center gap-2">
                    <Download className="w-4 h-4" /> Download Export Package
                  </h4>
                  <p className="text-xs text-stone-300 font-montserrat">
                    Download production master files, audio voiceover track, and graphic posters.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      onClick={() => alert('Downloading 4K Master Launch Video (MP4, 185 MB)...')}
                      className="px-3.5 py-2 rounded-xl bg-[#FFC700] hover:bg-[#FFD733] text-[#4D080F] text-xs font-titan flex items-center gap-1.5 transition-all shadow-md"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>4K Master (16:9)</span>
                    </button>
                    <button
                      onClick={() => alert('Downloading Vertical Social Reel (MP4, 95 MB)...')}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-titan flex items-center gap-1.5 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Social Reel (9:16)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer className="px-6 py-4 bg-[#180A09] border-t border-[#4D080F] flex items-center justify-between shrink-0">
          <div className="text-xs text-stone-400 font-montserrat">
            Choplife Republic &bull; Benin City, Edo State
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#800D15] hover:bg-[#A3121B] text-white text-xs font-titan transition-all shadow-md"
          >
            Close Video Showcase
          </button>
        </footer>
      </div>
    </div>
  );
};
