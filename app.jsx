const { useState, useEffect, useRef } = React;

// ============================================
// GESTIONNAIRE IndexedDB
// ============================================
class NotesDB {
    constructor() {
        this.dbName = 'NotesFlowDB';
        this.version = 1;
        this.db = null;
    }

    // Initialiser la base de données
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('❌ Erreur ouverture IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB initialisée');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Créer l'object store pour les notes
                if (!db.objectStoreNames.contains('notes')) {
                    const objectStore = db.createObjectStore('notes', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    
                    // Créer des index pour les recherches
                    objectStore.createIndex('title', 'title', { unique: false });
                    objectStore.createIndex('createdAt', 'createdAt', { unique: false });
                    objectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                    
                    console.log('📦 Object store "notes" créé');
                }
            };
        });
    }

    // Ajouter une note
    async addNote(note) {
        const transaction = this.db.transaction(['notes'], 'readwrite');
        const objectStore = transaction.objectStore('notes');
        
        const noteData = {
            ...note,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        return new Promise((resolve, reject) => {
            const request = objectStore.add(noteData);
            
            request.onsuccess = () => {
                console.log('✅ Note ajoutée, ID:', request.result);
                resolve(request.result);
            };
            
            request.onerror = () => {
                console.error('❌ Erreur ajout note:', request.error);
                reject(request.error);
            };
        });
    }

    // Récupérer toutes les notes
    async getAllNotes() {
        const transaction = this.db.transaction(['notes'], 'readonly');
        const objectStore = transaction.objectStore('notes');
        
        return new Promise((resolve, reject) => {
            const request = objectStore.getAll();
            
            request.onsuccess = () => {
                console.log('📖 Notes récupérées:', request.result.length);
                resolve(request.result);
            };
            
            request.onerror = () => {
                console.error('❌ Erreur récupération notes:', request.error);
                reject(request.error);
            };
        });
    }

    // Mettre à jour une note
    async updateNote(id, updates) {
        const transaction = this.db.transaction(['notes'], 'readwrite');
        const objectStore = transaction.objectStore('notes');
        
        return new Promise((resolve, reject) => {
            const getRequest = objectStore.get(id);
            
            getRequest.onsuccess = () => {
                const note = getRequest.result;
                
                if (note) {
                    const updatedNote = {
                        ...note,
                        ...updates,
                        updatedAt: Date.now()
                    };
                    
                    const updateRequest = objectStore.put(updatedNote);
                    
                    updateRequest.onsuccess = () => {
                        console.log('✅ Note mise à jour, ID:', id);
                        resolve(updatedNote);
                    };
                    
                    updateRequest.onerror = () => {
                        console.error('❌ Erreur mise à jour:', updateRequest.error);
                        reject(updateRequest.error);
                    };
                } else {
                    reject(new Error('Note non trouvée'));
                }
            };
            
            getRequest.onerror = () => {
                reject(getRequest.error);
            };
        });
    }

    // Supprimer une note
    async deleteNote(id) {
        const transaction = this.db.transaction(['notes'], 'readwrite');
        const objectStore = transaction.objectStore('notes');
        
        return new Promise((resolve, reject) => {
            const request = objectStore.delete(id);
            
            request.onsuccess = () => {
                console.log('🗑️ Note supprimée, ID:', id);
                resolve();
            };
            
            request.onerror = () => {
                console.error('❌ Erreur suppression:', request.error);
                reject(request.error);
            };
        });
    }

    // Rechercher des notes
    async searchNotes(searchTerm) {
        const allNotes = await this.getAllNotes();
        const term = searchTerm.toLowerCase();
        
        return allNotes.filter(note => 
            note.title.toLowerCase().includes(term) || 
            note.content.toLowerCase().includes(term)
        );
    }
}

// Instance globale de la DB
const notesDB = new NotesDB();

// ============================================
// COMPOSANTS REACT
// ============================================

// Composant principal de l'application
function App() {
    const [notes, setNotes] = useState([]);
    const [selectedNote, setSelectedNote] = useState(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDBReady, setIsDBReady] = useState(false);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [stats, setStats] = useState({ total: 0, today: 0 });
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [showSidebar, setShowSidebar] = useState(window.innerWidth > 768);

    // Détecter le redimensionnement de la fenêtre
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth <= 768;
            setIsMobile(mobile);
            if (!mobile) {
                setShowSidebar(true);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Initialiser IndexedDB au démarrage
    useEffect(() => {
        notesDB.init()
            .then(() => {
                setIsDBReady(true);
                loadNotes();
            })
            .catch((error) => {
                console.error('Erreur initialisation DB:', error);
            });

        // Écouter les changements de statut réseau
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Écouter l'événement d'installation PWA
        const handleInstallable = () => {
            console.log('✅ PWA installable détectée, affichage du bouton');
            setShowInstallPrompt(true);
        };
        window.addEventListener('pwa-installable', handleInstallable);

        console.log('🔍 État initial - Prompt disponible:', !!window.deferredPrompt);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('pwa-installable', handleInstallable);
        };
    }, []);

    // Charger toutes les notes
    const loadNotes = async () => {
        try {
            const allNotes = await notesDB.getAllNotes();
            setNotes(allNotes.sort((a, b) => b.updatedAt - a.updatedAt));
            
            // Calculer les stats
            const today = new Date().setHours(0, 0, 0, 0);
            const todayNotes = allNotes.filter(n => n.createdAt >= today);
            setStats({ total: allNotes.length, today: todayNotes.length });
        } catch (error) {
            console.error('Erreur chargement notes:', error);
        }
    };

    // Créer une nouvelle note
    const createNote = async () => {
        const newNote = {
            title: 'Nouvelle note',
            content: '',
            color: getRandomColor()
        };

        try {
            const id = await notesDB.addNote(newNote);
            await loadNotes();
            
            // Sélectionner la nouvelle note
            const allNotes = await notesDB.getAllNotes();
            const createdNote = allNotes.find(n => n.id === id);
            setSelectedNote(createdNote);
            
            // Sur mobile, fermer la sidebar après création
            if (isMobile) {
                setShowSidebar(false);
            }
        } catch (error) {
            console.error('Erreur création note:', error);
        }
    };

    // Mettre à jour une note
    const updateNote = async (id, updates) => {
        try {
            await notesDB.updateNote(id, updates);
            await loadNotes();
            
            if (selectedNote && selectedNote.id === id) {
                const allNotes = await notesDB.getAllNotes();
                const updated = allNotes.find(n => n.id === id);
                setSelectedNote(updated);
            }
        } catch (error) {
            console.error('Erreur mise à jour note:', error);
        }
    };

    // Supprimer une note
    const deleteNote = async (id) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette note ?')) return;
        
        try {
            await notesDB.deleteNote(id);
            await loadNotes();
            
            if (selectedNote && selectedNote.id === id) {
                setSelectedNote(null);
            }
        } catch (error) {
            console.error('Erreur suppression note:', error);
        }
    };

    // Rechercher des notes
    const handleSearch = async (term) => {
        setSearchTerm(term);
        
        if (term.trim() === '') {
            await loadNotes();
        } else {
            try {
                const results = await notesDB.searchNotes(term);
                setNotes(results.sort((a, b) => b.updatedAt - a.updatedAt));
            } catch (error) {
                console.error('Erreur recherche:', error);
            }
        }
    };

    // Installer la PWA
    const installPWA = async () => {
        console.log('🔘 Bouton installer cliqué');
        
        if (!window.deferredPrompt) {
            console.log('⚠️ Pas de prompt d\'installation disponible');
            alert('L\'installation n\'est pas disponible. L\'application est peut-être déjà installée ou vous devez utiliser HTTPS.');
            return;
        }

        try {
            // Afficher le prompt d'installation
            console.log('📲 Affichage du prompt...');
            window.deferredPrompt.prompt();
            
            // Attendre la réponse de l'utilisateur
            const choiceResult = await window.deferredPrompt.userChoice;
            
            if (choiceResult.outcome === 'accepted') {
                console.log('✅ Utilisateur a accepté l\'installation');
            } else {
                console.log('❌ Utilisateur a refusé l\'installation');
            }
            
            // Réinitialiser le prompt
            window.deferredPrompt = null;
            setShowInstallPrompt(false);
        } catch (error) {
            console.error('❌ Erreur lors de l\'installation:', error);
            alert('Erreur lors de l\'installation. Veuillez réessayer.');
        }
    };

    const getRandomColor = () => {
        const colors = ['#f39c12', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#1abc9c'];
        return colors[Math.floor(Math.random() * colors.length)];
    };

    const handleSelectNote = (note) => {
        setSelectedNote(note);
        if (isMobile) {
            setShowSidebar(false);
        }
    };

    const handleBackToList = () => {
        setShowSidebar(true);
        if (isMobile) {
            setSelectedNote(null);
        }
    };

    if (!isDBReady) {
        return (
            <div style={styles.loading}>
                <div style={styles.loadingText}>Initialisation d'IndexedDB...</div>
            </div>
        );
    }

    return (
        <div style={styles.app}>
            <Header 
                isOnline={isOnline} 
                stats={stats}
                onSearch={handleSearch}
                searchTerm={searchTerm}
                showInstallPrompt={showInstallPrompt}
                onInstall={installPWA}
                isMobile={isMobile}
                showSidebar={showSidebar}
                onToggleSidebar={() => setShowSidebar(!showSidebar)}
            />
            
            <div style={styles.container}>
                {(showSidebar || !isMobile) && (
                    <Sidebar 
                        notes={notes}
                        selectedNote={selectedNote}
                        onSelectNote={handleSelectNote}
                        onCreateNote={createNote}
                        onDeleteNote={deleteNote}
                        isMobile={isMobile}
                        onClose={() => setShowSidebar(false)}
                    />
                )}
                
                {(!isMobile || (isMobile && !showSidebar)) && (
                    <Editor 
                        note={selectedNote}
                        onUpdate={updateNote}
                        isMobile={isMobile}
                        onBack={handleBackToList}
                    />
                )}
            </div>
        </div>
    );
}

// Composant Header
function Header({ isOnline, stats, onSearch, searchTerm, showInstallPrompt, onInstall, isMobile, showSidebar, onToggleSidebar }) {
    return (
        <header style={styles.header}>
            <div style={styles.headerLeft}>
                {isMobile && (
                    <button 
                        onClick={onToggleSidebar}
                        style={styles.hamburger}
                        aria-label="Toggle menu"
                    >
                        {showSidebar ? '✕' : '☰'}
                    </button>
                )}
                <h1 style={{...styles.logo, fontSize: isMobile ? '1.3rem' : '1.8rem'}}>
                    <span style={styles.logoIcon}>{isMobile ? '📝' : '📝'}</span>
                    {!isMobile && 'NotesFlow'}
                </h1>
                {!isMobile && (
                    <div style={styles.statusBadge}>
                        <span style={{
                            ...styles.statusDot,
                            backgroundColor: isOnline ? '#2ecc71' : '#e74c3c'
                        }} />
                        {isOnline ? 'En ligne' : 'Hors ligne'}
                    </div>
                )}
            </div>
            
            {!isMobile && (
                <div style={styles.headerCenter}>
                    <input 
                        type="text"
                        placeholder="🔍 Rechercher..."
                        value={searchTerm}
                        onChange={(e) => onSearch(e.target.value)}
                        style={styles.searchInput}
                    />
                </div>
            )}
            
            <div style={styles.headerRight}>
                {!isMobile && (
                    <div style={styles.stats}>
                        <div style={styles.statItem}>
                            <span style={styles.statValue}>{stats.total}</span>
                            <span style={styles.statLabel}>notes</span>
                        </div>
                        <div style={styles.statDivider} />
                        <div style={styles.statItem}>
                            <span style={styles.statValue}>{stats.today}</span>
                            <span style={styles.statLabel}>aujourd'hui</span>
                        </div>
                    </div>
                )}
                
                {showInstallPrompt && (
                    <button onClick={onInstall} style={{...styles.installButton, fontSize: isMobile ? '0.8rem' : '0.9rem', padding: isMobile ? '0.5rem 0.8rem' : '0.6rem 1.2rem'}}>
                        {isMobile ? '📲' : '📲 Installer'}
                    </button>
                )}
                
                {!isMobile && (
                    <button 
                        onClick={() => {
                            console.log('=== DEBUG PWA ===');
                            console.log('deferredPrompt disponible:', !!window.deferredPrompt);
                            console.log('Service Worker enregistré:', 'serviceWorker' in navigator);
                            console.log('HTTPS actif:', window.location.protocol === 'https:' || window.location.hostname === 'localhost');
                            console.log('showInstallPrompt:', showInstallPrompt);
                            if (!window.deferredPrompt) {
                                alert('❌ Prompt d\'installation non disponible.\n\nRaisons possibles:\n- L\'app est déjà installée\n- Vous n\'êtes pas sur HTTPS/localhost\n- Le navigateur ne supporte pas l\'installation\n- Les critères PWA ne sont pas remplis');
                            } else {
                                alert('✅ Prompt d\'installation disponible!\nCliquez sur le bouton "📲 Installer"');
                            }
                        }}
                        style={{...styles.installButton, background: '#16213e', marginLeft: '0.5rem'}}
                        title="Vérifier le statut d'installation"
                    >
                        🔍 Debug
                    </button>
                )}
            </div>
        </header>
    );
}

// Composant Sidebar
function Sidebar({ notes, selectedNote, onSelectNote, onCreateNote, onDeleteNote, isMobile, onClose }) {
    return (
        <aside style={{
            ...styles.sidebar,
            width: isMobile ? '100%' : '350px',
            position: isMobile ? 'fixed' : 'relative',
            zIndex: isMobile ? 100 : 1,
            height: isMobile ? '100vh' : 'auto'
        }}>
            {isMobile && (
                <div style={styles.sidebarHeader}>
                    <h2 style={styles.sidebarTitle}>Mes Notes</h2>
                    <button onClick={onClose} style={styles.closeButton}>✕</button>
                </div>
            )}
            
            <button onClick={onCreateNote} style={{
                ...styles.createButton,
                margin: isMobile ? '1rem' : '1.5rem'
            }}>
                ✚ Nouvelle Note
            </button>
            
            <div style={styles.notesList}>
                {notes.length === 0 ? (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyIcon}>📭</div>
                        <p>Aucune note</p>
                        <p style={styles.emptySubtext}>Créez votre première note</p>
                    </div>
                ) : (
                    notes.map((note) => (
                        <NoteCard 
                            key={note.id}
                            note={note}
                            isSelected={selectedNote?.id === note.id}
                            onSelect={() => onSelectNote(note)}
                            onDelete={() => onDeleteNote(note.id)}
                        />
                    ))
                )}
            </div>
        </aside>
    );
}

// Composant NoteCard
function NoteCard({ note, isSelected, onSelect, onDelete }) {
    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'À l\'instant';
        if (minutes < 60) return `Il y a ${minutes}min`;
        if (hours < 24) return `Il y a ${hours}h`;
        if (days < 7) return `Il y a ${days}j`;
        
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        onDelete();
    };

    return (
        <div 
            style={{
                ...styles.noteCard,
                ...(isSelected ? styles.noteCardSelected : {})
            }}
            onClick={onSelect}
        >
            <div style={{...styles.noteColorBar, backgroundColor: note.color}} />
            
            <div style={styles.noteCardContent}>
                <h3 style={styles.noteCardTitle}>{note.title}</h3>
                <p style={styles.noteCardPreview}>
                    {note.content ? note.content.substring(0, 80) + '...' : 'Aucun contenu'}
                </p>
                <div style={styles.noteCardFooter}>
                    <span style={styles.noteCardDate}>{formatDate(note.updatedAt)}</span>
                    <button 
                        onClick={handleDelete}
                        style={styles.deleteButton}
                        title="Supprimer"
                    >
                        🗑️
                    </button>
                </div>
            </div>
        </div>
    );
}

// Composant Editor
function Editor({ note, onUpdate, isMobile, onBack }) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const timeoutRef = useRef(null);

    useEffect(() => {
        if (note) {
            setTitle(note.title);
            setContent(note.content);
        } else {
            setTitle('');
            setContent('');
        }
    }, [note]);

    const handleTitleChange = (e) => {
        const newTitle = e.target.value;
        setTitle(newTitle);
        
        if (note) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                onUpdate(note.id, { title: newTitle });
            }, 500);
        }
    };

    const handleContentChange = (e) => {
        const newContent = e.target.value;
        setContent(newContent);
        
        if (note) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                onUpdate(note.id, { content: newContent });
            }, 500);
        }
    };

    if (!note) {
        return (
            <main style={styles.editor}>
                <div style={styles.editorEmpty}>
                    <div style={styles.editorEmptyIcon}>✍️</div>
                    <h2 style={styles.editorEmptyTitle}>Sélectionnez une note</h2>
                    <p style={styles.editorEmptySubtext}>ou créez-en une nouvelle pour commencer</p>
                </div>
            </main>
        );
    }

    return (
        <main style={styles.editor}>
            <div style={{
                ...styles.editorHeader,
                padding: isMobile ? '1rem 1rem 0.5rem' : '2rem 3rem 1rem'
            }}>
                {isMobile && (
                    <button onClick={onBack} style={styles.backButton}>
                        ← Retour
                    </button>
                )}
                <input 
                    type="text"
                    value={title}
                    onChange={handleTitleChange}
                    placeholder="Titre de la note..."
                    style={{
                        ...styles.editorTitle,
                        fontSize: isMobile ? '1.5rem' : '2rem'
                    }}
                />
                <div style={styles.editorMeta}>
                    Modifiée: {new Date(note.updatedAt).toLocaleString('fr-FR')}
                </div>
            </div>
            
            <textarea 
                value={content}
                onChange={handleContentChange}
                placeholder="Commencez à écrire votre note..."
                style={{
                    ...styles.editorTextarea,
                    padding: isMobile ? '1rem' : '2rem 3rem',
                    fontSize: isMobile ? '0.95rem' : '1.05rem'
                }}
            />
            
            <div style={{
                ...styles.editorFooter,
                padding: isMobile ? '0.8rem 1rem' : '1rem 3rem'
            }}>
                <div style={styles.wordCount}>
                    {content.split(/\s+/).filter(w => w.length > 0).length} mots
                    {' · '}
                    {content.length} caractères
                </div>
            </div>
        </main>
    );
}

// ============================================
// STYLES
// ============================================
const styles = {
    app: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%)',
    },
    loading: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.5rem',
        color: '#f39c12',
    },
    loadingText: {
        animation: 'pulse 1.5s ease-in-out infinite',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 2rem',
        background: 'rgba(26, 26, 46, 0.8)',
        backdropFilter: 'blur(10px)',
        borderBottom: '2px solid #f39c12',
        boxShadow: '0 4px 20px rgba(243, 156, 18, 0.2)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
    },
    hamburger: {
        background: 'none',
        border: 'none',
        color: '#f39c12',
        fontSize: '1.8rem',
        cursor: 'pointer',
        padding: '0.5rem',
        marginRight: '0.5rem',
        lineHeight: 1,
    },
    sidebarHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 1.5rem',
        borderBottom: '2px solid rgba(243, 156, 18, 0.2)',
    },
    sidebarTitle: {
        fontSize: '1.3rem',
        fontWeight: 'bold',
        color: '#f39c12',
        margin: 0,
    },
    closeButton: {
        background: 'none',
        border: 'none',
        color: '#e74c3c',
        fontSize: '1.5rem',
        cursor: 'pointer',
        padding: '0.5rem',
        lineHeight: 1,
    },
    backButton: {
        background: 'none',
        border: '2px solid rgba(243, 156, 18, 0.5)',
        color: '#f39c12',
        padding: '0.5rem 1rem',
        borderRadius: '8px',
        cursor: 'pointer',
        marginBottom: '1rem',
        fontSize: '0.9rem',
        fontFamily: 'Courier New, monospace',
        transition: 'all 0.3s ease',
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        flex: 1,
    },
    headerCenter: {
        flex: 2,
        display: 'flex',
        justifyContent: 'center',
    },
    headerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flex: 1,
        justifyContent: 'flex-end',
    },
    logo: {
        fontSize: '1.8rem',
        fontWeight: 'bold',
        color: '#f39c12',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        textShadow: '0 0 10px rgba(243, 156, 18, 0.5)',
    },
    logoIcon: {
        fontSize: '2rem',
    },
    statusBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.4rem 0.8rem',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '20px',
        fontSize: '0.85rem',
        border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    statusDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        animation: 'pulse 2s ease-in-out infinite',
    },
    searchInput: {
        width: '100%',
        maxWidth: '500px',
        padding: '0.7rem 1.2rem',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '2px solid rgba(243, 156, 18, 0.3)',
        borderRadius: '25px',
        color: '#e8e8e8',
        fontSize: '0.95rem',
        outline: 'none',
        transition: 'all 0.3s ease',
        fontFamily: 'Courier New, monospace',
    },
    stats: {
        display: 'flex',
        gap: '1rem',
        alignItems: 'center',
        padding: '0.5rem 1rem',
        background: 'rgba(243, 156, 18, 0.1)',
        borderRadius: '10px',
        border: '1px solid rgba(243, 156, 18, 0.3)',
    },
    statItem: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    statValue: {
        fontSize: '1.2rem',
        fontWeight: 'bold',
        color: '#f39c12',
    },
    statLabel: {
        fontSize: '0.7rem',
        color: '#a0a0a0',
        textTransform: 'uppercase',
    },
    statDivider: {
        width: '1px',
        height: '30px',
        background: 'rgba(243, 156, 18, 0.3)',
    },
    installButton: {
        padding: '0.6rem 1.2rem',
        background: '#f39c12',
        color: '#0f0f1e',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '0.9rem',
        fontFamily: 'Courier New, monospace',
        transition: 'all 0.3s ease',
    },
    container: {
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
    },
    sidebar: {
        width: '350px',
        background: 'rgba(22, 33, 62, 0.6)',
        borderRight: '2px solid rgba(243, 156, 18, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'transform 0.3s ease',
    },
    createButton: {
        margin: '1.5rem',
        padding: '1rem',
        background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
        color: '#0f0f1e',
        border: 'none',
        borderRadius: '12px',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: 'bold',
        fontFamily: 'Courier New, monospace',
        boxShadow: '0 4px 15px rgba(243, 156, 18, 0.4)',
        transition: 'all 0.3s ease',
    },
    notesList: {
        flex: 1,
        overflowY: 'auto',
        padding: '0 1rem 1rem',
    },
    emptyState: {
        textAlign: 'center',
        padding: '3rem 1rem',
        color: '#a0a0a0',
    },
    emptyIcon: {
        fontSize: '4rem',
        marginBottom: '1rem',
    },
    emptySubtext: {
        fontSize: '0.85rem',
        marginTop: '0.5rem',
    },
    noteCard: {
        position: 'relative',
        background: 'rgba(26, 26, 46, 0.8)',
        border: '2px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        marginBottom: '1rem',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
    },
    noteCardSelected: {
        background: 'rgba(243, 156, 18, 0.15)',
        border: '2px solid #f39c12',
        transform: 'translateX(8px)',
    },
    noteColorBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '5px',
    },
    noteCardContent: {
        padding: '1rem 1rem 1rem 1.5rem',
    },
    noteCardTitle: {
        fontSize: '1.1rem',
        fontWeight: 'bold',
        marginBottom: '0.5rem',
        color: '#e8e8e8',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    noteCardPreview: {
        fontSize: '0.85rem',
        color: '#a0a0a0',
        marginBottom: '0.8rem',
        lineHeight: '1.4',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
    },
    noteCardFooter: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    noteCardDate: {
        fontSize: '0.75rem',
        color: '#666',
    },
    deleteButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '1.2rem',
        opacity: 0.6,
        transition: 'opacity 0.2s ease',
        padding: '0.2rem',
    },
    editor: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(15, 15, 30, 0.6)',
        position: 'relative',
    },
    editorEmpty: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        color: '#a0a0a0',
    },
    editorEmptyIcon: {
        fontSize: '5rem',
        marginBottom: '1rem',
        opacity: 0.5,
    },
    editorEmptyTitle: {
        fontSize: '1.5rem',
        marginBottom: '0.5rem',
        color: '#e8e8e8',
    },
    editorEmptySubtext: {
        fontSize: '0.95rem',
    },
    editorHeader: {
        padding: '2rem 3rem 1rem',
        borderBottom: '1px solid rgba(243, 156, 18, 0.2)',
    },
    editorTitle: {
        width: '100%',
        fontSize: '2rem',
        fontWeight: 'bold',
        color: '#f39c12',
        background: 'none',
        border: 'none',
        outline: 'none',
        marginBottom: '0.8rem',
        fontFamily: 'Courier New, monospace',
    },
    editorMeta: {
        fontSize: '0.8rem',
        color: '#666',
    },
    editorTextarea: {
        flex: 1,
        padding: '2rem 3rem',
        background: 'none',
        border: 'none',
        outline: 'none',
        color: '#e8e8e8',
        fontSize: '1.05rem',
        lineHeight: '1.8',
        resize: 'none',
        fontFamily: 'Courier New, monospace',
    },
    editorFooter: {
        padding: '1rem 3rem',
        borderTop: '1px solid rgba(243, 156, 18, 0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    wordCount: {
        fontSize: '0.85rem',
        color: '#666',
    },
};

// Rendu de l'application
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
