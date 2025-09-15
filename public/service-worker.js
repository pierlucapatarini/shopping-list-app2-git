self.addEventListener('push', function(event) {
    let data = { title: 'Nuovo messaggio', body: 'Hai un nuovo messaggio' };
    if (event.data) {
        data = event.data.json();
    }

    const title = data.title;
    const options = {
        body: data.body,
        icon: '/images/icon-192x192.png', // Sostituisci con il percorso di una tua icona
        badge: '/images/badge.png' // Icona più piccola per alcuni sistemi operativi
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/') // Apri la pagina principale dell'app quando si clicca sulla notifica
    );
});