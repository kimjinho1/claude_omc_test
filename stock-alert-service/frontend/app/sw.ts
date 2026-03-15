import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';
import { defaultCache } from '@serwist/next/worker';

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() ?? {};
  const title = (data as Record<string, string>)['title'] ?? '주식 알림';
  const body = (data as Record<string, string>)['body'] ?? '';
  const symbol = (data as Record<string, string>)['symbol'] ?? '';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192x192.png',
      data: { symbol },
      tag: `stock-alert-${symbol}`,
    }),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const symbol = (event.notification.data as { symbol?: string })?.symbol;
  const url = symbol ? `/stocks/${symbol}` : '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const client = clients.find((c) => c.url.includes(url));
      if (client) return client.focus();
      return self.clients.openWindow(url);
    }),
  );
});
