import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Globe,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  Plus,
  Trash2,
  Edit2,
  FileText,
  Megaphone,
  Phone,
  RefreshCw,
} from 'lucide-react';

interface CmsBanner {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  badge?: string;
  imageUrl?: string;
  active: boolean;
  order: number;
}

interface CmsArticle {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  summary: string;
  content: string[];
  category: string;
  author: string;
  readTime: string;
  publishedDate: string;
  image: string;
  tags?: string[];
  published: boolean;
  updatedAt: string;
}

interface CmsData {
  hero: {
    badge: string;
    headline: string;
    subheadline: string;
    ctaPrimaryText: string;
    ctaSecondaryText: string;
    announcementTicker: string;
    isTickerActive: boolean;
  };
  contactInfo: {
    primaryPhone: string;
    whatsappNumber: string;
    email: string;
    headOfficeAddress: string;
    openingHours: string;
  };
  banners: CmsBanner[];
  articles: CmsArticle[];
  status: 'draft' | 'published';
  updatedAt: string;
  updatedBy?: string;
}

export const WebsiteCmsManager: React.FC = () => {
  const { currentStaff, setIsStorefrontPreviewActive, setCmsContent, refreshCmsContent } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<'hero' | 'banners' | 'articles' | 'contact'>('hero');
  const [cms, setCms] = useState<CmsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Editing state for an article modal
  const [editingArticle, setEditingArticle] = useState<CmsArticle | null>(null);
  const [isArticleModalOpen, setIsArticleModalOpen] = useState<boolean>(false);

  // New banner state
  const [isAddingBanner, setIsAddingBanner] = useState<boolean>(false);
  const [newBanner, setNewBanner] = useState<CmsBanner>({
    id: `banner-${Date.now()}`,
    title: '',
    subtitle: '',
    ctaText: 'Explore More',
    ctaLink: '#menu-explorer-section',
    badge: 'Special',
    imageUrl: '',
    active: true,
    order: 1,
  });

  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false);

  const getAuthHeaders = () => {
    const sessionToken = localStorage.getItem('choplife_staff_token') || sessionStorage.getItem('choplife_staff_token');
    return {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    };
  };

  const handleUploadMediaFile = async (file: File, onUploaded: (url: string) => void) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFeedback({ type: 'error', message: 'Unsupported image format. Please upload JPEG, PNG, or WebP.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'Image exceeds the 5 MB maximum size limit.' });
      return;
    }
    setIsUploadingMedia(true);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/uploads/image', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          dataBase64,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onUploaded(data.url);
        setFeedback({ type: 'success', message: `Uploaded media '${data.filename}' (${Math.round(data.sizeBytes / 1024)} KB).` });
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({ type: 'error', message: err.error || 'Media upload failed.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error uploading media file.' });
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const fetchCmsContent = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/cms/content?view=draft');
      if (res.ok) {
        const data = await res.json();
        setCms(data);
      } else {
        setFeedback({ type: 'error', message: 'Failed to load website content from server.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error connecting to CMS server.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCmsContent();
  }, []);

  const handleSave = async (publishLive: boolean = false) => {
    if (!cms) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const payload = {
        ...cms,
        status: publishLive ? 'published' : 'draft',
      };
      const res = await fetch('/api/cms/content', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setCms(data.cmsContent);
        setCmsContent(data.cmsContent);
        if (publishLive) {
          await refreshCmsContent();
        }
        setFeedback({
          type: 'success',
          message: publishLive
            ? 'Changes published live to Choplife Republic customer storefront!'
            : 'Draft saved successfully in back-office workspace.',
        });
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({ type: 'error', message: err.error || 'Failed to save changes.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error saving CMS changes.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreviewStorefront = () => {
    if (cms) {
      setCmsContent(cms);
    }
    setIsStorefrontPreviewActive(true);
  };

  const handleAddBanner = () => {
    if (!newBanner.title.trim()) return;
    if (!cms) return;
    const updated = [...cms.banners, { ...newBanner, id: `banner-${Date.now()}` }];
    setCms({ ...cms, banners: updated });
    setIsAddingBanner(false);
    setNewBanner({
      id: `banner-${Date.now()}`,
      title: '',
      subtitle: '',
      ctaText: 'Explore More',
      ctaLink: '#menu-explorer-section',
      badge: 'Special',
      imageUrl: '',
      active: true,
      order: updated.length + 1,
    });
  };

  const handleRemoveBanner = (id: string) => {
    if (!cms) return;
    setCms({ ...cms, banners: cms.banners.filter((b) => b.id !== id) });
  };

  const handleToggleBanner = (id: string) => {
    if (!cms) return;
    setCms({
      ...cms,
      banners: cms.banners.map((b) => (b.id === id ? { ...b, active: !b.active } : b)),
    });
  };

  const handleSaveArticle = () => {
    if (!editingArticle || !editingArticle.title.trim() || !cms) return;
    const exists = cms.articles.some((a) => a.id === editingArticle.id);
    let updated: CmsArticle[];
    if (exists) {
      updated = cms.articles.map((a) => (a.id === editingArticle.id ? { ...editingArticle, updatedAt: new Date().toISOString() } : a));
    } else {
      updated = [
        ...cms.articles,
        {
          ...editingArticle,
          id: editingArticle.id || `art-${Date.now()}`,
          slug: editingArticle.slug || editingArticle.title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
          updatedAt: new Date().toISOString(),
        },
      ];
    }
    setCms({ ...cms, articles: updated });
    setIsArticleModalOpen(false);
    setEditingArticle(null);
  };

  const handleDeleteArticle = (id: string) => {
    if (!cms) return;
    setCms({ ...cms, articles: cms.articles.filter((a) => a.id !== id) });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FAF7F2] text-[#241311]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#800D15] animate-spin" />
          <p className="text-sm font-semibold tracking-wide">Loading Website Content Manager...</p>
        </div>
      </div>
    );
  }

  if (!cms) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FAF7F2] text-[#241311] p-6">
        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-8 max-w-md text-center space-y-4 shadow-md">
          <AlertCircle className="w-12 h-12 text-[#800D15] mx-auto" />
          <h3 className="text-lg font-bold">Unable to Load CMS</h3>
          <p className="text-xs text-[#7A6A65]">Failed to retrieve published content schema from the server.</p>
          <button
            onClick={fetchCmsContent}
            className="px-4 py-2 bg-[#800D15] hover:bg-[#4D080F] text-white text-xs font-bold rounded-xl"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#FAF7F2] text-[#241311] overflow-hidden">
      {/* CMS Header & Actions Bar */}
      <div className="min-h-16 px-4 sm:px-6 py-2.5 bg-white border-b border-[#E5DEC9] flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#FFF8E7] border border-[#FFC700] flex items-center justify-center text-[#800D15] shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#241311]">
                Website Content Management (CMS)
              </h2>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                  cms.status === 'published'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}
              >
                {cms.status === 'published' ? '● Live Storefront' : '○ Draft Changes'}
              </span>
            </div>
            <p className="text-[11px] text-[#7A6A65] hidden sm:block">
              Directly curate homepage hero headlines, announcement banners, and editorial stories
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="cms-preview-storefront-btn"
            onClick={handlePreviewStorefront}
            className="px-3 py-1.5 rounded-xl bg-[#FAF7F2] hover:bg-[#FFF8E7] text-[#4D080F] border border-[#E5DEC9] hover:border-[#FFC700] text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs whitespace-nowrap"
            title="Preview Customer Storefront"
          >
            <Eye className="w-3.5 h-3.5 text-[#800D15]" />
            <span>Preview Storefront</span>
          </button>

          <button
            id="cms-save-draft-btn"
            onClick={() => handleSave(false)}
            disabled={isSaving}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#FAF7F2] text-[#241311] border border-[#E5DEC9] text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-2xs whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5 text-[#800D15]" />
            <span>Save Draft</span>
          </button>

          <button
            id="cms-publish-live-btn"
            onClick={() => handleSave(true)}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#800D15] to-[#B91C1C] hover:from-[#991B1B] hover:to-[#DC2626] text-white border border-[#FFC700]/40 text-xs font-extrabold flex items-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FFC700]" />
            <span>Publish Live</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`px-4 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-stone-500 hover:text-stone-800 text-xs font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="bg-white border-b border-[#E5DEC9] px-4 sm:px-6 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
        <button
          onClick={() => setActiveSubTab('hero')}
          className={`py-3 px-3.5 text-xs font-extrabold tracking-wide uppercase border-b-2 transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
            activeSubTab === 'hero'
              ? 'border-[#800D15] text-[#800D15]'
              : 'border-transparent text-[#7A6A65] hover:text-[#241311]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Hero &amp; Ticker</span>
        </button>

        <button
          onClick={() => setActiveSubTab('banners')}
          className={`py-3 px-3.5 text-xs font-extrabold tracking-wide uppercase border-b-2 transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
            activeSubTab === 'banners'
              ? 'border-[#800D15] text-[#800D15]'
              : 'border-transparent text-[#7A6A65] hover:text-[#241311]'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>Promotions &amp; Banners ({cms.banners.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('articles')}
          className={`py-3 px-3.5 text-xs font-extrabold tracking-wide uppercase border-b-2 transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
            activeSubTab === 'articles'
              ? 'border-[#800D15] text-[#800D15]'
              : 'border-transparent text-[#7A6A65] hover:text-[#241311]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Editorial Stories &amp; Blog ({cms.articles.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('contact')}
          className={`py-3 px-4 text-xs font-extrabold tracking-wide uppercase border-b-2 transition-all flex items-center gap-2 ${
            activeSubTab === 'contact'
              ? 'border-[#800D15] text-[#800D15]'
              : 'border-transparent text-[#7A6A65] hover:text-[#241311]'
          }`}
        >
          <Phone className="w-3.5 h-3.5" />
          <span>Public Contact & Hours</span>
        </button>
      </div>

      {/* Main Form Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* SUBTAB: HERO & TICKER */}
        {activeSubTab === 'hero' && (
          <div className="max-w-4xl space-y-6">
            <div className="bg-white border border-[#E5DEC9] rounded-2xl p-5 space-y-5 shadow-xs">
              <div className="border-b border-[#E5DEC9] pb-3">
                <h3 className="text-sm font-bold text-[#800D15] uppercase tracking-wider">
                  Live Announcement Ticker
                </h3>
                <p className="text-xs text-[#7A6A65]">
                  Appears at the very top of the customer storefront for flash promotions, branch status, and delivery alerts.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cms.hero.isTickerActive}
                    onChange={(e) =>
                      setCms({ ...cms, hero: { ...cms.hero, isTickerActive: e.target.checked } })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-200 border border-[#E5DEC9] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#15803D]"></div>
                </label>
                <span className="text-xs font-semibold text-[#241311]">
                  {cms.hero.isTickerActive ? 'Ticker Active & Visible on Website' : 'Ticker Hidden'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4D080F] mb-1">
                  Ticker Announcement Text
                </label>
                <input
                  type="text"
                  value={cms.hero.announcementTicker}
                  onChange={(e) =>
                    setCms({ ...cms, hero: { ...cms.hero, announcementTicker: e.target.value } })
                  }
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-4 py-2.5 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                  placeholder="e.g. Fast 30-min Delivery to GRA, Airport Rd, Ugbowo & Ring Road!"
                />
              </div>
            </div>

            <div className="bg-white border border-[#E5DEC9] rounded-2xl p-5 space-y-5 shadow-xs">
              <div className="border-b border-[#E5DEC9] pb-3">
                <h3 className="text-sm font-bold text-[#800D15] uppercase tracking-wider">
                  Storefront Hero Headline & Tagline
                </h3>
                <p className="text-xs text-[#7A6A65]">
                  Primary brand statement and value proposition shown above the fold on the homepage.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#4D080F] mb-1">
                    Top Badge Label
                  </label>
                  <input
                    type="text"
                    value={cms.hero.badge}
                    onChange={(e) =>
                      setCms({ ...cms, hero: { ...cms.hero, badge: e.target.value } })
                    }
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-4 py-2.5 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                    placeholder="e.g. AUTHENTIC BENIN CITY CUISINE"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4D080F] mb-1">
                    Primary CTA Button Text
                  </label>
                  <input
                    type="text"
                    value={cms.hero.ctaPrimaryText}
                    onChange={(e) =>
                      setCms({ ...cms, hero: { ...cms.hero, ctaPrimaryText: e.target.value } })
                    }
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-4 py-2.5 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                    placeholder="e.g. Explore Our Menu"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4D080F] mb-1">
                  Main Headline (Use &lt;br /&gt; or line breaks if desired)
                </label>
                <input
                  type="text"
                  value={cms.hero.headline}
                  onChange={(e) =>
                    setCms({ ...cms, hero: { ...cms.hero, headline: e.target.value } })
                  }
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-4 py-2.5 text-xs text-[#241311] font-bold focus:outline-none focus:border-[#800D15]"
                  placeholder="e.g. ENJOY YOURSELF, IS THAT TOO MUCH TO ASK?"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4D080F] mb-1">
                  Subheadline / Narrative Description
                </label>
                <textarea
                  rows={3}
                  value={cms.hero.subheadline}
                  onChange={(e) =>
                    setCms({ ...cms, hero: { ...cms.hero, subheadline: e.target.value } })
                  }
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-4 py-2.5 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                  placeholder="e.g. Crispy golden spring rolls, loaded monster shawarma..."
                />
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB: PROMOTIONS & BANNERS */}
        {activeSubTab === 'banners' && (
          <div className="max-w-4xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#800D15] uppercase tracking-wider">
                  Promotional Banners & Deal Highlights
                </h3>
                <p className="text-xs text-[#7A6A65]">
                  Banners appear across homepage deal sections and promotional sliders.
                </p>
              </div>
              <button
                onClick={() => setIsAddingBanner(true)}
                className="px-3.5 py-1.5 rounded-xl bg-[#800D15] hover:bg-[#4D080F] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add New Banner
              </button>
            </div>

            {isAddingBanner && (
              <div className="bg-white border border-[#FFC700] rounded-2xl p-5 space-y-4 animate-in fade-in shadow-sm">
                <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#800D15]">
                    Create New Promotion Banner
                  </h4>
                  <button onClick={() => setIsAddingBanner(false)} className="text-xs text-[#7A6A65] hover:text-[#241311]">
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#4D080F] mb-1">Banner Title</label>
                    <input
                      type="text"
                      value={newBanner.title}
                      onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
                      className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                      placeholder="e.g. Sunday Family Feast Platter"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#4D080F] mb-1">Badge Tag</label>
                    <input
                      type="text"
                      value={newBanner.badge || ''}
                      onChange={(e) => setNewBanner({ ...newBanner, badge: e.target.value })}
                      className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                      placeholder="e.g. 20% OFF or Signature"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4D080F] mb-1">Subtitle / Details</label>
                  <input
                    type="text"
                    value={newBanner.subtitle}
                    onChange={(e) => setNewBanner({ ...newBanner, subtitle: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                    placeholder="e.g. Free delivery on all platter orders above ₦15,000"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#4D080F] mb-1">CTA Button Text</label>
                    <input
                      type="text"
                      value={newBanner.ctaText}
                      onChange={(e) => setNewBanner({ ...newBanner, ctaText: e.target.value })}
                      className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#4D080F] mb-1">Banner Image (URL or Upload)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newBanner.imageUrl || ''}
                        onChange={(e) => setNewBanner({ ...newBanner, imageUrl: e.target.value })}
                        className="flex-1 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                        placeholder="https://... or /uploads/..."
                      />
                      <label className="px-3 py-2 rounded-xl bg-[#FFF8E7] hover:bg-[#FFC700]/30 border border-[#FFC700] text-[#800D15] text-xs font-bold cursor-pointer shrink-0">
                        <span>{isUploadingMedia ? '...' : 'Upload'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={isUploadingMedia}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadMediaFile(f, (url) => setNewBanner({ ...newBanner, imageUrl: url }));
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsAddingBanner(false)}
                    className="px-3 py-1.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] text-xs font-bold text-[#7A6A65]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddBanner}
                    className="px-4 py-1.5 rounded-xl bg-[#800D15] text-white text-xs font-bold"
                  >
                    Add Banner
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {cms.banners.map((b) => (
                <div
                  key={b.id}
                  className="bg-white border border-[#E5DEC9] rounded-2xl p-4 flex items-center justify-between gap-4 shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    {b.imageUrl ? (
                      <img src={b.imageUrl} alt={b.title} className="w-16 h-12 object-cover rounded-xl border border-[#E5DEC9]" />
                    ) : (
                      <div className="w-16 h-12 rounded-xl bg-[#FFF8E7] border border-[#E5DEC9] flex items-center justify-center text-[#800D15]">
                        <Megaphone className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#241311]">{b.title}</span>
                        {b.badge && (
                          <span className="px-1.5 py-0.5 rounded bg-[#FFF8E7] border border-[#FFC700] text-[#800D15] text-[10px] font-bold">
                            {b.badge}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            b.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {b.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#7A6A65]">{b.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleBanner(b.id)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#FAF7F2] text-[#241311] hover:bg-[#E5DEC9]/60 border border-[#E5DEC9]"
                    >
                      {b.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleRemoveBanner(b.id)}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                      title="Delete banner"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBTAB: EDITORIAL STORIES & BLOG */}
        {activeSubTab === 'articles' && (
          <div className="max-w-4xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#800D15] uppercase tracking-wider">
                  Editorial Articles & Food Stories
                </h3>
                <p className="text-xs text-[#7A6A65]">
                  Publish customer education stories: 100% Bromate-Free Bread, Small Chops guides, culinary culture.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingArticle({
                    id: `art-${Date.now()}`,
                    slug: '',
                    title: '',
                    subtitle: '',
                    summary: '',
                    content: [''],
                    category: 'bakery',
                    author: currentStaff?.name || 'Choplife Culinary Team',
                    readTime: '3 min read',
                    publishedDate: 'Today',
                    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
                    published: true,
                    updatedAt: new Date().toISOString(),
                  });
                  setIsArticleModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#800D15] hover:bg-[#4D080F] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Write New Article
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cms.articles.map((art) => (
                <div
                  key={art.id}
                  className="bg-white border border-[#E5DEC9] rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-2xs"
                >
                  <div className="space-y-2">
                    <div className="relative h-28 rounded-xl overflow-hidden bg-[#FAF7F2]">
                      <img src={art.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'} alt={art.title} className="w-full h-full object-cover" />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 text-[#FFC700] text-[10px] font-bold uppercase tracking-wider backdrop-blur-xs">
                        {art.category}
                      </span>
                      <span
                        className={`absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase backdrop-blur-xs ${
                          art.published ? 'bg-emerald-700/90 text-white' : 'bg-stone-800/90 text-[#FFC700]'
                        }`}
                      >
                        {art.published ? 'Published' : 'Draft'}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-[#241311] line-clamp-2">{art.title}</h4>
                    <p className="text-[11px] text-[#7A6A65] line-clamp-2">{art.summary}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#E5DEC9] text-[10px] text-[#7A6A65]">
                    <span>By {art.author} • {art.readTime}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingArticle(art);
                          setIsArticleModalOpen(true);
                        }}
                        className="p-1 rounded text-[#800D15] hover:bg-[#FFF8E7]"
                        title="Edit Article"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteArticle(art.id)}
                        className="p-1 rounded text-red-600 hover:bg-red-50"
                        title="Delete Article"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBTAB: CONTACT & HOURS */}
        {activeSubTab === 'contact' && (
          <div className="max-w-4xl space-y-6">
            <div className="bg-white border border-[#E5DEC9] rounded-2xl p-5 space-y-5 shadow-xs">
              <div className="border-b border-[#E5DEC9] pb-3">
                <h3 className="text-sm font-bold text-[#800D15] uppercase tracking-wider">
                  Public Contact & Operational Schedule
                </h3>
                <p className="text-xs text-[#7A6A65]">
                  Shown in storefront footer, contact modals, and order confirmation receipts.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#4D080F] mb-1">
                    Primary Telephone
                  </label>
                  <input
                    type="text"
                    value={cms.contactInfo.primaryPhone}
                    onChange={(e) =>
                      setCms({ ...cms, contactInfo: { ...cms.contactInfo, primaryPhone: e.target.value } })
                    }
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-4 py-2.5 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4D080F] mb-1">
                    Official WhatsApp Line
                  </label>
                  <input
                    type="text"
                    value={cms.contactInfo.whatsappNumber}
                    onChange={(e) =>
                      setCms({ ...cms, contactInfo: { ...cms.contactInfo, whatsappNumber: e.target.value } })
                    }
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-4 py-2.5 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4D080F] mb-1">
                    Customer Care Email
                  </label>
                  <input
                    type="email"
                    value={cms.contactInfo.email}
                    onChange={(e) =>
                      setCms({ ...cms, contactInfo: { ...cms.contactInfo, email: e.target.value } })
                    }
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-4 py-2.5 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4D080F] mb-1">
                    Opening Hours Summary
                  </label>
                  <input
                    type="text"
                    value={cms.contactInfo.openingHours}
                    onChange={(e) =>
                      setCms({ ...cms, contactInfo: { ...cms.contactInfo, openingHours: e.target.value } })
                    }
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-4 py-2.5 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4D080F] mb-1">
                  Headquarters / Flagship Address
                </label>
                <input
                  type="text"
                  value={cms.contactInfo.headOfficeAddress}
                  onChange={(e) =>
                    setCms({ ...cms, contactInfo: { ...cms.contactInfo, headOfficeAddress: e.target.value } })
                  }
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-4 py-2.5 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ARTICLE EDIT / CREATE MODAL */}
      {isArticleModalOpen && editingArticle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5DEC9] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[#E5DEC9] bg-[#FAF7F2] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#800D15] uppercase tracking-wider">
                {editingArticle.title ? 'Edit Editorial Story' : 'New Story'}
              </h3>
              <button
                onClick={() => {
                  setIsArticleModalOpen(false);
                  setEditingArticle(null);
                }}
                className="text-xs text-[#7A6A65] hover:text-[#241311] font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-[#4D080F] mb-1">Article Title</label>
                <input
                  type="text"
                  value={editingArticle.title}
                  onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                  placeholder="e.g. 100% Bromate-Free Bread: Why Clean Baking Matters"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4D080F] mb-1">Category</label>
                  <select
                    value={editingArticle.category}
                    onChange={(e) => setEditingArticle({ ...editingArticle, category: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                  >
                    <option value="bakery">Bakery</option>
                    <option value="culture">Culture</option>
                    <option value="events">Events</option>
                    <option value="recipes">Recipes</option>
                    <option value="delivery">Delivery</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4D080F] mb-1">Author</label>
                  <input
                    type="text"
                    value={editingArticle.author}
                    onChange={(e) => setEditingArticle({ ...editingArticle, author: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4D080F] mb-1">Read Time</label>
                  <input
                    type="text"
                    value={editingArticle.readTime}
                    onChange={(e) => setEditingArticle({ ...editingArticle, readTime: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4D080F] mb-1">Hero Image (URL or Upload JPEG/PNG/WebP)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingArticle.image}
                    onChange={(e) => setEditingArticle({ ...editingArticle, image: e.target.value })}
                    className="flex-1 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311]"
                  />
                  <label className="px-3 py-2 rounded-xl bg-[#FFF8E7] hover:bg-[#FFC700]/30 border border-[#FFC700] text-[#800D15] text-xs font-bold cursor-pointer shrink-0">
                    <span>{isUploadingMedia ? 'Uploading...' : 'Upload Image'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={isUploadingMedia}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadMediaFile(f, (url) => setEditingArticle({ ...editingArticle, image: url }));
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4D080F] mb-1">Summary / Excerpt</label>
                <textarea
                  rows={2}
                  value={editingArticle.summary}
                  onChange={(e) => setEditingArticle({ ...editingArticle, summary: e.target.value })}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4D080F] mb-1">
                  Article Body Paragraphs (One paragraph per line)
                </label>
                <textarea
                  rows={6}
                  value={editingArticle.content.join('\n\n')}
                  onChange={(e) =>
                    setEditingArticle({
                      ...editingArticle,
                      content: e.target.value.split(/\n\n+/).map((p) => p.trim()).filter(Boolean),
                    })
                  }
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-[#241311]"
                  placeholder="Write article paragraphs separated by blank lines..."
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="art-published"
                  checked={editingArticle.published}
                  onChange={(e) => setEditingArticle({ ...editingArticle, published: e.target.checked })}
                />
                <label htmlFor="art-published" className="text-xs font-semibold text-[#241311]">
                  Publish immediately when CMS is saved
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-[#E5DEC9] bg-[#FAF7F2] flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsArticleModalOpen(false);
                  setEditingArticle(null);
                }}
                className="px-4 py-2 rounded-xl bg-white border border-[#E5DEC9] text-xs font-bold text-[#7A6A65]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveArticle}
                className="px-5 py-2 rounded-xl bg-[#800D15] text-white text-xs font-extrabold hover:bg-[#4D080F]"
              >
                Save Story
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
