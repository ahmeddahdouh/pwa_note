const CACHE_NAME = 'notesflow-v1';
const DYNAMIC_CACHE = 'notesflow-dynamic-v1';

// Ressources à mettre en cache lors de l'installation
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/app.jsx',
    '/manifest.json',
    'https://unpkg.com/react@18/umd/react.production.min.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
    'https://unpkg.com/@babel/standalone/babel.min.js'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker: Installation...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Cache ouvert, ajout des assets statiques');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('✅ Assets statiques mis en cache');
                return self.skipWaiting(); // Active immédiatement le nouveau SW
            })
            .catch((error) => {
                console.error('❌ Erreur lors de la mise en cache:', error);
            })
    );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker: Activation...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            // Supprime les anciens caches
                            return name !== CACHE_NAME && name !== DYNAMIC_CACHE;
                        })
                        .map((name) => {
                            console.log('🗑️ Suppression ancien cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('✅ Service Worker activé');
                return self.clients.claim(); // Prend le contrôle immédiatement
            })
    );
});

// Interception des requêtes réseau
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Ne pas mettre en cache les requêtes vers l'API Anthropic ou autres APIs externes
    if (url.origin !== location.origin && !url.href.includes('unpkg.com')) {
        return;
    }

    // Stratégie: Cache First avec Network Fallback
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    console.log('📦 Servi depuis le cache:', request.url);
                    return cachedResponse;
                }

                // Si pas en cache, fetch depuis le réseau
                return fetch(request)
                    .then((networkResponse) => {
                        // Si la réponse est valide, la mettre en cache dynamique
                        if (networkResponse && networkResponse.status === 200) {
                            const responseClone = networkResponse.clone();
                            
                            caches.open(DYNAMIC_CACHE)
                                .then((cache) => {
                                    cache.put(request, responseClone);
                                    console.log('💾 Ajouté au cache dynamique:', request.url);
                                });
                        }
                        
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.log('⚠️ Échec réseau, mode offline:', request.url);
                        
                        // En cas d'échec réseau, retourner une page offline personnalisée
                        if (request.destination === 'document') {
                            return caches.match('/index.html');
                        }
                        
                        throw error;
                    });
            })
    );
});

// Gestion de la synchronisation en arrière-plan (Background Sync)
self.addEventListener('sync', (event) => {
    console.log('🔄 Background Sync:', event.tag);
    
    if (event.tag === 'sync-notes') {
        event.waitUntil(
            // Ici vous pourriez synchroniser les notes avec un serveur
            Promise.resolve()
                .then(() => {
                    console.log('✅ Synchronisation réussie');
                })
                .catch((error) => {
                    console.error('❌ Erreur de synchronisation:', error);
                })
        );
    }
});

// Gestion des messages depuis l'application
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys()
                .then((cacheNames) => {
                    return Promise.all(
                        cacheNames.map((name) => caches.delete(name))
                    );
                })
                .then(() => {
                    console.log('🗑️ Tous les caches supprimés');
                    event.ports[0].postMessage({ success: true });
                })
        );
    }
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
