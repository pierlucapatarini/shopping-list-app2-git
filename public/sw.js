// service-worker.js

// Questo event listener 'install' garantisce che il service worker sia installato
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installato.');
  self.skipWaiting();
});

// Questo event listener 'activate' si attiva quando il service worker è pronto
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Attivo.');
  event.waitUntil(self.clients.claim());
});

// Questo event listener 'push' è il più importante
// Viene attivato ogni volta che una notifica push arriva dal server
self.addEventListener('push', (event) => {
  const payload = event.data.json();
  console.log('Notifica push ricevuta:', payload);

  const title = payload.title || 'Nuovo messaggio';
  const options = {
    body: payload.body || 'Hai un nuovo messaggio.',
    icon: '/logo192.png', // Un percorso a un'icona per la notifica
    badge: '/badge.png' // Un'icona più piccola per alcuni sistemi operativi
  };

  // Mostra la notifica all'utente
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Opzionale: gestione del click sulla notifica
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Puoi reindirizzare l'utente a una pagina specifica
  // event.waitUntil(clients.openWindow('/pagina2-familychat'));
});