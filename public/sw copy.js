// Service Worker per gestire le notifiche push
// Salva questo file come public/sw.js

// sw.js - aggiungi all'inizio

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  self.skipWaiting(); // Forza l'attivazione immediata
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(self.clients.claim()); // Prendi il controllo immediato di tutte le pagine
});













const CACHE_NAME = 'famiglia-app-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

// Installazione del Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installation completed');
        return self.skipWaiting();
      })
  );
});

// Attivazione del Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activation completed');
      return self.clients.claim();
    })
  );
});

// Gestione delle richieste fetch (cache strategy)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Se trovato in cache, restituisci dalla cache
        if (response) {
          return response;
        }
        // Altrimenti fetch dalla rete
        return fetch(event.request);
      }
    )
  );
});

// Gestione delle notifiche push ricevute
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push event received', event);
  
  let notificationData = {
    title: 'Calendario Famiglia',
    body: 'Hai un nuovo evento!',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    tag: 'famiglia-notification',
    requireInteraction: true,
    data: {
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'view',
        title: '👁️ Visualizza',
        icon: '/icon-72.png'
      },
      {
        action: 'dismiss',
        title: '❌ Ignora',
        icon: '/icon-72.png'
      }
    ]
  };

  // Se ci sono dati dal server, usali
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = {
        ...notificationData,
        ...pushData
      };
    } catch (error) {
      console.error('Errore parsing push data:', error);
      // Usa il testo grezzo come body se il parsing JSON fallisce
      notificationData.body = event.data.text();
    }
  }

  console.log('Showing notification:', notificationData);

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Gestione dei click sulle notifiche
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  // Gestisci le azioni della notifica
  if (event.action === 'dismiss') {
    return;
  }

  // Azione 'view' o click generale sulla notifica
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Se c'è già una finestra aperta dell'app, focusala
      for (let client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          // Se è un evento specifico, naviga al calendario
          if (event.notification.data && event.notification.data.eventId) {
            client.postMessage({
              type: 'NAVIGATE_TO_EVENT',
              eventId: event.notification.data.eventId
            });
          }
          return client.focus();
        }
      }
      
      // Se non ci sono finestre aperte, aprne una nuova
      let urlToOpen = '/';
      
      // Se è una notifica specifica di un evento, apri direttamente il calendario
      if (event.notification.data && event.notification.data.type === 'event') {
        urlToOpen = '/calendario';
      }
      
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Gestione degli errori delle notifiche push
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('Push subscription changed:', event);
  
  event.waitUntil(
    // Qui potresti re-sottoscrivere l'utente automaticamente
    // o inviare una richiesta al server per aggiornare la subscription
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: 'BA1yRnhH-u3I41onTHomTbQoxRpZxwhpPLnNT8N_zqNI8WeUZwSVf8ln_AmS9f1Ec6dwUBR1erYk76pomNKfSds'
    }).then((newSubscription) => {
      // Invia la nuova subscription al server
      return fetch('/api/update-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSubscription)
      });
    })
  );
});

// Gestione dei messaggi dai client (dalla pagina web)
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Sincronizzazione in background (opzionale)
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event);
  
  if (event.tag === 'sync-notifications') {
    event.waitUntil(
      // Qui potresti sincronizzare le notifiche non inviate
      // quando la connessione torna disponibile
      syncPendingNotifications()
    );
  }
});

async function syncPendingNotifications() {
  try {
    // Implementa la logica per sincronizzare le notifiche pendenti
    console.log('Syncing pending notifications...');
  } catch (error) {
    console.error('Error syncing notifications:', error);
  }
}