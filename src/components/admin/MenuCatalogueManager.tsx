import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  UtensilsCrossed,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Layers,
  RefreshCw,
  Tag,
  Store,
  Globe,
  FileSpreadsheet,
  Package,
  Percent,
  Gift,
  ShoppingBag,
  Filter,
} from 'lucide-react';
import { ExcelBulkImportAndMigrationModal } from '../common/ExcelBulkImportAndMigrationModal';

export interface MenuCategoryItem {
  id: string;
  name: string;
  tag: string;
  description: string;
  icon: string;
  badge?: string;
  sortOrder: number;
  channels: ('website' | 'pos')[];
  isActive: boolean;
  updatedAt: string;
}

export interface PackageComponentItem {
  productId: string;
  productName?: string;
  quantity: number;
  unitPrice?: number;
  notes?: string;
}

export interface ProductDiscountConfig {
  enabled: boolean;
  type: 'percentage' | 'fixed';
  value: number;
  startDate?: string;
  endDate?: string;
  eligibleChannels?: ('website' | 'pos')[];
  eligibleBranches?: string[];
  reason?: string;
}

export interface WholesaleTierItem {
  minQuantity: number;
  unitPrice: number;
  label?: string;
}

export interface ProductWholesalePricingConfig {
  enabled: boolean;
  retailPrice: number;
  wholesalePrice: number;
  minWholesaleQty: number;
  tiers?: WholesaleTierItem[];
  allowSkuPooling?: boolean;
  eligibleBranches?: string[];
  eligibleChannels?: ('website' | 'pos')[];
  preventExtraDiscountOnWholesale?: boolean;
}

export interface ProductPromotionRulesConfig {
  isActive: boolean;
  qualifyingProductIds?: string[];
  qualifyingCategories?: string[];
  minimumSpend?: number;
  minimumQuantity?: number;
  freeRewardProductId?: string;
  freeRewardQuantity?: number;
  maxRewardsPerOrder?: number;
}

export interface MenuProductItem {
  id: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  category: string;
  subcategory?: string;
  image: string;
  basePrice: number;
  branchPrices?: Record<string, number>;
  branchAvailability: Record<string, boolean>;
  prepTimeMinutes: number;
  isPopular?: boolean;
  isFeatured?: boolean;
  isNewProduct?: boolean;
  isSpicy?: boolean;
  isVegetarian?: boolean;
  packagingCharge?: number;
  productType?: 'standard' | 'combo' | 'platter' | 'package' | 'promotion';
  compositionVersion?: number;
  components?: PackageComponentItem[];
  discountConfig?: ProductDiscountConfig;
  wholesalePricing?: ProductWholesalePricingConfig;
  isWholesale?: boolean;
  minOrderQty?: number;
  wholesaleUnitPrice?: number;
  promotionRules?: ProductPromotionRulesConfig;
  channels: ('website' | 'pos')[];
  status: 'published' | 'draft' | 'archived';
  updatedAt: string;
}

export const MenuCatalogueManager: React.FC = () => {
  const { refreshMenuProducts } = useApp();
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');
  const [products, setProducts] = useState<MenuProductItem[]>([]);
  const [categories, setCategories] = useState<MenuCategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'website' | 'pos'>('all');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);

  // Edit / Create Modals
  const [editingCategory, setEditingCategory] = useState<MenuCategoryItem | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);

  const [editingProduct, setEditingProduct] = useState<MenuProductItem | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState<boolean>(false);

  // Component Builder local inputs inside Product Modal
  const [componentSearch, setComponentSearch] = useState<string>('');
  const [selectedComponentProductId, setSelectedComponentProductId] = useState<string>('');
  const [selectedComponentQty, setSelectedComponentQty] = useState<number>(1);

  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);

  const getAuthHeaders = () => {
    const sessionToken =
      localStorage.getItem('choplife_staff_token') || sessionStorage.getItem('choplife_staff_token');
    return {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    };
  };

  const handleProductImageUpload = async (file: File) => {
    if (!editingProduct) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFeedback({ type: 'error', message: 'Only JPEG, PNG, and WebP images are permitted.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'Image file size must be 5 MB or less.' });
      return;
    }
    setIsUploadingImage(true);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('File read error'));
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
        setEditingProduct({ ...editingProduct, image: data.url });
        setFeedback({
          type: 'success',
          message: `Uploaded image '${data.filename}' (${Math.round(data.sizeBytes / 1024)} KB).`,
        });
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({ type: 'error', message: err.error || 'Image upload failed.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error uploading product image.' });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resCats, resProds] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/menu/products'),
      ]);
      if (resCats.ok) setCategories(await resCats.json());
      if (resProds.ok) setProducts(await resProds.json());
      await refreshMenuProducts();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to load menu data from server.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchQuery =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.shortDescription && p.shortDescription.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchCategory = categoryFilter === 'all' || p.category === categoryFilter;

      const matchType =
        typeFilter === 'all'
          ? true
          : typeFilter === 'wholesale'
          ? Boolean(p.wholesalePricing?.enabled || p.isWholesale)
          : (p.productType || 'standard') === typeFilter;

      const matchChannel =
        channelFilter === 'all' || (p.channels && p.channels.includes(channelFilter));

      return matchQuery && matchCategory && matchType && matchChannel;
    });
  }, [products, searchQuery, categoryFilter, typeFilter, channelFilter]);

  // Candidate products for Package Component selector (excludes self to prevent self-reference)
  const availableComponentCandidates = useMemo(() => {
    return products.filter((p) => {
      if (editingProduct?.id && p.id === editingProduct.id) return false;
      if (p.status === 'archived') return false;
      if (!componentSearch.trim()) return true;
      const q = componentSearch.toLowerCase().trim();
      return (
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, editingProduct?.id, componentSearch]);

  // Toggle Category Status
  const handleToggleCategoryActive = async (cat: MenuCategoryItem) => {
    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      if (res.ok) {
        const data = await res.json();
        setCategories((prev) => prev.map((c) => (c.id === cat.id ? data.category : c)));
        setFeedback({
          type: 'success',
          message: `Category '${cat.name}' is now ${!cat.isActive ? 'active' : 'hidden'}.`,
        });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Failed to update category.' });
    }
  };

  // Save Category Modal
  const handleSaveCategory = async () => {
    if (!editingCategory || !editingCategory.name.trim()) return;
    const isNew = !categories.some((c) => c.id === editingCategory.id);
    const endpoint = isNew ? '/api/categories' : `/api/categories/${editingCategory.id}`;
    const method = isNew ? 'POST' : 'PUT';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(editingCategory),
      });

      if (res.ok) {
        const data = await res.json();
        if (isNew) {
          setCategories((prev) => [...prev, data.category]);
        } else {
          setCategories((prev) => prev.map((c) => (c.id === editingCategory.id ? data.category : c)));
        }
        setIsCategoryModalOpen(false);
        setEditingCategory(null);
        setFeedback({
          type: 'success',
          message: `Category '${data.category.name}' saved successfully!`,
        });
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({ type: 'error', message: err.error || 'Failed to save category.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error saving category.' });
    }
  };

  // Toggle Product Availability for Branch
  const handleToggleProductAvailability = async (productId: string, branchId: string) => {
    const p = products.find((item) => item.id === productId);
    if (!p) return;

    const currentBranchAvail = p.branchAvailability || { gra: true, okabere: true, ugbowo: true };
    const updatedAvail = {
      ...currentBranchAvail,
      [branchId]: !currentBranchAvail[branchId],
    };

    try {
      const res = await fetch(`/api/menu/products/${productId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ branchAvailability: updatedAvail }),
      });

      if (res.ok) {
        const data = await res.json();
        setProducts((prev) => prev.map((item) => (item.id === productId ? data.product : item)));
        await refreshMenuProducts();
        setFeedback({
          type: 'success',
          message: `${p.name} at ${branchId.toUpperCase()} is now ${updatedAvail[branchId] ? 'IN STOCK' : 'SOLD OUT (86)'}.`,
        });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Failed to update branch stock status.' });
    }
  };

  // Add component to editingProduct
  const handleAddComponentToPackage = () => {
    if (!editingProduct) return;
    const targetId = selectedComponentProductId || availableComponentCandidates[0]?.id;
    if (!targetId) return;
    const targetProd = products.find((p) => p.id === targetId);
    if (!targetProd) return;

    const qty = Math.max(1, Number(selectedComponentQty) || 1);
    const currentComponents = [...(editingProduct.components || [])];
    const existingIdx = currentComponents.findIndex((c) => c.productId === targetProd.id);

    if (existingIdx >= 0) {
      currentComponents[existingIdx] = {
        ...currentComponents[existingIdx],
        quantity: currentComponents[existingIdx].quantity + qty,
      };
    } else {
      currentComponents.push({
        productId: targetProd.id,
        productName: targetProd.name,
        quantity: qty,
        unitPrice: targetProd.basePrice,
      });
    }

    setEditingProduct({
      ...editingProduct,
      components: currentComponents,
    });
    setSelectedComponentQty(1);
  };

  // Load canonical 2000 Mini Pack composition preset
  const handleLoad2000MiniPackPreset = () => {
    if (!editingProduct) return;
    setEditingProduct({
      ...editingProduct,
      name: editingProduct.name || '2000 Mini Pack',
      category: editingProduct.category || 'small-chops',
      productType: 'package',
      basePrice: 2000,
      shortDescription:
        editingProduct.shortDescription ||
        '3 Puff-Puff, 1 Samosa, 1 Spring Roll, and 1 Peppered Beef.',
      components: [
        { productId: 'prod-snack-puff-puff-single', productName: 'Puff Puff (1 pc)', quantity: 3, unitPrice: 100 },
        { productId: 'prod-snack-samosa-single', productName: 'Samosa (1 pc)', quantity: 1, unitPrice: 500 },
        { productId: 'prod-snack-springroll-single', productName: 'Spring Roll (1 pc)', quantity: 1, unitPrice: 500 },
        { productId: 'prod-sc-beef-single', productName: 'Beef Small Chops', quantity: 1, unitPrice: 400 },
      ],
    });
  };

  // Save Product Modal
  const handleSaveProduct = async () => {
    if (!editingProduct || !editingProduct.name.trim() || editingProduct.basePrice === undefined) {
      setFeedback({ type: 'error', message: 'Product name, category, and selling price are required.' });
      return;
    }

    const pType = editingProduct.productType || 'standard';
    if (
      (pType === 'package' || pType === 'combo' || pType === 'platter') &&
      (!Array.isArray(editingProduct.components) || editingProduct.components.length === 0)
    ) {
      setFeedback({
        type: 'error',
        message: `A ${pType.toUpperCase()} product requires at least one component product in its composition.`,
      });
      return;
    }

    const isNew = !editingProduct.id || !products.some((p) => p.id === editingProduct.id);
    const endpoint = isNew ? '/api/menu/products' : `/api/menu/products/${editingProduct.id}`;
    const method = isNew ? 'POST' : 'PUT';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(editingProduct),
      });

      if (res.ok) {
        const data = await res.json();
        if (isNew) {
          setProducts((prev) => [...prev, data.product]);
        } else {
          setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? data.product : p)));
        }
        await refreshMenuProducts();
        setIsProductModalOpen(false);
        setEditingProduct(null);
        setFeedback({
          type: 'success',
          message: `Saved '${data.product.name}' (${(data.product.productType || 'standard').toUpperCase()}) to live catalogue!`,
        });
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({ type: 'error', message: err.error || 'Failed to save product.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error saving product.' });
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FAF7F2] text-stone-900 overflow-hidden">
      {/* Header Bar */}
      <div className="min-h-16 px-6 py-2 bg-white border-b border-[#E5DEC9] flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#4D080F] border border-[#FFC700]/40 flex items-center justify-center text-[#FFC700]">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black uppercase tracking-wider text-stone-900">
                Menu, Packages, Promotions &amp; Wholesale Catalogue
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-[#FFC700]/25 text-[#4D080F] text-[10px] font-bold tracking-wider uppercase border border-[#FFC700]">
                Authoritative Master
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              Create standard items, multi-component packages (2000 Mini Pack), bread wholesale tiers, package discounts &amp; bulk templates
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchData}
            className="p-2 rounded-xl bg-[#FAF7F2] hover:bg-stone-100 text-stone-600 hover:text-stone-900 border border-[#E5DEC9] transition-all"
            title="Reload from Database"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsBulkImportModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-[#FAF7F2] hover:bg-[#FFF8E7] text-[#4D080F] border border-[#E5DEC9] text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#800D15]" />
            <span>Bulk Template / Import (.XLS/.CSV)</span>
          </button>

          {activeTab === 'categories' ? (
            <button
              onClick={() => {
                setEditingCategory({
                  id: '',
                  name: '',
                  tag: '',
                  description: '',
                  icon: '🍲',
                  badge: '',
                  sortOrder: categories.length + 1,
                  channels: ['website', 'pos'],
                  isActive: true,
                  updatedAt: new Date().toISOString(),
                });
                setIsCategoryModalOpen(true);
              }}
              className="px-4 py-1.5 rounded-xl bg-[#4D080F] hover:bg-[#660b14] text-[#FFC700] text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Category</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setEditingProduct({
                    id: '',
                    name: '',
                    shortDescription: '',
                    longDescription: '',
                    category: 'small-chops',
                    basePrice: 0,
                    branchPrices: {},
                    branchAvailability: { gra: true, okabere: true, ugbowo: true },
                    prepTimeMinutes: 15,
                    image: '',
                    productType: 'package',
                    components: [],
                    channels: ['website', 'pos'],
                    status: 'published',
                    updatedAt: new Date().toISOString(),
                  });
                  setIsProductModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-[#4D080F] border border-amber-300 text-xs font-extrabold flex items-center gap-1.5 transition-all"
              >
                <Package className="w-3.5 h-3.5 text-[#800D15]" />
                <span>New Package / Bundle</span>
              </button>

              <button
                onClick={() => {
                  setEditingProduct({
                    id: '',
                    name: '',
                    shortDescription: '',
                    longDescription: '',
                    category: categories[0]?.id || 'small-chops',
                    basePrice: 2000,
                    branchPrices: {},
                    branchAvailability: { gra: true, okabere: true, ugbowo: true },
                    prepTimeMinutes: 20,
                    image: '',
                    productType: 'standard',
                    channels: ['website', 'pos'],
                    status: 'published',
                    updatedAt: new Date().toISOString(),
                  });
                  setIsProductModalOpen(true);
                }}
                className="px-4 py-1.5 rounded-xl bg-[#4D080F] hover:bg-[#660b14] text-[#FFC700] text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Product</span>
              </button>
            </>
          )}
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
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-stone-500 hover:text-stone-900 text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Tabs Switcher: Products vs Categories */}
      <div className="bg-white border-b border-[#E5DEC9] px-6 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('products')}
            className={`py-3 px-4 text-xs font-extrabold tracking-wide uppercase border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'products'
                ? 'border-[#4D080F] text-[#4D080F]'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Products &amp; Packages ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`py-3 px-4 text-xs font-extrabold tracking-wide uppercase border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'categories'
                ? 'border-[#4D080F] text-[#4D080F]'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Categories Tree ({categories.length})</span>
          </button>
        </div>

        {activeTab === 'products' && (
          <div className="w-full xl:w-auto py-2">
            <div className="flex items-center gap-2">
              {/* Search Input */}
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search catalogue..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#4D080F]"
                />
              </div>

              {/* Mobile Filter Toggle */}
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
                className={`lg:hidden px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all ${
                  isMobileFilterOpen || (categoryFilter !== 'all' || typeFilter !== 'all' || channelFilter !== 'all')
                    ? 'bg-[#4D080F] text-[#FFC700] border-[#4D080F]'
                    : 'bg-[#FAF7F2] text-stone-700 border-[#E5DEC9] hover:bg-stone-100'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filters</span>
                {(categoryFilter !== 'all' || typeFilter !== 'all' || channelFilter !== 'all') && (
                  <span className="w-4 h-4 rounded-full bg-[#FFC700] text-[#4D080F] text-[10px] font-black flex items-center justify-center">
                    {(categoryFilter !== 'all' ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0) + (channelFilter !== 'all' ? 1 : 0)}
                  </span>
                )}
              </button>

              {/* Desktop Filters (Always visible on lg+) */}
              <div className="hidden lg:flex items-center gap-2">
                {/* Product Type Filter */}
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-[#FAF7F2] border border-[#E5DEC9] text-xs font-semibold rounded-xl px-2.5 py-1.5 text-stone-900 focus:outline-none focus:border-[#4D080F]"
                >
                  <option value="all">All Product Types</option>
                  <option value="standard">Standard Items</option>
                  <option value="package">Packages / Bundles (e.g. 2000 Mini Pack)</option>
                  <option value="combo">Meal Combos</option>
                  <option value="platter">Event Platters</option>
                  <option value="promotion">Promotions</option>
                  <option value="wholesale">Wholesale / Bulk Bread</option>
                </select>

                {/* Category Filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-[#FAF7F2] border border-[#E5DEC9] text-xs font-semibold rounded-xl px-2.5 py-1.5 text-stone-900 focus:outline-none focus:border-[#4D080F]"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>

                {/* Channel Filter */}
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value as any)}
                  className="bg-[#FAF7F2] border border-[#E5DEC9] text-xs font-semibold rounded-xl px-2.5 py-1.5 text-stone-900 focus:outline-none focus:border-[#4D080F]"
                >
                  <option value="all">All Channels</option>
                  <option value="website">Website Storefront</option>
                  <option value="pos">POS Registers</option>
                </select>
              </div>
            </div>

            {/* Mobile Expandable Filter Dropdown Section */}
            {isMobileFilterOpen && (
              <div className="lg:hidden grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2.5 mt-2 border-t border-[#E5DEC9]">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] text-xs font-semibold rounded-xl px-2.5 py-1.5 text-stone-900 focus:outline-none focus:border-[#4D080F]"
                >
                  <option value="all">All Product Types</option>
                  <option value="standard">Standard Items</option>
                  <option value="package">Packages / Bundles</option>
                  <option value="combo">Meal Combos</option>
                  <option value="platter">Event Platters</option>
                  <option value="promotion">Promotions</option>
                  <option value="wholesale">Wholesale / Bulk Bread</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] text-xs font-semibold rounded-xl px-2.5 py-1.5 text-stone-900 focus:outline-none focus:border-[#4D080F]"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value as any)}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] text-xs font-semibold rounded-xl px-2.5 py-1.5 text-stone-900 focus:outline-none focus:border-[#4D080F]"
                >
                  <option value="all">All Channels</option>
                  <option value="website">Website Storefront</option>
                  <option value="pos">POS Registers</option>
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-stone-500">
            <RefreshCw className="w-6 h-6 animate-spin text-[#4D080F]" />
            <p className="text-xs">Loading catalogue records...</p>
          </div>
        ) : activeTab === 'categories' ? (
          /* CATEGORIES TABLE */
          <div className="bg-white border border-[#E5DEC9] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF7F2] border-b border-[#E5DEC9] text-stone-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">Order</th>
                    <th className="py-3 px-4">Icon &amp; Name</th>
                    <th className="py-3 px-4">Tagline &amp; Description</th>
                    <th className="py-3 px-4">Channels</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DEC9]">
                  {categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#4D080F]">#{cat.sortOrder}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">{cat.icon}</span>
                          <div>
                            <span className="font-extrabold text-stone-900 text-xs block">{cat.name}</span>
                            <span className="text-[10px] text-stone-500 font-mono">{cat.id}</span>
                          </div>
                          {cat.badge && (
                            <span className="px-2 py-0.5 rounded bg-[#FFC700]/25 text-[#4D080F] text-[10px] font-bold">
                              {cat.badge}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-semibold text-xs text-stone-900">{cat.tag}</p>
                        <p className="text-[11px] text-stone-500 truncate">{cat.description}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {cat.channels?.includes('website') && (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold flex items-center gap-1">
                              <Globe className="w-3 h-3" /> Web
                            </span>
                          )}
                          {cat.channels?.includes('pos') && (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                              <Store className="w-3 h-3" /> POS
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleCategoryActive(cat)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                            cat.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-stone-100 text-stone-600 border border-stone-200 hover:text-stone-900'
                          }`}
                        >
                          {cat.isActive ? 'Active' : 'Hidden'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setEditingCategory(cat);
                            setIsCategoryModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-[#4D080F] hover:bg-[#FAF7F2] transition-colors mr-1"
                          title="Edit Category"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* PRODUCTS TABLE */
          <div className="bg-white border border-[#E5DEC9] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF7F2] border-b border-[#E5DEC9] text-stone-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">Product, Type &amp; Composition</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Pricing &amp; Tiers</th>
                    <th className="py-3 px-4">Branch Stock (86 Switch)</th>
                    <th className="py-3 px-4">Channels</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DEC9]">
                  {filteredProducts.map((p) => {
                    const pType = p.productType || 'standard';
                    const hasComponents = Array.isArray(p.components) && p.components.length > 0;
                    const hasDiscount = Boolean(p.discountConfig?.enabled && p.discountConfig.value > 0);
                    const hasWholesale = Boolean(p.wholesalePricing?.enabled || p.isWholesale);
                    const hasPromo = Boolean(p.promotionRules?.isActive);

                    return (
                      <tr key={p.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-3">
                            {p.image && p.category !== 'packaging' ? (
                              <img
                                src={p.image}
                                alt={p.name}
                                className="w-12 h-12 rounded-xl object-cover border border-[#E5DEC9] shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] flex items-center justify-center text-[9px] font-bold text-stone-400 text-center px-1 shrink-0 uppercase">
                                {p.category === 'packaging' ? 'PACK' : 'NO PHOTO'}
                              </div>
                            )}
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-extrabold text-stone-900 text-xs">{p.name}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${
                                    pType === 'package' || pType === 'combo' || pType === 'platter'
                                      ? 'bg-purple-50 text-purple-800 border-purple-200'
                                      : pType === 'promotion'
                                      ? 'bg-pink-50 text-pink-800 border-pink-200'
                                      : 'bg-stone-100 text-stone-600 border-stone-200'
                                  }`}
                                >
                                  {pType}
                                  {p.compositionVersion ? ` v${p.compositionVersion}` : ''}
                                </span>
                                {hasDiscount && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9px] font-bold">
                                    {p.discountConfig?.type === 'percentage'
                                      ? `-${p.discountConfig.value}% OFF`
                                      : `-₦${p.discountConfig?.value} OFF`}
                                  </span>
                                )}
                                {hasWholesale && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 text-[9px] font-bold">
                                    WS: Min {p.wholesalePricing?.minWholesaleQty || p.minOrderQty || 20} @ ₦
                                    {(p.wholesalePricing?.wholesalePrice || p.wholesaleUnitPrice || 400).toLocaleString()}
                                  </span>
                                )}
                                {hasPromo && (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[9px] font-bold">
                                    🎁 FREE REWARD RULE
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-stone-500 font-mono block">{p.id}</span>
                              {!hasComponents && p.shortDescription && (
                                <span className="text-[11px] text-stone-500 line-clamp-1">{p.shortDescription}</span>
                              )}
                              {hasComponents && (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {p.components!.map((c, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-0.5 rounded-md bg-[#FAF7F2] border border-[#E5DEC9] text-[10px] font-bold text-[#4D080F]"
                                    >
                                      {c.quantity}&times; {c.productName || (c as any).name || c.productId}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-xs text-stone-700 uppercase">
                          {p.category}
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          <div className="font-bold text-xs text-[#4D080F]">
                            ₦{p.basePrice.toLocaleString()}
                          </div>
                          {hasDiscount && (
                            <div className="text-[10px] text-emerald-700 font-bold">
                              Net: ₦
                              {Math.max(
                                0,
                                p.discountConfig?.type === 'percentage'
                                  ? p.basePrice - Math.round((p.basePrice * p.discountConfig.value) / 100)
                                  : p.basePrice - (p.discountConfig?.value || 0)
                              ).toLocaleString()}
                            </div>
                          )}
                          {hasWholesale && (
                            <div className="text-[10px] text-amber-800 font-bold">
                              Bulk: ₦{(p.wholesalePricing?.wholesalePrice || p.wholesaleUnitPrice || 0).toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            {['gra', 'okabere', 'ugbowo'].map((bId) => {
                              const isAvail = p.branchAvailability?.[bId] !== false;
                              return (
                                <button
                                  key={bId}
                                  onClick={() => handleToggleProductAvailability(p.id, bId)}
                                  title={`Click to toggle availability at ${bId.toUpperCase()}`}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all border ${
                                    isAvail
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-red-50 hover:text-red-700'
                                      : 'bg-red-50 text-red-700 border-red-200 hover:bg-emerald-50 hover:text-emerald-700'
                                  }`}
                                >
                                  {bId.toUpperCase()}: {isAvail ? 'IN' : '86'}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1">
                            {p.channels?.includes('website') && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-bold">
                                Web
                              </span>
                            )}
                            {p.channels?.includes('pos') && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold">
                                POS
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              p.status === 'published'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {p.status || 'published'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={async () => {
                                const nextStatus = p.status === 'archived' ? 'published' : 'archived';
                                try {
                                  const res = await fetch(`/api/menu/products/${p.id}`, {
                                    method: 'PUT',
                                    headers: getAuthHeaders(),
                                    body: JSON.stringify({
                                      status: nextStatus,
                                      confirmAuthorisedPrice: nextStatus === 'published' ? true : undefined,
                                      basePrice: p.basePrice > 0 ? p.basePrice : undefined,
                                    }),
                                  });
                                  if (res.ok) {
                                    const data = await res.json();
                                    setProducts((prev) => prev.map((item) => (item.id === p.id ? data.product : item)));
                                    await refreshMenuProducts();
                                    setFeedback({
                                      type: 'success',
                                      message:
                                        nextStatus === 'archived'
                                          ? `Archived '${p.name}' — removed from live storefront & POS.`
                                          : `Restored '${p.name}' to live catalogue.`,
                                    });
                                  } else {
                                    const err = await res.json().catch(() => ({}));
                                    setFeedback({ type: 'error', message: err.error || 'Failed to update archive status.' });
                                  }
                                } catch {
                                  setFeedback({ type: 'error', message: 'Network error updating archive status.' });
                                }
                              }}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                p.status === 'archived'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                              }`}
                              title={p.status === 'archived' ? 'Restore Archived Item' : 'Archive Item'}
                            >
                              {p.status === 'archived' ? 'Restore' : 'Archive'}
                            </button>
                            <button
                              onClick={() => {
                                setEditingProduct({
                                  ...p,
                                  productType: p.productType || 'standard',
                                  components: p.components ? [...p.components] : [],
                                });
                                setIsProductModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-[#4D080F] hover:bg-[#FAF7F2] transition-colors"
                              title="Edit Product / Package / Pricing"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* CATEGORY EDIT/CREATE MODAL */}
      {isCategoryModalOpen && editingCategory && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5DEC9] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[#E5DEC9] bg-[#FAF7F2] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#4D080F] uppercase tracking-wider">
                {editingCategory.id ? 'Edit Category' : 'Create New Category'}
              </h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-xs text-stone-500 hover:text-stone-900">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-stone-900">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Category Name</label>
                  <input
                    type="text"
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#4D080F]"
                    placeholder="e.g. Small Chops & Platters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Emoji Icon</label>
                  <input
                    type="text"
                    value={editingCategory.icon}
                    onChange={(e) => setEditingCategory({ ...editingCategory, icon: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900 text-center"
                    placeholder="🥟"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Tagline</label>
                <input
                  type="text"
                  value={editingCategory.tag}
                  onChange={(e) => setEditingCategory({ ...editingCategory, tag: e.target.value })}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900"
                  placeholder="e.g. Freshly Fried & Crispy"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editingCategory.description}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900"
                  placeholder="e.g. Mini Packs, Munch Boxes, Samosas, Spring Rolls..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Badge (Optional)</label>
                  <input
                    type="text"
                    value={editingCategory.badge || ''}
                    onChange={(e) => setEditingCategory({ ...editingCategory, badge: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900"
                    placeholder="e.g. Signature"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Display Sort Order</label>
                  <input
                    type="number"
                    value={editingCategory.sortOrder}
                    onChange={(e) => setEditingCategory({ ...editingCategory, sortOrder: Number(e.target.value) })}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-2">Sales Channel Visibility</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingCategory.channels?.includes('website')}
                      onChange={(e) => {
                        const channels = editingCategory.channels || [];
                        const updated = e.target.checked
                          ? [...channels, 'website']
                          : channels.filter((c) => c !== 'website');
                        setEditingCategory({ ...editingCategory, channels: updated as any });
                      }}
                      className="rounded accent-[#4D080F]"
                    />
                    <span>Website Storefront</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingCategory.channels?.includes('pos')}
                      onChange={(e) => {
                        const channels = editingCategory.channels || [];
                        const updated = e.target.checked
                          ? [...channels, 'pos']
                          : channels.filter((c) => c !== 'pos');
                        setEditingCategory({ ...editingCategory, channels: updated as any });
                      }}
                      className="rounded accent-[#4D080F]"
                    />
                    <span>POS Terminal Registers</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#E5DEC9] bg-[#FAF7F2] flex justify-end gap-2">
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white border border-[#E5DEC9] text-xs font-bold text-stone-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategory}
                className="px-4 py-2 rounded-xl bg-[#4D080F] text-[#FFC700] text-xs font-bold"
              >
                Save Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT / PACKAGE / WHOLESALE / PROMOTION EDIT/CREATE MODAL */}
      {isProductModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5DEC9] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[#E5DEC9] bg-[#FAF7F2] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-[#4D080F] uppercase tracking-wider">
                  {editingProduct.id ? `Edit ${editingProduct.name}` : 'Create New Menu Product or Package'}
                </h3>
                <p className="text-[11px] text-stone-500">
                  Configure product type, multi-item package composition, promotional discounts, or bread wholesale tiers
                </p>
              </div>
              <button onClick={() => setIsProductModalOpen(false)} className="text-xs text-stone-500 hover:text-stone-900">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-stone-900">
              {/* 1. PRODUCT TYPE SELECTOR */}
              <div className="bg-[#FAF7F2] p-3.5 rounded-2xl border border-[#E5DEC9] space-y-2.5">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#4D080F]">
                  1. Product Commercial Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'standard', label: 'Standard Item', desc: 'Single menu or bakery SKU' },
                    { id: 'package', label: 'Package / Bundle', desc: 'e.g. 2000 Mini Pack' },
                    { id: 'combo', label: 'Meal Combo', desc: 'Main + Sides + Drink' },
                    { id: 'platter', label: 'Event Platter', desc: 'Sharing box / tray' },
                    { id: 'promotion', label: 'Promotion', desc: 'Conditional reward' },
                  ].map((pt) => {
                    const isSelected = (editingProduct.productType || 'standard') === pt.id;
                    return (
                      <button
                        key={pt.id}
                        type="button"
                        onClick={() =>
                          setEditingProduct({
                            ...editingProduct,
                            productType: pt.id as any,
                            components:
                              (pt.id === 'package' || pt.id === 'combo' || pt.id === 'platter') &&
                              (!editingProduct.components || editingProduct.components.length === 0)
                                ? []
                                : editingProduct.components,
                          })
                        }
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-[#4D080F] text-[#FFC700] border-[#4D080F] shadow-xs'
                            : 'bg-white text-stone-800 border-[#E5DEC9] hover:bg-stone-50'
                        }`}
                      >
                        <div className="font-extrabold text-xs">{pt.label}</div>
                        <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-amber-200' : 'text-stone-500'}`}>
                          {pt.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. CORE PRODUCT DETAILS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Product / Package Name</label>
                  <input
                    type="text"
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    placeholder="e.g. 2000 Mini Pack"
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#4D080F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Category</label>
                  <select
                    value={editingProduct.category}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#4D080F]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    Selling Price (₦)
                  </label>
                  <input
                    type="number"
                    value={editingProduct.basePrice}
                    onChange={(e) => setEditingProduct({ ...editingProduct, basePrice: Number(e.target.value) })}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Prep Time (Mins)</label>
                  <input
                    type="number"
                    value={editingProduct.prepTimeMinutes}
                    onChange={(e) => setEditingProduct({ ...editingProduct, prepTimeMinutes: Number(e.target.value) })}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Publication Status</label>
                  <select
                    value={editingProduct.status}
                    onChange={(e) => setEditingProduct({ ...editingProduct, status: e.target.value as any })}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900"
                  >
                    <option value="published">Published (Live)</option>
                    <option value="draft">Draft (Hidden from Live POS/Web)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* 3. PACKAGE / COMBO / PLATTER COMPONENT BUILDER */}
              {(editingProduct.productType === 'package' ||
                editingProduct.productType === 'combo' ||
                editingProduct.productType === 'platter') && (
                <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-black uppercase text-purple-950 flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-purple-700" />
                        Package / Combo Component Composition Builder
                        {editingProduct.compositionVersion && (
                          <span className="px-2 py-0.5 rounded bg-purple-200 text-purple-900 text-[10px]">
                            Version v{editingProduct.compositionVersion}
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-purple-800">
                        Select existing products from any category and specify the exact quantity included per package sold.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLoad2000MiniPackPreset}
                      className="px-3 py-1.5 rounded-xl bg-purple-800 hover:bg-purple-900 text-[#FFC700] text-[11px] font-bold shadow-2xs"
                    >
                      Load 2000 Mini Pack Preset (3 Puff Puff, 1 Samosa, 1 Spring Roll, 1 Beef)
                    </button>
                  </div>

                  {/* Add Component Selector Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white p-3 rounded-xl border border-purple-200">
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                        Filter Catalogue Items
                      </label>
                      <input
                        type="text"
                        value={componentSearch}
                        onChange={(e) => setComponentSearch(e.target.value)}
                        placeholder="Search Puff Puff, Samosa, Bread, Drink..."
                        className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                        Component Product ({availableComponentCandidates.length} available)
                      </label>
                      <select
                        value={selectedComponentProductId || availableComponentCandidates[0]?.id || ''}
                        onChange={(e) => setSelectedComponentProductId(e.target.value)}
                        className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                      >
                        {availableComponentCandidates.map((cand) => (
                          <option key={cand.id} value={cand.id}>
                            {cand.name} ({cand.category}) — ₦{cand.basePrice.toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Qty</label>
                      <input
                        type="number"
                        min={1}
                        value={selectedComponentQty}
                        onChange={(e) => setSelectedComponentQty(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-center"
                      />
                    </div>
                    <div className="sm:col-span-2 flex items-end">
                      <button
                        type="button"
                        onClick={handleAddComponentToPackage}
                        className="w-full py-1.5 px-3 rounded-lg bg-[#4D080F] hover:bg-[#660b14] text-[#FFC700] text-xs font-bold flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                  </div>

                  {/* Configured Components Table */}
                  {Array.isArray(editingProduct.components) && editingProduct.components.length > 0 ? (
                    <div className="bg-white rounded-xl border border-purple-200 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-purple-100/60 text-purple-950 text-[10px] uppercase font-bold">
                          <tr>
                            <th className="py-2 px-3">Component Product</th>
                            <th className="py-2 px-3 text-center">Qty per Pack</th>
                            <th className="py-2 px-3 text-right">Standalone Price</th>
                            <th className="py-2 px-3 text-right">Component Value</th>
                            <th className="py-2 px-3 text-right">Remove</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-100">
                          {editingProduct.components.map((comp, idx) => {
                            const refProd = products.find((p) => p.id === comp.productId);
                            const unitPrice = comp.unitPrice ?? refProd?.basePrice ?? 0;
                            const lineVal = unitPrice * comp.quantity;
                            return (
                              <tr key={comp.productId + idx}>
                                <td className="py-2 px-3">
                                  <span className="font-bold text-stone-900 block">
                                    {comp.productName || refProd?.name || comp.productId}
                                  </span>
                                  <span className="text-[10px] font-mono text-stone-500">{comp.productId}</span>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <input
                                    type="number"
                                    min={1}
                                    value={comp.quantity}
                                    onChange={(e) => {
                                      const nextQty = Math.max(1, Number(e.target.value) || 1);
                                      const updated = [...(editingProduct.components || [])];
                                      updated[idx] = { ...updated[idx], quantity: nextQty };
                                      setEditingProduct({ ...editingProduct, components: updated });
                                    }}
                                    className="w-16 bg-[#FAF7F2] border border-[#E5DEC9] rounded px-2 py-1 text-xs font-mono font-bold text-center"
                                  />
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-stone-600">
                                  ₦{unitPrice.toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-purple-900">
                                  ₦{lineVal.toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = (editingProduct.components || []).filter((_, i) => i !== idx);
                                      setEditingProduct({ ...editingProduct, components: updated });
                                    }}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="p-2.5 bg-purple-50 border-t border-purple-200 flex flex-wrap items-center justify-between text-xs">
                        <span className="font-semibold text-purple-900">
                          Total Components per Package:{' '}
                          <strong>
                            {editingProduct.components.reduce((s, c) => s + Number(c.quantity || 0), 0)} units
                          </strong>
                        </span>
                        <span className="font-mono font-bold text-purple-950">
                          Standalone Sum: ₦
                          {editingProduct.components
                            .reduce((s, c) => {
                              const rp = products.find((p) => p.id === c.productId);
                              return s + (c.unitPrice ?? rp?.basePrice ?? 0) * c.quantity;
                            }, 0)
                            .toLocaleString()}{' '}
                          | Package Price: ₦{Number(editingProduct.basePrice || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-white border border-dashed border-purple-300 text-center text-purple-800 text-xs">
                      No components added yet. Use the selector above or click &ldquo;Load 2000 Mini Pack Preset&rdquo;.
                    </div>
                  )}
                </div>
              )}

              {/* 4. PACKAGE & ITEM DISCOUNT CONFIGURATION */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-emerald-700" />
                    <div>
                      <h4 className="text-xs font-black uppercase text-emerald-950">
                        Promotional / Package Discount Configuration
                      </h4>
                      <p className="text-[11px] text-emerald-800">
                        Apply a percentage or fixed Naira discount while preserving full component stock deduction
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-emerald-900">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct.discountConfig?.enabled)}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          discountConfig: {
                            type: editingProduct.discountConfig?.type || 'percentage',
                            value: editingProduct.discountConfig?.value || 10,
                            reason: editingProduct.discountConfig?.reason || 'Package Promo',
                            ...(editingProduct.discountConfig || {}),
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="rounded accent-emerald-700"
                    />
                    <span>Enable Discount</span>
                  </label>
                </div>

                {editingProduct.discountConfig?.enabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-emerald-200">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Discount Type</label>
                      <select
                        value={editingProduct.discountConfig.type}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            discountConfig: {
                              ...editingProduct.discountConfig!,
                              type: e.target.value as 'percentage' | 'fixed',
                            },
                          })
                        }
                        className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount (₦)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                        Discount Value ({editingProduct.discountConfig.type === 'percentage' ? '%' : '₦'})
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={editingProduct.discountConfig.value}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            discountConfig: {
                              ...editingProduct.discountConfig!,
                              value: Math.max(0, Number(e.target.value) || 0),
                            },
                          })
                        }
                        className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Promo Label</label>
                      <input
                        type="text"
                        value={editingProduct.discountConfig.reason || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            discountConfig: {
                              ...editingProduct.discountConfig!,
                              reason: e.target.value,
                            },
                          })
                        }
                        placeholder="e.g. Weekend Mini Pack Promo"
                        className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="flex flex-col justify-center bg-emerald-50 rounded-lg px-3 py-1.5 border border-emerald-200">
                      <span className="text-[10px] font-bold uppercase text-emerald-700">Effective Price</span>
                      <span className="font-mono font-black text-sm text-emerald-900">
                        ₦
                        {Math.max(
                          0,
                          editingProduct.discountConfig.type === 'percentage'
                            ? editingProduct.basePrice -
                                Math.round((editingProduct.basePrice * editingProduct.discountConfig.value) / 100)
                            : editingProduct.basePrice - editingProduct.discountConfig.value
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. BREAD & BULK WHOLESALE PRICING CONFIGURATION */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-amber-800" />
                    <div>
                      <h4 className="text-xs font-black uppercase text-amber-950">
                        Bread &amp; Bulk Wholesale Tiered Pricing
                      </h4>
                      <p className="text-[11px] text-amber-800">
                        Automatically apply discounted wholesale unit prices when order quantity meets or exceeds the threshold
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-950">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct.wholesalePricing?.enabled)}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          wholesalePricing: {
                            retailPrice: editingProduct.basePrice || 500,
                            wholesalePrice:
                              editingProduct.wholesalePricing?.wholesalePrice ||
                              Math.round((editingProduct.basePrice || 500) * 0.8),
                            minWholesaleQty: editingProduct.wholesalePricing?.minWholesaleQty || 20,
                            allowSkuPooling: editingProduct.wholesalePricing?.allowSkuPooling ?? true,
                            preventExtraDiscountOnWholesale:
                              editingProduct.wholesalePricing?.preventExtraDiscountOnWholesale ?? true,
                            ...(editingProduct.wholesalePricing || {}),
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="rounded accent-amber-800"
                    />
                    <span>Enable Wholesale Pricing</span>
                  </label>
                </div>

                {editingProduct.wholesalePricing?.enabled && (
                  <div className="space-y-3 bg-white p-3 rounded-xl border border-amber-200">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                          Retail Unit Price (₦)
                        </label>
                        <input
                          type="number"
                          value={editingProduct.basePrice}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setEditingProduct({
                              ...editingProduct,
                              basePrice: val,
                              wholesalePricing: {
                                ...editingProduct.wholesalePricing!,
                                retailPrice: val,
                              },
                            });
                          }}
                          className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                          Minimum Wholesale Qty (Loaves/Units)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={editingProduct.wholesalePricing.minWholesaleQty}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              wholesalePricing: {
                                ...editingProduct.wholesalePricing!,
                                minWholesaleQty: Math.max(1, Number(e.target.value) || 1),
                              },
                            })
                          }
                          className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                          Wholesale Unit Price (₦)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={editingProduct.wholesalePricing.wholesalePrice}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              wholesalePricing: {
                                ...editingProduct.wholesalePricing!,
                                wholesalePrice: Math.max(0, Number(e.target.value) || 0),
                              },
                            })
                          }
                          className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-amber-900"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={editingProduct.wholesalePricing.allowSkuPooling !== false}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              wholesalePricing: {
                                ...editingProduct.wholesalePricing!,
                                allowSkuPooling: e.target.checked,
                              },
                            })
                          }
                          className="rounded accent-amber-800"
                        />
                        <span>Allow pooling quantities across eligible Bread SKUs</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={editingProduct.wholesalePricing.preventExtraDiscountOnWholesale !== false}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              wholesalePricing: {
                                ...editingProduct.wholesalePricing!,
                                preventExtraDiscountOnWholesale: e.target.checked,
                              },
                            })
                          }
                          className="rounded accent-amber-800"
                        />
                        <span>Prevent stacking item discounts on top of wholesale tier</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. CONDITIONAL FREE-ITEM PROMOTION RULE BUILDER */}
              {(editingProduct.productType === 'promotion' || editingProduct.promotionRules?.isActive) && (
                <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-rose-700" />
                      <div>
                        <h4 className="text-xs font-black uppercase text-rose-950">
                          Conditional Free-Item Promotion Rule
                        </h4>
                        <p className="text-[11px] text-rose-800">
                          Automatically grant a free reward product (at ₦0 revenue, with full stock deduction) when qualifying items are ordered
                        </p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-rose-900">
                      <input
                        type="checkbox"
                        checked={Boolean(editingProduct.promotionRules?.isActive)}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            promotionRules: {
                              qualifyingProductIds: editingProduct.promotionRules?.qualifyingProductIds || ['prod-sc-2000-mini'],
                              minimumQuantity: editingProduct.promotionRules?.minimumQuantity || 2,
                              freeRewardProductId:
                                editingProduct.promotionRules?.freeRewardProductId || 'prod-snack-puff-puff-single',
                              freeRewardQuantity: editingProduct.promotionRules?.freeRewardQuantity || 1,
                              maxRewardsPerOrder: editingProduct.promotionRules?.maxRewardsPerOrder || 1,
                              ...(editingProduct.promotionRules || {}),
                              isActive: e.target.checked,
                            },
                          })
                        }
                        className="rounded accent-rose-700"
                      />
                      <span>Active Promotion Rule</span>
                    </label>
                  </div>

                  {editingProduct.promotionRules?.isActive && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-rose-200">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                          Qualifying Product
                        </label>
                        <select
                          value={editingProduct.promotionRules.qualifyingProductIds?.[0] || ''}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              promotionRules: {
                                ...editingProduct.promotionRules!,
                                qualifyingProductIds: e.target.value ? [e.target.value] : [],
                              },
                            })
                          }
                          className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                        >
                          <option value="">Any Qualifying Spend / Category</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (₦{p.basePrice})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                          Min Qualifying Qty
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={editingProduct.promotionRules.minimumQuantity || 1}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              promotionRules: {
                                ...editingProduct.promotionRules!,
                                minimumQuantity: Math.max(1, Number(e.target.value) || 1),
                              },
                            })
                          }
                          className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                          Min Spend (₦ Optional)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={editingProduct.promotionRules.minimumSpend || 0}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              promotionRules: {
                                ...editingProduct.promotionRules!,
                                minimumSpend: Math.max(0, Number(e.target.value) || 0),
                              },
                            })
                          }
                          className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                          Free Reward Product (₦0 Price, Stock Deducted)
                        </label>
                        <select
                          value={editingProduct.promotionRules.freeRewardProductId || ''}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              promotionRules: {
                                ...editingProduct.promotionRules!,
                                freeRewardProductId: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                        >
                          <option value="">Select Free Reward Product...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Normal ₦{p.basePrice})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                          Free Reward Qty
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={editingProduct.promotionRules.freeRewardQuantity || 1}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              promotionRules: {
                                ...editingProduct.promotionRules!,
                                freeRewardQuantity: Math.max(1, Number(e.target.value) || 1),
                              },
                            })
                          }
                          className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                          Max Rewards / Order
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={editingProduct.promotionRules.maxRewardsPerOrder || 1}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              promotionRules: {
                                ...editingProduct.promotionRules!,
                                maxRewardsPerOrder: Math.max(1, Number(e.target.value) || 1),
                              },
                            })
                          }
                          className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 7. IMAGE & DESCRIPTIONS */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-stone-600">
                  Product Image (Upload File or Paste URL)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={editingProduct.image}
                    onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })}
                    placeholder="https://... or /uploads/... (leave blank for non-food packaging)"
                    className="flex-1 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900"
                  />
                  <label className="px-3 py-2 rounded-xl bg-[#FAF7F2] hover:bg-stone-100 border border-[#E5DEC9] text-[#4D080F] text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 shrink-0">
                    <span>{isUploadingImage ? 'Uploading...' : 'Upload JPEG/PNG/WebP'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={isUploadingImage}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleProductImageUpload(file);
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Short Description</label>
                  <input
                    type="text"
                    value={editingProduct.shortDescription}
                    onChange={(e) => setEditingProduct({ ...editingProduct, shortDescription: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Long Description / Notes</label>
                  <input
                    type="text"
                    value={editingProduct.longDescription}
                    onChange={(e) => setEditingProduct({ ...editingProduct, longDescription: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 py-2 text-xs text-stone-900"
                  />
                </div>
              </div>

              {/* Branch Specific Price Overrides */}
              <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E5DEC9] space-y-2">
                <span className="font-bold text-xs text-[#4D080F] block">Branch Price Overrides (Optional)</span>
                <div className="grid grid-cols-3 gap-2">
                  {['gra', 'okabere', 'ugbowo'].map((bId) => (
                    <div key={bId}>
                      <label className="block text-[10px] text-stone-500 uppercase font-bold">{bId}</label>
                      <input
                        type="number"
                        placeholder={`Base (₦${editingProduct.basePrice})`}
                        value={editingProduct.branchPrices?.[bId] || ''}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : undefined;
                          const updated = { ...editingProduct.branchPrices };
                          if (val) updated[bId] = val;
                          else delete updated[bId];
                          setEditingProduct({ ...editingProduct, branchPrices: updated });
                        }}
                        className="w-full bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1 text-xs text-stone-900 font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Badges & Channels */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct.isPopular)}
                      onChange={(e) => setEditingProduct({ ...editingProduct, isPopular: e.target.checked })}
                      className="rounded accent-[#4D080F]"
                    />
                    <span>Popular / Top Rated</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct.isFeatured)}
                      onChange={(e) => setEditingProduct({ ...editingProduct, isFeatured: e.target.checked })}
                      className="rounded accent-[#4D080F]"
                    />
                    <span>Featured Hero Deal</span>
                  </label>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingProduct.channels?.includes('website')}
                      onChange={(e) => {
                        const channels = editingProduct.channels || [];
                        const updated = e.target.checked
                          ? [...channels, 'website']
                          : channels.filter((c) => c !== 'website');
                        setEditingProduct({ ...editingProduct, channels: updated as any });
                      }}
                      className="rounded accent-[#4D080F]"
                    />
                    <span>Website Storefront</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingProduct.channels?.includes('pos')}
                      onChange={(e) => {
                        const channels = editingProduct.channels || [];
                        const updated = e.target.checked
                          ? [...channels, 'pos']
                          : channels.filter((c) => c !== 'pos');
                        setEditingProduct({ ...editingProduct, channels: updated as any });
                      }}
                      className="rounded accent-[#4D080F]"
                    />
                    <span>POS Registers</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#E5DEC9] bg-[#FAF7F2] flex justify-end gap-2">
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white border border-[#E5DEC9] text-xs font-bold text-stone-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProduct}
                className="px-5 py-2 rounded-xl bg-[#4D080F] hover:bg-[#660b14] text-[#FFC700] text-xs font-black shadow-xs"
              >
                Save to Catalogue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Excel / CSV Import Modal */}
      <ExcelBulkImportAndMigrationModal
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        defaultTab="menu_import"
        onSuccessRefresh={fetchData}
        showToast={(msg, type) => setFeedback({ type: type || 'success', message: msg })}
      />
    </div>
  );
};
