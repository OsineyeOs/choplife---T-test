/**
 * Choplife Republic Browser Push Notification Service
 * Manages Web Notification API and Service Worker push alerts for order updates.
 * Keeps users informed about order status (Confirmed, Preparing, Ready for Pickup, Out for Delivery, Delivered)
 * without requiring the browser tab to remain focused or active.
 */

import { Order, OrderStatus } from '../types';

export interface NotificationStatusInfo {
  isSupported: boolean;
  permission: NotificationPermission;
}

export function getNotificationSupport(): NotificationStatusInfo {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { isSupported: false, permission: 'denied' };
  }
  return {
    isSupported: true,
    permission: Notification.permission,
  };
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      sendBrowserNotification('Notifications Enabled! 🔔', {
        body: 'You will receive live order updates from Choplife Republic even when this tab is closed.',
        tag: 'choplife-welcome',
      });
    }
    return permission;
  } catch (err) {
    console.warn('[NOTIFICATIONS] Permission request error:', err);
    return Notification.permission;
  }
}

interface OrderNotificationContent {
  title: string;
  body: string;
  icon: string;
  badge?: string;
}

export function getOrderStatusNotificationContent(
  order: Order,
  status: OrderStatus
): OrderNotificationContent {
  const branchName = order.branchId.toUpperCase();
  const isPickup = order.orderType === 'pickup' || order.orderType === 'dine-in';

  switch (status) {
    case 'received':
      return {
        title: `Order #${order.orderNumber} Received 🛍️`,
        body: `We have received your order at Choplife ${branchName}. Sending ticket to the kitchen.`,
        icon: '/pwa-icon.svg',
      };
    case 'confirmed':
      return {
        title: `Order #${order.orderNumber} Confirmed! 🔥`,
        body: `Choplife ${branchName} has confirmed your order. Fresh feast is in preparation!`,
        icon: '/pwa-icon.svg',
      };
    case 'preparing':
      return {
        title: `In The Kitchen Sizzling 🍳`,
        body: `Order #${order.orderNumber} is actively being grilled, fried, and packaged fresh.`,
        icon: '/pwa-icon.svg',
      };
    case 'ready':
      if (isPickup) {
        return {
          title: `Ready for Pickup! 🏪`,
          body: `Order #${order.orderNumber} is hot and ready for collection at Choplife ${branchName} counter!`,
          icon: '/pwa-icon.svg',
        };
      }
      return {
        title: `Packaged in Thermal Foil 📦`,
        body: `Order #${order.orderNumber} is sealed and ready for dispatch. Assigning rider now.`,
        icon: '/pwa-icon.svg',
      };
    case 'out_for_delivery':
      return {
        title: `Rider Dispatched! 🛵`,
        body: `Your food is on the way to ${order.deliveryDetails.address || 'your location'}! Estimated 15–25 mins.`,
        icon: '/pwa-icon.svg',
      };
    case 'delivered':
      return {
        title: `Delivered — 100% Maximum Enjoyment! 👑`,
        body: `Order #${order.orderNumber} has arrived! Enjoy your feast. Thank you for choosing Choplife!`,
        icon: '/pwa-icon.svg',
      };
    case 'cancelled':
      return {
        title: `Order #${order.orderNumber} Cancelled ❌`,
        body: `Your order has been cancelled. If you need assistance, please chat with us on WhatsApp.`,
        icon: '/pwa-icon.svg',
      };
    default:
      return {
        title: `Order #${order.orderNumber} Updated`,
        body: `Your order status is now: ${String(status).replace('_', ' ')}.`,
        icon: '/pwa-icon.svg',
      };
  }
}

/**
 * Triggers a browser-level push notification if permission is granted.
 * Tries ServiceWorker registration first for background persistence, falls back to new Notification().
 */
export async function sendBrowserNotification(
  title: string,
  options: NotificationOptions = {}
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  const notificationOptions: NotificationOptions = {
    icon: '/pwa-icon.svg',
    badge: '/pwa-icon.svg',
    ...options,
  };

  try {
    // 1. Try ServiceWorker showNotification if available and active
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.active) {
          await registration.showNotification(title, notificationOptions);
          playNotificationChime();
          return true;
        }
      } catch (swErr) {
        console.warn('[NOTIFICATIONS] SW notification fallback to window Notification:', swErr);
      }
    }

    // 2. Standard Window Notification
    const notif = new Notification(title, notificationOptions);
    notif.onclick = () => {
      window.focus();
      notif.close();
    };

    playNotificationChime();
    return true;
  } catch (err) {
    console.warn('[NOTIFICATIONS] Failed to trigger notification:', err);
    return false;
  }
}

/**
 * Subtle audio & haptic feedback for order state changes
 */
export function playNotificationChime() {
  if (typeof window === 'undefined') return;

  // Haptic feedback
  if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([150, 80, 150]);
    } catch {}
  }

  // Audio tone synthesis via Web Audio API (zero external assets needed)
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {}
}
