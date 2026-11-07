import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { Product } from '../../types';
import { evaluateBranchOperatingStatus } from '../../utils/branchScheduling';
import {
  X,
  Send,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Wheat,
  MapPin,
  CheckCircle2,
  Utensils,
  ArrowRight,
  Headphones,
  Package,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  recommendedProducts?: Product[];
  suggestedAction?: {
    type:
      | 'open_cart'
      | 'open_checkout'
      | 'open_builder'
      | 'open_catering'
      | 'open_locations'
      | 'open_support'
      | 'view_category'
      | 'whatsapp';
    label: string;
    payload?: string;
  };
}

export const AiChatbotModal: React.FC = () => {
  const {
    isAiChatbotOpen,
    setIsAiChatbotOpen,
    products,
    branches,
    selectedBranchId,
    currentBranch,
    cart,
    cartCount,
    cartSubtotal,
    cartPackagingFee,
    cartTotal,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    setIsCartOpen,
    setIsCheckoutOpen,
    setIsCateringModalOpen,
    setIsLocationsModalOpen,
    setIsSmallChopsBuilderOpen,
    getBranchWhatsAppUrl,
    setActiveCategory,
    getProductPrice,
    isProductAvailable,
    formatNaira,
    orders,
  } = useApp();
  const { t } = useLanguage();

  const [inputMessage, setInputMessage] = useState('');
  const [addedProductIds, setAddedProductIds] = useState<Record<string, boolean>>({});
  const [chatQuantities, setChatQuantities] = useState<Record<string, number>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'bot',
      text: `👋 Hello! I am **Chop Paddy**, your intelligent ordering assistant at **${currentBranch.name}**.\n\nI can search active approved menu items, compare options, add/update/remove items in your cart, explain **Pack 400** food packaging rules, initiate checkout, check your live backend-verified order status, or connect you with our human team. How can I help you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isAiChatbotOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAiChatbotOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAiChatbotOpen, setIsAiChatbotOpen]);

  // Strict active product filter: never expose paused/inactive/archived products
  const activeProducts = useMemo(() => {
    return products.filter(
      (p) =>
        (!p.status || p.status === 'published') &&
        (p as any).isActive !== false &&
        p.category !== 'packaging' &&
        p.id !== 'prod-sc-box-custom' &&
        isProductAvailable(p.id, selectedBranchId)
    );
  }, [products, selectedBranchId, isProductAvailable]);

  const pausedProducts = useMemo(() => {
    return products.filter(
      (p) => p.status === 'paused' || p.status === 'draft' || (p as any).isActive === false
    );
  }, [products]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isAiChatbotOpen) {
      scrollToBottom();
    }
  }, [messages, isAiChatbotOpen]);

  if (!isAiChatbotOpen) {
    const bottomClass =
      cartCount > 0
        ? 'bottom-[calc(7.25rem+env(safe-area-inset-bottom,0px))] md:bottom-6'
        : 'bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-6';

    return (
      <button
        onClick={() => setIsAiChatbotOpen(true)}
        className={`fixed ${bottomClass} right-2 sm:right-6 z-40 bg-[#4D080F] hover:bg-[#38050a] text-white p-2 sm:px-4 sm:py-3 rounded-full shadow-2xl border-2 border-[#FFC700] flex items-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 group`}
        id="open-chop-paddy-btn"
        title="Chat with Chop Paddy"
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-[#E62E00] flex items-center justify-center text-lg">
            🧑🏽‍🍳
          </div>
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#FFC700] rounded-full border-2 border-[#4D080F] animate-ping" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#FFC700] rounded-full border-2 border-[#4D080F]" />
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-[11px] font-titan uppercase tracking-wide text-[#FFC700] leading-none">
            Chop Paddy
          </p>
          <p className="text-[10px] text-white/90 font-montserrat leading-tight">
            Ask questions & order
          </p>
        </div>
      </button>
    );
  }

  const findActiveProduct = (id: string): Product | undefined => {
    return activeProducts.find((p) => p.id === id);
  };

  const getChatQty = (productId: string) => {
    const val = chatQuantities[productId];
    return typeof val === 'number' && val >= 1 ? val : 1;
  };

  const setChatQty = (productId: string, next: number) => {
    const clamped = Math.max(1, Math.min(500, Number.isNaN(next) ? 1 : next));
    setChatQuantities((prev) => ({ ...prev, [productId]: clamped }));
  };

  const generateBotReply = async (userPrompt: string) => {
    setIsTyping(true);
    const lower = userPrompt.toLowerCase().trim();
    let replyText = '';
    let recommended: Product[] = [];
    let action: ChatMessage['suggestedAction'] = undefined;

    try {
      // 0. Check if user is asking about unapproved cocktail beverages
      if (/ch[a]pman/i.test(lower)) {
        replyText = `🚫 **Choplife Republic does not sell that beverage.**\n\nInstead, we serve fresh approved refreshments including **Zobo (₦1,000)**, **Chivita Active (₦2,500)**, **Chi Exotic (₦2,500)**, **Malt (₦800)**, and chilled soft drinks.`;
        recommended = [
          findActiveProduct('prod-drink-zobo'),
          findActiveProduct('prod-drink-chivita-active'),
          findActiveProduct('prod-drink-malt'),
        ].filter(Boolean) as Product[];
        action = {
          type: 'view_category',
          label: 'View Approved Drinks 🥤',
          payload: 'drinks',
        };
      }
      // 1. Live Order Status Verification from Backend (/api/orders)
      else if (
        lower.includes('order status') ||
        lower.includes('track') ||
        lower.includes('where is my order') ||
        /ord[-_a-z0-9]+/i.test(userPrompt)
      ) {
        const orderIdMatch = userPrompt.match(/(ord[-_a-z0-9]+|#[a-z0-9-]+)/i);
        let liveOrders = orders;
        try {
          const res = await fetch('/api/orders');
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) liveOrders = data;
          }
        } catch {
          // fallback to context orders
        }

        const targetOrder = orderIdMatch
          ? liveOrders.find(
              (o: any) =>
                String(o.id || '').toLowerCase().includes(orderIdMatch[1].replace('#', '').toLowerCase()) ||
                String(o.orderNumber || '').toLowerCase().includes(orderIdMatch[1].replace('#', '').toLowerCase())
            )
          : liveOrders[0];

        if (targetOrder) {
          const verifiedPaid = targetOrder.paymentStatus === 'paid';
          replyText = `📦 **Live Backend Order Status (${targetOrder.orderNumber || targetOrder.id})**:\n• **Fulfilment Status**: ${String(targetOrder.orderStatus || 'received').toUpperCase()}\n• **Payment Verification**: ${
            verifiedPaid
              ? '✅ PAID & BACKEND-VERIFIED'
              : '⏳ UNPAID / AWAITING BACKEND PAYMENT VERIFICATION (Kitchen prep & KDS dispatch require verified payment)'
          }\n• **Branch**: ${targetOrder.branchId?.toUpperCase() || currentBranch.shortName}\n• **Total**: ${formatNaira(Number(targetOrder.total || 0))}`;
        } else {
          replyText = `🔍 No active order was found matching your query in our live database. If you just placed an order, please share your Order ID or contact our Customer Care team.`;
          action = {
            type: 'open_support',
            label: 'Open Customer Care & Support Desk 🎧',
          };
        }
      }
      // 2. Natural-language Cart Add command: e.g. "add 2 jollof rice"
      else if (lower.startsWith('add ') || lower.startsWith('order ') || lower.startsWith('buy ')) {
        const qtyMatch = lower.match(/(?:add|order|buy)\s+(\d+)\s+(.+)/i);
        const requestedQty = qtyMatch ? Math.max(1, Math.min(500, parseInt(qtyMatch[1], 10))) : 1;
        const searchTerm = (qtyMatch ? qtyMatch[2] : lower.replace(/^(add|order|buy)\s+/i, '')).trim();

        // Check if user tried to add a paused package
        const pausedMatch = pausedProducts.find(
          (p) => p.name.toLowerCase() === searchTerm || p.name.toLowerCase().includes(searchTerm)
        );
        const activeMatch = activeProducts.find(
          (p) =>
            p.name.toLowerCase() === searchTerm ||
            p.name.toLowerCase().includes(searchTerm)
        );

        const branchStatus = evaluateBranchOperatingStatus(selectedBranchId);
        if (!branchStatus.isOpen) {
          replyText = `⚠️ **${currentBranch.shortName} is currently closed for customer orders.**\n\n${branchStatus.reason}\n${branchStatus.nextOpenNotice || ''}\n\nOur kitchen cannot fulfill orders while the branch is closed. You can view opening hours or chat with us on WhatsApp for advance booking!`;
          action = {
            type: 'open_locations',
            label: 'Check Branch Hours & Locations 🕒',
          };
        } else if (activeMatch) {
          addToCart(activeMatch, requestedQty);
          const unitPrice = getProductPrice(activeMatch, selectedBranchId);
          replyText = `✅ Added **${requestedQty}x ${activeMatch.name}** (@ ${formatNaira(unitPrice)} each = **${formatNaira(unitPrice * requestedQty)}**) to your cart!\n\nWould you like to review your cart or proceed to checkout?`;
          recommended = [activeMatch];
          action = {
            type: 'open_checkout',
            label: 'Proceed to Checkout 💳',
          };
        } else if (pausedMatch) {
          replyText = `⏸️ **${pausedMatch.name}** is currently **inactive/paused** in our menu catalogue and cannot be ordered right now.\n\nHere are active approved alternatives you can add immediately:`;
          recommended = [
            findActiveProduct('prod-sc-2000-mini'),
            findActiveProduct('prod-sc-2500-mini'),
            findActiveProduct('prod-sc-3700-mini'),
            findActiveProduct('prod-sc-4200-mini'),
          ].filter(Boolean) as Product[];
          action = {
            type: 'open_builder',
            label: 'Build a Custom Small Chops Box 🥟',
          };
        } else {
          replyText = `I couldn't find an exact active menu match for "${searchTerm}". Here are our top active menu items you can add with 1 click:`;
          recommended = activeProducts.slice(0, 4);
        }
      }
      // 3. Natural-language Cart Remove / Clear command
      else if (lower.startsWith('remove ') || lower.includes('clear cart') || lower.includes('empty cart')) {
        if (lower.includes('clear cart') || lower.includes('empty cart')) {
          clearCart();
          replyText = `🗑️ Your cart has been cleared.`;
        } else {
          const targetTerm = lower.replace(/^remove\s+/i, '').trim();
          const cartMatch = cart.find((c) => c.product.name.toLowerCase().includes(targetTerm));
          if (cartMatch) {
            removeFromCart(cartMatch.id);
            replyText = `🗑️ Removed **${cartMatch.product.name}** from your cart.`;
          } else {
            replyText = `I couldn't find "${targetTerm}" in your current cart.`;
          }
        }
      }
      // 4. Packaging Rules & Cart / Checkout Summary
      else if (
        lower.includes('packaging') ||
        lower.includes('pack 400') ||
        lower.includes('cart') ||
        lower.includes('checkout')
      ) {
        replyText = `📦 **Choplife Republic Packaging Rule**:\n• Cooked QSR food items require **Pack 400 (₦400)** per up to **4 food portions**.\n• **Exemptions**: Snacks, Shawarma, Drinks, and Bakery Bread do **not** incur Pack 400 charges.\n• **No Double-Charging**: Packages that already include their own pack/tray in their price are never charged twice.\n\n🛒 **Your Current Cart (${cartCount} items)**:\n• Items Subtotal: **${formatNaira(cartSubtotal)}**\n• Packaging Fee: **${formatNaira(cartPackagingFee)}**\n• Current Total (excl. delivery): **${formatNaira(cartTotal)}**`;
        action =
          cart.length > 0
            ? {
                type: 'open_checkout',
                label: `Proceed to Checkout (${formatNaira(cartTotal)}) 💳`,
              }
            : {
                type: 'open_cart',
                label: 'Open Cart Drawer 🛒',
              };
      }
      // 5. Check if user specifically asked about a paused ACHIVED (2).pdf package
      else if (
        pausedProducts.some(
          (p) =>
            lower.includes(p.name.toLowerCase()) &&
            p.name.length > 3
        )
      ) {
        const matchedPaused = pausedProducts.find(
          (p) => lower.includes(p.name.toLowerCase()) && p.name.length > 3
        )!;
        replyText = `⏸️ **${matchedPaused.name}** is currently set to **inactive (paused)** in our catalogue and is unavailable for ordering unless reactivated by an authorised Super Admin.\n\nHere are our **active Mini Packs** and custom options available right now:`;
        recommended = [
          findActiveProduct('prod-sc-1000-mini'),
          findActiveProduct('prod-sc-1500-mini'),
          findActiveProduct('prod-sc-2000-mini'),
          findActiveProduct('prod-sc-2500-mini'),
          findActiveProduct('prod-sc-3700-mini'),
          findActiveProduct('prod-sc-4200-mini'),
        ].filter(Boolean) as Product[];
        action = {
          type: 'open_builder',
          label: 'Open Small Chops Builder 🥟',
        };
      }
      // 6. Bakery / Bread Queries
      else if (
        lower.includes('bread') ||
        lower.includes('bakery') ||
        lower.includes('bromate') ||
        lower.includes('loaf') ||
        lower.includes('jumbo') ||
        lower.includes('wholesale')
      ) {
        replyText = `🍞 **Choplife Bakery** produces 100% bromate-free and saccharine-free bread baked fresh daily:\n• Small Bread: ₦500\n• Special Bread: ₦1,200\n• Family Bread: ₦1,700\n• Jumbo Bread: ₦2,000\n• Sardine Bread: ₦2,000`;
        recommended = activeProducts.filter((p) => p.category === 'bakery').slice(0, 4);
        action = {
          type: 'view_category',
          label: 'View Full Bakery Catalogue 🥖',
          payload: 'bakery',
        };
      }
      // 7. Small Chops & Mini Packs Queries
      else if (
        lower.includes('small chop') ||
        lower.includes('samosa') ||
        lower.includes('spring roll') ||
        lower.includes('puff') ||
        lower.includes('mini pack') ||
        lower.includes('platter') ||
        lower.includes('party')
      ) {
        replyText = `🥟 Here are our **active approved Small Chops Mini Packs** available for immediate ordering (plus you can build your own custom piece assortment):`;
        recommended = [
          findActiveProduct('prod-sc-1000-mini'),
          findActiveProduct('prod-sc-1500-mini'),
          findActiveProduct('prod-sc-2000-mini'),
          findActiveProduct('prod-sc-2500-mini'),
          findActiveProduct('prod-sc-3700-mini'),
          findActiveProduct('prod-sc-4200-mini'),
        ].filter(Boolean) as Product[];
        action = {
          type: 'open_builder',
          label: 'Launch Small Chops Builder 🥟',
        };
      }
      // 8. Rice & Main Meals / QSR / Soups
      else if (
        lower.includes('rice') ||
        lower.includes('jollof') ||
        lower.includes('fried rice') ||
        lower.includes('native') ||
        lower.includes('banga') ||
        lower.includes('black soup') ||
        lower.includes('soup') ||
        lower.includes('yam') ||
        lower.includes('food')
      ) {
        replyText = `🍲 Here are our active approved Kitchen Meals & Soups (Cooked food portions use **Pack 400** @ ₦400 per 4 portions):`;
        recommended = [
          findActiveProduct('prod-qsr-jollof-rice'),
          findActiveProduct('prod-qsr-fried-rice'),
          findActiveProduct('prod-qsr-native-rice'),
          findActiveProduct('prod-qsr-banga-soup'),
          findActiveProduct('prod-qsr-black-soup'),
        ].filter(Boolean) as Product[];
        action = {
          type: 'view_category',
          label: 'View All Food & Soups 🍲',
          payload: 'food',
        };
      }
      // 9. Shawarma, Meat & Grills
      else if (
        lower.includes('shawarma') ||
        lower.includes('wrap') ||
        lower.includes('grill') ||
        lower.includes('turkey') ||
        lower.includes('fish') ||
        lower.includes('chicken') ||
        lower.includes('beef') ||
        lower.includes('pie')
      ) {
        replyText = `🍗 Here are our active approved Shawarmas, Pastries, and Grills:`;
        recommended = [
          findActiveProduct('prod-snack-shawarma-chicken-reg'),
          findActiveProduct('prod-snack-shawarma-jumbo'),
          findActiveProduct('prod-protein-chicken-big'),
          findActiveProduct('prod-protein-turkey'),
        ].filter(Boolean) as Product[];
        action = {
          type: 'view_category',
          label: 'View Snacks & Grills 🌯',
          payload: 'snacks',
        };
      }
      // 10. Drinks & Refreshments
      else if (
        lower.includes('drink') ||
        lower.includes('coke') ||
        lower.includes('fanta') ||
        lower.includes('sprite') ||
        lower.includes('zobo') ||
        lower.includes('water') ||
        lower.includes('malt') ||
        lower.includes('juice')
      ) {
        replyText = `🥤 Here are our active approved Chilled Drinks & Juices:`;
        recommended = [
          findActiveProduct('prod-drink-zobo'),
          findActiveProduct('prod-drink-malt'),
          findActiveProduct('prod-drink-coke-big'),
          findActiveProduct('prod-drink-chivita-active'),
        ].filter(Boolean) as Product[];
        action = {
          type: 'view_category',
          label: 'View Drinks Menu 🥤',
          payload: 'drinks',
        };
      }
      // 11. Branch Locations & Hours
      else if (
        lower.includes('location') ||
        lower.includes('branch') ||
        lower.includes('where') ||
        lower.includes('address') ||
        lower.includes('hours') ||
        lower.includes('open') ||
        lower.includes('schedule')
      ) {
        const branchListText = branches
          .map((b, idx) => {
            const bStatus = evaluateBranchOperatingStatus(b.id);
            const liveBadge = bStatus.isOpen ? '🟢 OPEN FOR ORDERS' : `🔴 CLOSED (${bStatus.nextOpenNotice || 'Closed'})`;
            const staffSchedule = b.staffHours ? `\n• Staff Shift: ${b.staffHours}` : '';
            const bakerySchedule = b.bakeryHours ? `\n• Fresh Bakery: ${b.bakeryHours}` : '';
            return `${idx + 1}. **${b.name}** [${liveBadge}]\n• Public Ordering Hours: ${b.openingHours}${staffSchedule}${bakerySchedule}\n• Address: ${b.address}\n• Phone: ${b.phone}`;
          })
          .join('\n\n');
        replyText = `📍 **Choplife Republic Branches & Operational Schedules (WAT UTC+1)**:\n\n${branchListText}`;
        action = {
          type: 'open_locations',
          label: 'View Interactive Branch Map & Details 📍',
        };
      }
      // 12. Human Staff Escalation / Support / Complaint
      else if (
        lower.includes('human') ||
        lower.includes('staff') ||
        lower.includes('agent') ||
        lower.includes('escalate') ||
        lower.includes('whatsapp') ||
        lower.includes('call') ||
        lower.includes('support') ||
        lower.includes('help') ||
        lower.includes('complaint')
      ) {
        replyText = `👩🏾‍💼 **Human Staff Escalation**:\n\nYou can speak directly with our branch operations team at **${currentBranch.name}** (${currentBranch.phone}) via WhatsApp or open a ticket on our Customer Care Desk.`;
        action = {
          type: 'whatsapp',
          label: `Escalate to ${currentBranch.shortName} Staff on WhatsApp 💬`,
        };
      }
      // 12.5 Approved Combos & Party Platters
      else if (
        lower.includes('combo') ||
        lower.includes('deals') ||
        lower.includes('platter') ||
        lower.includes('party pack')
      ) {
        replyText = `🔥 **Approved Combos & Party Platters**:\nAuthentic Choplife combos from our master catalogue (packaged complete without double packaging charges):\n• **Jumbo Shawarma + Drink Combo**: ₦5,500\n• **Party Jollof + Turkey Combo**: ₦6,200\n• **Small Chops Regular Platter (35 pcs)**: ₦15,000\n• **Small Chops Executive Platter (60 pcs)**: ₦25,000`;
        recommended = [
          findActiveProduct('prod-sc-platter-reg'),
          findActiveProduct('prod-sc-platter-exec'),
          findActiveProduct('prod-sc-4200-mini'),
          findActiveProduct('prod-snack-shawarma-jumbo'),
        ].filter(Boolean) as Product[];
        action = {
          type: 'view_category',
          label: 'View Approved Combos & Platters 🔥',
          payload: 'deals',
        };
      }
      // 12.6 Bestsellers & Top Dishes
      else if (
        lower.includes('bestseller') ||
        lower.includes('best seller') ||
        lower.includes('popular') ||
        lower.includes('recommend') ||
        lower.includes('top dish') ||
        lower.includes('favorite') ||
        lower.includes('favourite')
      ) {
        replyText = `⭐ **Choplife Benin City Bestsellers**:\nOur most-loved, verified kitchen favorites prepared fresh daily across our GRA and Okabere kitchens:\n• **Firewood Party Jollof Rice**: ₦2,200\n• **Choplife Special Bread (600g)**: ₦1,200 (100% bromate-free)\n• **Chicken Shawarma Regular**: ₦3,500\n• **Signature ₦2,500 Small Chops Mini Pack**: ₦2,500\n• **Chilled Zobo Refreshment**: ₦1,000`;
        recommended = [
          findActiveProduct('prod-qsr-jollof-rice'),
          findActiveProduct('prod-bakery-special-bread'),
          findActiveProduct('prod-snack-shawarma-chicken-reg'),
          findActiveProduct('prod-sc-2500-mini'),
          findActiveProduct('prod-drink-zobo'),
        ].filter(Boolean) as Product[];
        action = {
          type: 'view_category',
          label: 'View All Bestsellers & Menu ⭐',
          payload: 'favourites',
        };
      }
      // 12.7 Frequently Asked Questions & Ordering Policies (FAQs)
      else if (
        lower.includes('faq') ||
        lower.includes('frequently asked') ||
        lower.includes('policy') ||
        lower.includes('rules') ||
        lower.includes('how does delivery work') ||
        lower.includes('how to order') ||
        lower.includes('payment method')
      ) {
        replyText = `❓ **Choplife Republic Frequently Asked Questions (FAQs)**:\n\n1. **Food Packaging (Pack 400)**: Cooked food portions require Pack 400 (₦400 per 4 food portions). Bakery bread, snacks, shawarma, and drinks are 100% exempt. Pre-packed combos are never double-charged.\n2. **Delivery Speed & Coverage**: Standard delivery runs in 30–90 mins across Benin City (GRA, Okabere, Ugbowo, Airport Rd, UNIBEN, Sapele Rd, Ring Road).\n3. **Operating Hours (WAT UTC+1)**:\n• GRA: 08:00–19:00 daily\n• Okabere: 08:00–21:00 daily\n• Ugbowo: 08:00–18:00 Mon–Sat (Closed Sundays)\n4. **Wholesale Bread**: 10 loaves per crate with reseller discount for stores, supermarkets, and schools.\n5. **Payment Security**: We support Paystack online (ATM cards, bank transfer, USSD) and POS card terminals. Payment before kitchen preparation is strictly enforced.`;
        action = {
          type: 'open_locations',
          label: 'Check Branch Hours & Locations 🕒',
        };
      }
      // 12.8 Browse Menu & Categories
      else if (
        lower.includes('browse menu') ||
        lower.includes('browse all') ||
        lower.includes('all categories') ||
        lower.includes('show menu')
      ) {
        replyText = `🍽️ **Choplife Republic Menu Categories**:\n• **Small Chops**: Mini packs (₦1,000–₦4,200), platters, and custom box builder\n• **Choplife Bakery**: 100% bromate-free bread & wholesale crates\n• **Kitchen Meals & Soups**: Firewood jollof, fried rice, native rice, banga & black soups\n• **Shawarma & Grills**: Chicken shawarma, beef shawarma, suya, peppered gizzard & turkey\n• **Cold Beverages**: Fresh zobo, malt, chilled sodas & juices`;
        action = {
          type: 'view_category',
          label: 'Browse Complete Menu 🍽️',
          payload: 'all',
        };
      }
      // 13. General search across activeProducts
    } finally {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          recommendedProducts: recommended.length > 0 ? recommended : undefined,
          suggestedAction: action,
        },
      ]);
      setIsTyping(false);
    }
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    setInputMessage('');
    generateBotReply(text);
  };

  const handleAddToCartFromChat = (product: Product) => {
    const qty = getChatQty(product.id);
    addToCart(product, qty);
    setAddedProductIds((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedProductIds((prev) => ({ ...prev, [product.id]: false }));
    }, 2000);
  };

  const handleViewProductInMenu = (category: string) => {
    setActiveCategory(category);
    setIsAiChatbotOpen(false);
    document.getElementById('menu-explorer-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleActionClick = (action: NonNullable<ChatMessage['suggestedAction']>) => {
    if (action.type === 'open_cart') {
      setIsAiChatbotOpen(false);
      setIsCartOpen(true);
    } else if (action.type === 'open_checkout') {
      setIsAiChatbotOpen(false);
      setIsCheckoutOpen(true);
    } else if (action.type === 'open_builder') {
      setIsAiChatbotOpen(false);
      setIsSmallChopsBuilderOpen(true);
    } else if (action.type === 'open_catering') {
      setIsAiChatbotOpen(false);
      setIsCateringModalOpen(true);
    } else if (action.type === 'open_locations') {
      setIsAiChatbotOpen(false);
      setIsLocationsModalOpen(true);
    } else if (action.type === 'open_support') {
      setIsAiChatbotOpen(false);
      const url = getBranchWhatsAppUrl(
        selectedBranchId,
        'Hello Choplife Republic Customer Care, I would like to speak with human support regarding my order.'
      );
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (action.type === 'view_category' && action.payload) {
      handleViewProductInMenu(action.payload);
    } else if (action.type === 'whatsapp') {
      const url = getBranchWhatsAppUrl(
        selectedBranchId,
        'Hello Choplife Republic, I was chatting with Chop Paddy and need human assistance with my order!'
      );
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsAiChatbotOpen(false);
        }
      }}
      className="fixed inset-0 z-45 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-end sm:justify-end sm:p-6 animate-in fade-in duration-200"
      id="chop-paddy-window"
    >
      <div className="bg-[#FAF7F2] rounded-t-3xl sm:rounded-3xl w-full sm:w-[490px] h-[min(650px,calc(100dvh-2.5rem))] max-h-[92dvh] sm:h-[min(680px,calc(100dvh-3rem))] sm:max-h-[85vh] shadow-2xl border-2 border-[#FFC700] flex flex-col justify-between overflow-hidden pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        
        {/* Chatbot Header */}
        <div className="bg-[#4D080F] text-white p-4 rounded-t-3xl flex items-center justify-between border-b-2 border-[#FFC700] shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-[#E62E00] text-[#FFC700] flex items-center justify-center font-titan text-xl shadow-md">
                🧑🏽‍🍳
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#4D080F]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-titan text-sm text-white tracking-wide">
                  CHOP PADDY
                </h3>
                <span className="bg-[#FFC700] text-[#4D080F] text-[9px] font-titan uppercase px-2 py-0.5 rounded-full">
                  Ordering Assistant
                </span>
              </div>
              <p className="text-[11px] text-white/80 font-montserrat flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#FFC700]" />
                <strong>{currentBranch.shortName}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsAiChatbotOpen(false);
                const url = getBranchWhatsAppUrl(
                  selectedBranchId,
                  'Hello Choplife Republic, I was chatting with Chop Paddy and need human assistance!'
                );
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[10px] font-montserrat font-bold text-[#FFC700] flex items-center gap-1"
              title="Escalate to Human Staff"
              id="chop-paddy-escalate-btn"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Human Help</span>
            </button>
            <button
              onClick={() => setIsAiChatbotOpen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              id="close-chop-paddy-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Cart Control Strip inside Chop Paddy */}
        {cart.length > 0 && (
          <div className="bg-[#FFF8E7] px-3.5 py-2 border-b border-[#FFC700] flex items-center justify-between gap-2 shrink-0 text-xs font-montserrat">
            <div className="flex items-center gap-2 min-w-0">
              <ShoppingBag className="w-4 h-4 text-[#E62E00] shrink-0" />
              <div className="truncate">
                <span className="font-bold text-[#4D080F]">{cartCount} items</span>
                <span className="text-[#7A6A65] mx-1">•</span>
                <span className="font-titan text-[#E62E00]">{formatNaira(cartTotal)}</span>
                {cartPackagingFee > 0 && (
                  <span className="text-[10px] text-[#5C4D49] ml-1">
                    (incl. {formatNaira(cartPackagingFee)} Pack 400)
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsAiChatbotOpen(false);
                  setIsCartOpen(true);
                }}
                className="px-2 py-1 rounded-lg bg-white border border-[#E5DEC9] text-[10px] font-bold text-[#4D080F] hover:bg-stone-100"
              >
                Edit Cart
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAiChatbotOpen(false);
                  setIsCheckoutOpen(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#E62E00] text-white font-titan text-[10px] hover:bg-[#C92200]"
                id="chop-paddy-checkout-btn"
              >
                Checkout
              </button>
            </div>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="flex-1 p-4 overflow-y-auto overscroll-contain space-y-4 font-montserrat text-xs sm:text-sm">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[92%] rounded-2xl p-3.5 shadow-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-[#E62E00] text-white rounded-tr-none'
                    : 'bg-white text-stone-800 border border-stone-200 rounded-tl-none'
                }`}
              >
                <div className="space-y-1">
                  {msg.text.split('\n').map((line, lIdx) => {
                    const parts = line.split(/(\*\*[^*]+\*\*)/g);
                    return (
                      <p key={lIdx} className="min-h-[1rem]">
                        {parts.map((part, pIdx) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return (
                              <strong key={pIdx} className="font-bold text-[#4D080F]">
                                {part.slice(2, -2)}
                              </strong>
                            );
                          }
                          return part;
                        })}
                      </p>
                    );
                  })}
                </div>

                {/* Structured Active Recommended Products Cards with Direct Quantity & Cart Controls */}
                {msg.recommendedProducts && msg.recommendedProducts.length > 0 && (
                  <div className="mt-3 space-y-2 pt-2.5 border-t border-stone-200">
                    <p className="text-[10px] font-bold text-[#4D080F] uppercase tracking-wider font-montserrat">
                      Active Approved Menu Options:
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {msg.recommendedProducts.map((p) => {
                        const price = getProductPrice(p, selectedBranchId);
                        const isAdded = !!addedProductIds[p.id];
                        const qty = getChatQty(p.id);
                        const existingCartLine = cart.find((c) => c.product.id === p.id);

                        return (
                          <div
                            key={p.id}
                            className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#E5DEC9] flex flex-col gap-2"
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={p.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
                                alt={p.name}
                                className="w-12 h-12 rounded-lg object-cover shrink-0 border border-stone-200"
                                referrerPolicy="no-referrer"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-xs text-[#241311] truncate">
                                  {p.name}
                                </p>
                                <p className="text-[11px] text-[#7A6A65] truncate font-montserrat">
                                  {p.shortDescription}
                                </p>
                                <p className="text-xs text-[#E62E00] font-titan">
                                  {formatNaira(price)}
                                </p>
                              </div>
                            </div>

                            {/* Direct Quantity Input + Add/Remove Controls */}
                            <div className="flex items-center gap-1.5 pt-1 border-t border-stone-200/60">
                              <div className="flex items-center gap-1 bg-white px-1.5 py-1 rounded-lg border border-[#E5DEC9]">
                                <button
                                  type="button"
                                  onClick={() => setChatQty(p.id, qty - 1)}
                                  className="w-5 h-5 rounded bg-[#FAF7F2] hover:bg-[#E5DEC9] flex items-center justify-center text-xs font-bold text-[#4D080F]"
                                  aria-label={`Decrease quantity for ${p.name}`}
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  max={500}
                                  value={qty}
                                  onChange={(e) => {
                                    const parsed = parseInt(e.target.value, 10);
                                    setChatQty(p.id, Number.isNaN(parsed) ? 1 : parsed);
                                  }}
                                  className="w-10 text-center font-titan text-xs text-[#241311] bg-transparent focus:outline-none"
                                  aria-label={`Quantity input for ${p.name}`}
                                />
                                <button
                                  type="button"
                                  onClick={() => setChatQty(p.id, qty + 1)}
                                  className="w-5 h-5 rounded bg-[#FAF7F2] hover:bg-[#E5DEC9] flex items-center justify-center text-xs font-bold text-[#4D080F]"
                                  aria-label={`Increase quantity for ${p.name}`}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleAddToCartFromChat(p)}
                                className={`flex-1 text-xs font-titan py-2 px-2.5 rounded-lg flex items-center justify-center gap-1 transition-all shadow-2xs active:scale-95 ${
                                  isAdded
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[#E62E00] hover:bg-[#C92200] text-white'
                                }`}
                                id={`chat-add-btn-${p.id}`}
                              >
                                {isAdded ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Added {qty}x!
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3.5 h-3.5" /> Add to Cart ({formatNaira(price * qty)})
                                  </>
                                )}
                              </button>

                              {existingCartLine && (
                                <button
                                  type="button"
                                  onClick={() => removeFromCart(existingCartLine.id)}
                                  className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                                  title={`Remove ${p.name} from cart`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleViewProductInMenu(p.category)}
                                className="text-[11px] font-montserrat font-bold bg-white hover:bg-stone-100 text-[#4D080F] border border-stone-300 py-2 px-2 rounded-lg flex items-center gap-1 shrink-0"
                                title="View in menu"
                              >
                                <ArrowRight className="w-3 h-3 text-[#4D080F]" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Primary Action Button */}
                {msg.suggestedAction && (
                  <div className="mt-3 pt-2.5 border-t border-stone-200">
                    <button
                      onClick={() => handleActionClick(msg.suggestedAction!)}
                      className="w-full bg-[#FFC700] hover:bg-[#FFD733] text-[#4D080F] font-titan text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-transform active:scale-95"
                    >
                      {msg.suggestedAction.label}
                    </button>
                  </div>
                )}

                <span
                  className={`text-[9px] mt-2 block text-right font-montserrat ${
                    msg.sender === 'user' ? 'text-white/70' : 'text-stone-400'
                  }`}
                >
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-1.5 bg-white border border-stone-200 p-3 rounded-2xl rounded-tl-none w-20 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#E62E00] animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-[#E62E00] animate-bounce [animation-delay:0.2s]" />
              <span className="w-2 h-2 rounded-full bg-[#E62E00] animate-bounce [animation-delay:0.4s]" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-3 py-2 bg-stone-100/90 border-t border-stone-200 shrink-0">
          <p className="text-[10px] font-bold text-[#7A6A65] font-montserrat mb-1 uppercase tracking-wider">
            Quick Actions:
          </p>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button
              type="button"
              onClick={() => handleSendMessage('Show active Small Chops Mini Packs and party platters')}
              className="text-[11px] font-montserrat font-bold bg-white text-[#4D080F] hover:bg-[#FFC700]/20 border border-stone-300 px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs whitespace-nowrap shrink-0 transition-colors"
            >
              🥟 Small Chops & Platters
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('Show approved combos and party deals')}
              className="text-[11px] font-montserrat font-bold bg-white text-[#4D080F] hover:bg-[#FFC700]/20 border border-stone-300 px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs whitespace-nowrap shrink-0 transition-colors"
            >
              🔥 Approved Combos
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('What are your most popular bestsellers?')}
              className="text-[11px] font-montserrat font-bold bg-white text-[#4D080F] hover:bg-[#FFC700]/20 border border-stone-300 px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs whitespace-nowrap shrink-0 transition-colors"
            >
              ⭐ Bestsellers
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('What fresh bread and wholesale crates are available?')}
              className="text-[11px] font-montserrat font-bold bg-white text-[#4D080F] hover:bg-[#FFC700]/20 border border-stone-300 px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs whitespace-nowrap shrink-0 transition-colors"
            >
              <Wheat className="w-3 h-3 text-[#E62E00]" /> Fresh Bread 🍞
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('What are the operating hours and branch locations?')}
              className="text-[11px] font-montserrat font-bold bg-white text-[#4D080F] hover:bg-[#FFC700]/20 border border-stone-300 px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs whitespace-nowrap shrink-0 transition-colors"
            >
              <MapPin className="w-3 h-3 text-[#E62E00]" /> Locations & Hours
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('Frequently Asked Questions: Pack 400 and delivery coverage')}
              className="text-[11px] font-montserrat font-bold bg-white text-[#4D080F] hover:bg-[#FFC700]/20 border border-stone-300 px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs whitespace-nowrap shrink-0 transition-colors"
            >
              ❓ FAQs & Policies
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('Explain Pack 400 packaging rule and show my cart')}
              className="text-[11px] font-montserrat font-bold bg-white text-[#4D080F] hover:bg-[#FFC700]/20 border border-stone-300 px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs whitespace-nowrap shrink-0 transition-colors"
            >
              <Package className="w-3 h-3 text-[#E62E00]" /> Cart & Pack 400
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('Check my order status')}
              className="text-[11px] font-montserrat font-bold bg-white text-[#4D080F] hover:bg-[#FFC700]/20 border border-stone-300 px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs whitespace-nowrap shrink-0 transition-colors"
            >
              <Utensils className="w-3 h-3 text-[#E62E00]" /> Order Status
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('Browse all food and drink categories')}
              className="text-[11px] font-montserrat font-bold bg-white text-[#4D080F] hover:bg-[#FFC700]/20 border border-stone-300 px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs whitespace-nowrap shrink-0 transition-colors"
            >
              🍽️ Browse Full Menu
            </button>
          </div>
        </div>

        {/* Message Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 bg-white border-t border-stone-200 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder='Try "Add 2 Jollof Rice", "Mini Packs", or "Track Order"...'
            className="flex-1 bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-montserrat focus:outline-hidden focus:border-[#4D080F]"
            id="chop-paddy-input"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="bg-[#E62E00] hover:bg-[#FF3E1D] disabled:opacity-50 text-white p-2.5 rounded-xl shadow-md transition-all active:scale-95 shrink-0"
            id="chop-paddy-send-btn"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
};

