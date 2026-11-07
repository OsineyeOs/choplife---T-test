import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Product, CartCustomization } from '../../types';

export const usePOSCart = () => {
  const {
    cart,
    setCart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    cartSubtotal,
    cartPackagingFee,
    cartDiscount,
    cartTotal,
  } = useApp();

  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [customDiscountAmount, setCustomDiscountAmount] = useState<number>(0);
  const [redeemedChopPoints, setRedeemedChopPoints] = useState<number>(0);
  const [isPackagingIncluded, setIsPackagingIncluded] = useState<boolean>(false);
  const [posDeliveryFee, setPosDeliveryFee] = useState<number>(0);

  const addItem = (product: Product, quantity = 1, customization?: CartCustomization) => {
    addToCart(product, quantity, customization, false);
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    const item = cart.find((i) => i.id === cartItemId);
    if (!item) return;
    updateCartQuantity(cartItemId, item.quantity + delta);
  };

  const setDirectQuantity = (cartItemId: string, newQty: number) => {
    const sanitized = Math.max(0, Math.floor(newQty || 0));
    updateCartQuantity(cartItemId, sanitized);
  };

  const clearCartLogic = (callback?: () => void) => {
    clearCart();
    setDiscountPercent(0);
    setCustomDiscountAmount(0);
    setRedeemedChopPoints(0);
    setIsPackagingIncluded(false);
    setPosDeliveryFee(0);
    if (callback) callback();
  };

  // Recalculate totals based on hook state
  const totalDiscount = (Math.round((cartSubtotal * discountPercent) / 100)) + customDiscountAmount + redeemedChopPoints;
  const grandTotal = Math.max(0, cartSubtotal + (isPackagingIncluded ? 400 : 0) + cartPackagingFee + posDeliveryFee - totalDiscount);

  return {
    posItems: cart,
    setPosItems: setCart,
    addItem,
    updateQuantity,
    setDirectQuantity,
    clearCart: clearCartLogic,
    subtotal: cartSubtotal,
    packagingFee: (isPackagingIncluded ? 400 : 0) + cartPackagingFee,
    posDeliveryFee,
    setPosDeliveryFee,
    totalDiscount,
    grandTotal,
    discountPercent,
    setDiscountPercent,
    customDiscountAmount,
    setCustomDiscountAmount,
    redeemedChopPoints,
    setRedeemedChopPoints,
    isPackagingIncluded,
    setIsPackagingIncluded,
  };
};
