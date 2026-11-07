import React from 'react';
import { BranchId, CartCustomization, CartItem, Order, Product } from '../types';
import { MASTER_PRODUCTS } from '../data/menu';

export function buildReorderHandlers(params: {
  selectedBranchId: BranchId;
  setSelectedBranchId: (id: BranchId) => void;
  products: Product[];
  getProductPrice: (product: Product, branchId?: BranchId) => number;
  isProductAvailable: (productId: string, branchId?: BranchId) => boolean;
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  addToCart: (product: Product, quantity?: number, customization?: CartCustomization, openDrawer?: boolean) => void;
  setLastAddedToast: (toast: { productName: string; quantity: number; totalPrice: number } | null) => void;
  setIsCartOpen: (open: boolean) => void;
}) {
  const {
    selectedBranchId,
    setSelectedBranchId,
    products,
    getProductPrice,
    isProductAvailable,
    setCart,
    addToCart,
    setLastAddedToast,
    setIsCartOpen,
  } = params;

  const reorderPastOrder = (pastOrder: Order) => {
    const targetBranch = pastOrder.branchId || selectedBranchId;
    if (targetBranch !== selectedBranchId) {
      setSelectedBranchId(targetBranch);
    }
    const resolvedItems: CartItem[] = [];
    for (const item of pastOrder.items || []) {
      const prod =
        products.find((p) => p.id === (item.productId || item.product?.id || (item as any).menuItemId)) ||
        MASTER_PRODUCTS.find((p) => p.id === (item.productId || item.product?.id || (item as any).menuItemId)) ||
        item.product;

      if (!prod) continue;
      if (!isProductAvailable(prod.id, targetBranch)) continue;

      const basePrice = getProductPrice(prod, targetBranch);
      let optionsDelta = 0;
      if (item.customization?.selectedOptions) {
        optionsDelta += item.customization.selectedOptions.reduce((acc, opt) => acc + (opt.priceDelta || 0), 0);
      }
      if (item.customization?.selectedAddOns) {
        optionsDelta += item.customization.selectedAddOns.reduce((acc, add) => acc + (add.price || 0), 0);
      }
      const currentAuthoritativePrice = basePrice + optionsDelta;

      const customizationKey = item.customization ? JSON.stringify(item.customization) : '';
      const cartItemId = `${prod.id}-${targetBranch}-${customizationKey}`;
      resolvedItems.push({
        id: cartItemId,
        productId: prod.id,
        product: prod,
        quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
        unitPrice: currentAuthoritativePrice > 0 ? currentAuthoritativePrice : (item.unitPrice || prod.basePrice || 0),
        customization: item.customization,
        branchId: targetBranch,
      });
    }

    if (resolvedItems.length === 0) return;

    setCart((prev) => {
      const next = [...prev];
      for (const rItem of resolvedItems) {
        const existingIdx = next.findIndex((i) => i.id === rItem.id);
        if (existingIdx > -1) {
          next[existingIdx] = {
            ...next[existingIdx],
            quantity: next[existingIdx].quantity + rItem.quantity,
          };
        } else {
          next.push(rItem);
        }
      }
      return next;
    });

    setLastAddedToast({
      productName: `Reordered: Order #${pastOrder.orderNumber}`,
      quantity: resolvedItems.reduce((acc, i) => acc + i.quantity, 0),
      totalPrice: resolvedItems.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0),
    });
    setIsCartOpen(true);
  };

  const reorderItem = (item: CartItem, branchId?: BranchId) => {
    const targetBranch = branchId || item.branchId || selectedBranchId;
    if (targetBranch !== selectedBranchId) {
      setSelectedBranchId(targetBranch);
    }
    const prod =
      item.product ||
      products.find((p) => p.id === (item.productId || (item as any).menuItemId)) ||
      MASTER_PRODUCTS.find((p) => p.id === (item.productId || (item as any).menuItemId));

    if (!prod) return;
    const qty = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
    addToCart(prod, qty, item.customization, true);
    setLastAddedToast({
      productName: `Reordered: ${prod.name}`,
      quantity: qty,
      totalPrice: (item.unitPrice || prod.basePrice || 0) * qty,
    });
  };

  return { reorderPastOrder, reorderItem };
}
