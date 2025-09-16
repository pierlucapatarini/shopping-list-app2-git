import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, setHours, setMinutes, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import it from 'date-fns/locale/it';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../styles/MainStyle.css';

const locales = { it };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });
const categories = ['LAVORO', 'CASA', 'FINANZA', 'STUDIO', 'SALUTE', 'FARMACO', 'ALTRO'];
const categoryColors = {
    'LAVORO': '#FF5733', 'CASA': '#337AFF', 'FINANZA': '#33FF57', 'STUDIO': '#9B33FF',
    'SALUTE': '#FF33A8', 'FARMACO': '#33FFF9', 'ALTRO': '#6c757d'
};

// Utility functions per le notifiche push
const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

// Sostituisci con la tua chiave VAPID pubblica reale
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

const CustomEventContent = ({ event }) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '2px', fontSize: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</strong>
            <span style={{ fontSize: '10px', marginLeft: '5px', whiteSpace: 'nowrap' }}>
                {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
            </span>
        </div>
        {event.description && (
            <div style={{ fontSize: '12px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {event.description}
            </div>
        )}
    </div>
);

const CustomToolbar = (toolbar) => (
    <div className="rbc-toolbar">
        <span className="rbc-btn-group">
            <button type="button" onClick={() => toolbar.onNavigate('TODAY')}>Oggi</button>
        </span>
        <span className="rbc-toolbar-label">
            <button type="button" onClick={() => toolbar.onNavigate('PREV')} className="rbc-btn-nav">
                <span className="rbc-icon">{'<'}</span>
            </button>
            <span className="toolbar-label-text">{toolbar.label}</span>
            <button type="button" onClick={() => toolbar.onNavigate('NEXT')} className="rbc-btn-nav">
                <span className="rbc-icon">{'>'}</span>
            </button>
        </span>
        <span className="rbc-btn-group">
            {['month', 'week', 'day', 'agenda'].map(v => (
                <button key={v} type="button" onClick={() => toolbar.onView(v)} className={toolbar.view === v ? 'active' : ''}>
                    {v === 'month' ? 'Mese' : v === 'week' ? 'Settimana' : v === 'day' ? 'Giorno' : 'Agenda'}
                </button>
            ))}
        </span>
    </div>
);

export default function Pagina6() {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [events, setEvents] = useState([]);
    const [familyUsers, setFamilyUsers] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState('month');
    
    // Stati per le notifiche push
    const [pushSupported, setPushSupported] = useState(false);
    const [pushSubscription, setPushSubscription] = useState(null);
    const [notificationPermission, setNotificationPermission] = useState('default');
    const [isLoadingNotification, setIsLoadingNotification] = useState(false);
    
    // Modal states
    const [modalData, setModalData] = useState(null);
    const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
    const [formData, setFormData] = useState({
        title: '', description: '', date: '', startTime: '', endTime: '',
        category: 'ALTRO', repeatPattern: 'nessuna', repeatEndDate: '',
        isNotificationEnabled: false, sendBefore: 1, selectedEmails: []
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const { data: profileData, error: profileError } = await supabase
                    .from('profiles').select('*').eq('id', session.user.id).single();
                if (profileError) throw profileError;
                setProfile(profileData);

                if (profileData.family_group) {
                    const [eventsResponse, usersResponse] = await Promise.all([
                        supabase.from('events').select('*').eq('family_group', profileData.family_group).order('start', { ascending: true }),
                        supabase.from('profiles').select('id, username, avatar, email').eq('family_group', profileData.family_group)
                    ]);

                    if (eventsResponse.data) {
                        setEvents(eventsResponse.data.map(e => ({ ...e, start: new Date(e.start), end: new Date(e.end) })));
                    }
                    if (usersResponse.data) setFamilyUsers(usersResponse.data);
                }
            } catch (err) {
                console.error("Errore caricamento dati:", err);
            }
        };
        
        // Inizializza le notifiche push
        initializePushNotifications();
        
        fetchData();
    }, []);

    const initializePushNotifications = async () => {
        console.log('Inizializzando notifiche push...');
        
        // Verifica supporto per le notifiche push
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setPushSupported(true);
            console.log('Push notifications supportate');
            
            try {
                // Registra il service worker se non è già registrato
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registrato:', registration);
                
                // Verifica stato attuale dei permessi
                const permission = Notification.permission;
                setNotificationPermission(permission);
                console.log('Permesso notifiche:', permission);
                
                // Se già autorizzato, sottoscrivi
                if (permission === 'granted') {
                    await subscribeUserToPush(registration);
                }
            } catch (error) {
                console.error('Errore registrazione Service Worker:', error);
            }
        } else {
            console.log('Push messaging non supportato dal browser');
            setPushSupported(false);
        }
    };

    const subscribeUserToPush = async (registration) => {
        console.log('Sottoscrivendo utente alle push notifications...');
        
        try {
            // Verifica se esiste già una subscription
            const existingSubscription = await registration.pushManager.getSubscription();
            
            if (existingSubscription) {
                console.log('Subscription esistente trovata:', existingSubscription);
                setPushSubscription(existingSubscription);
                
                // Verifica se dobbiamo aggiornare il database
                if (profile) {
                    await savePushSubscription(existingSubscription);
                }
                return;
            }

            // Crea nuova subscription
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
            
            console.log('Nuova subscription creata:', subscription);
            setPushSubscription(subscription);
            
            // Salva la subscription su Supabase
            if (profile) {
                await savePushSubscription(subscription);
            }
            
        } catch (error) {
            console.error('Errore sottoscrizione push:', error);
            
            // Gestisci errori specifici
            if (error.name === 'NotSupportedError') {
                alert('Le notifiche push non sono supportate su questo dispositivo/browser');
            } else if (error.name === 'NotAllowedError') {
                alert('Permessi per le notifiche negati. Puoi riattivarli dalle impostazioni del browser.');
            } else {
                alert('Errore nella registrazione delle notifiche: ' + error.message);
            }
        }
    };

    const savePushSubscription = async (subscription) => {
        if (!profile?.id || !profile?.family_group) {
            console.log('Profilo non ancora caricato, rimando il salvataggio subscription');
            return;
        }

        try {
            console.log('Salvando subscription nel database...');
            
            const subscriptionData = {
                user_id: profile.id,
                family_group: profile.family_group,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth
            };

            const { data, error } = await supabase
                .from('push_subscriptions')
                .upsert(subscriptionData, {
                    onConflict: 'user_id'
                })
                .select();
                
            if (error) {
                console.error('Errore salvataggio subscription:', error);
                throw error;
            }
            
            console.log('Push subscription salvata nel database:', data);
        } catch (error) {
            console.error('Errore salvataggio push subscription:', error);
            // Non bloccare l'app per questo errore
        }
    };

    // Effetto per salvare la subscription quando il profile viene caricato
    useEffect(() => {
        if (profile && pushSubscription && !pushSubscription.saved) {
            savePushSubscription(pushSubscription).then(() => {
                setPushSubscription(prev => ({ ...prev, saved: true }));
            });
        }
    }, [profile, pushSubscription]);

    const testPushNotification = async () => {
        if (!profile?.family_group) {
            alert('Profilo famiglia non trovato');
            return;
        }

        if (notificationPermission !== 'granted') {
            alert('Prima devi abilitare le notifiche');
            return;
        }

        setIsLoadingNotification(true);

        try {
            console.log('Inviando notifica di test...');
            
            const { data, error } = await supabase.functions.invoke('send-push-notification', {
                body: {
                    familyGroup: profile.family_group,
                    title: '🧪 Test Notifica Famiglia',
                    body: `Test inviato da ${profile.username || 'Utente'} - ${new Date().toLocaleTimeString()}`,
                    icon: '/icon-192.png',
                    badge: '/icon-72.png',
                    tag: 'test-notification',
                    data: {
                        type: 'test',
                        timestamp: new Date().toISOString(),
                        familyGroup: profile.family_group
                    }
                }
            });

            console.log('Risposta funzione push:', { data, error });

            if (error) throw error;
            
            alert(`Notifica di test inviata! Risultato: ${data.sent}/${data.total} membri raggiunti.`);
            
        } catch (error) {
            console.error('Errore invio notifica test:', error);
            alert(`Errore invio notifica: ${error.message}`);
        } finally {
            setIsLoadingNotification(false);
        }
    };

    const requestNotificationPermission = async () => {
        console.log('Richiedendo permessi notifiche...');
        
        try {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
            console.log('Permesso ricevuto:', permission);
            
            if (permission === 'granted') {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    await subscribeUserToPush(registration);
                }
            } else if (permission === 'denied') {
                alert('Permessi negati. Per abilitare le notifiche vai nelle impostazioni del browser.');
            }
        } catch (error) {
            console.error('Errore richiesta permessi:', error);
        }
    };

    const updateFormData = (updates) => setFormData(prev => ({ ...prev, ...updates }));

    const combineDateTime = (date, time) => {
        if (!date || !time) return null;
        const [hours, minutes] = time.split(':').map(Number);
        return setMinutes(setHours(new Date(date), hours), minutes);
    };

    const createRecurringSeries = async (options) => {
        const { startDateTime, endDateTime, duration, repeatPattern, repeatEndDate } = options;
        
        if (repeatPattern === 'nessuna') return null;
        if (!repeatEndDate || new Date(repeatEndDate) < startDateTime) {
            throw new Error('La data di fine ripetizione non è valida');
        }

        let eventsToInsert = [];
        let currentStart = new Date(startDateTime);
        const finalEndDate = addDays(new Date(repeatEndDate), 1);
        const incrementFunctions = {
            daily: (d) => addDays(d, 1),
            weekly: (d) => addWeeks(d, 1),
            monthly: (d) => addMonths(d, 1),
            annually: (d) => addYears(d, 1)
        };

        while (currentStart < finalEndDate && eventsToInsert.length < 1000) {
            eventsToInsert.push({
                ...options.baseEvent,
                start: currentStart.toISOString(),
                end: new Date(currentStart.getTime() + duration).toISOString(),
                family_group: options.familyGroup,
                created_by: options.createdBy,
                repeat_pattern: repeatPattern,
                recurrence_id: options.recurrenceId,
            });
            currentStart = incrementFunctions[repeatPattern](currentStart);
        }

        return eventsToInsert;
    };

    const handleSaveEvent = async (e) => {
        e.preventDefault();
        if (!profile?.family_group) return;

        const startDateTime = combineDateTime(formData.date, formData.startTime);
        const endDateTime = combineDateTime(formData.date, formData.endTime);
        if (!startDateTime || !endDateTime || endDateTime <= startDateTime) {
            alert('Date e orari non validi');
            return;
        }

        const baseEvent = {
            title: formData.title,
            description: formData.description,
            categoria_eve: formData.category,
            notify_at: formData.isNotificationEnabled ? 
                new Date(startDateTime.getTime() - formData.sendBefore * 60 * 60 * 1000).toISOString() : null,
            notify_emails: formData.isNotificationEnabled ? formData.selectedEmails : [],
            push_notification_enabled: formData.isNotificationEnabled, // Nuovo campo per push notifications
        };

        try {
            if (formData.repeatPattern === 'nessuna') {
                // Single event
                const eventData = {
                    ...baseEvent,
                    start: startDateTime.toISOString(),
                    end: endDateTime.toISOString(),
                    family_group: profile.family_group,
                    created_by: profile.id,
                    repeat_pattern: null,
                    recurrence_id: null,
                };

                const { data, error } = modalData?.id 
                    ? await supabase.from('events').update(eventData).eq('id', modalData.id).select()
                    : await supabase.from('events').insert([eventData]).select();

                if (error) throw error;
                if (data?.length) {
                    const savedEvent = { ...data[0], start: new Date(data[0].start), end: new Date(data[0].end) };
                    setEvents(prev => [...prev.filter(ev => ev.id !== savedEvent.id), savedEvent]);
                    
                    // Se è un nuovo evento con notifiche abilitate, mostra messaggio
                    if (!modalData?.id && formData.isNotificationEnabled) {
                        alert('Evento salvato! Le notifiche push saranno inviate automaticamente all\'orario stabilito.');
                    }
                }
            } else {
                // Recurring events
                const recurrenceId = uuidv4();
                const eventsToInsert = await createRecurringSeries({
                    baseEvent,
                    startDateTime,
                    endDateTime,
                    duration: endDateTime.getTime() - startDateTime.getTime(),
                    repeatPattern: formData.repeatPattern,
                    repeatEndDate: formData.repeatEndDate,
                    recurrenceId,
                    familyGroup: profile.family_group,
                    createdBy: profile.id,
                });

                if (!eventsToInsert?.length) throw new Error('Nessun evento da creare');

                // Delete old series if updating
                if (modalData?.recurrence_id) {
                    await supabase.from('events').delete().eq('recurrence_id', modalData.recurrence_id);
                }

                const { data, error } = await supabase.from('events').insert(eventsToInsert).select();
                if (error) throw error;

                const savedEvents = data.map(e => ({ ...e, start: new Date(e.start), end: new Date(e.end) }));
                setEvents(prev => {
                    const filtered = modalData?.recurrence_id 
                        ? prev.filter(ev => ev.recurrence_id !== modalData.recurrence_id)
                        : prev;
                    return [...filtered, ...savedEvents];
                });

                if (formData.isNotificationEnabled) {
                    alert(`Serie di eventi salvata! ${savedEvents.length} notifiche push programmate.`);
                }
            }
            setModalData(null);
        } catch (err) {
            console.error('Errore salvataggio:', err);
            alert(`Errore: ${err.message}`);
        }
    };

    const resetForm = (date = new Date()) => {
        const now = new Date();
        setFormData({
            title: '', description: '', date: format(date, 'yyyy-MM-dd'),
            startTime: format(now, 'HH:mm'), endTime: format(setHours(now, now.getHours() + 1), 'HH:mm'),
            category: 'ALTRO', repeatPattern: 'nessuna', repeatEndDate: '',
            isNotificationEnabled: false, sendBefore: 1, selectedEmails: []
        });
    };

    const handleSelectSlot = ({ start }) => {
        setModalData({ date: start });
        resetForm(start);
    };

    const handleSelectEvent = (event) => {
        if (event.repeat_pattern) {
            setShowRecurrenceModal(true);
            setModalData(event);
        } else {
            openEventModal(event);
        }
    };

    const openEventModal = (event, isRecurring = false) => {
        setModalData(event);
        setFormData({
            title: event.title || '',
            description: event.description || '',
            date: format(event.start, 'yyyy-MM-dd'),
            startTime: format(event.start, 'HH:mm'),
            endTime: format(event.end, 'HH:mm'),
            category: event.categoria_eve || 'ALTRO',
            selectedEmails: event.notify_emails || [],
            sendBefore: event.notify_at ? Math.round((event.start - new Date(event.notify_at)) / (1000 * 60 * 60)) : 1,
            isNotificationEnabled: !!(event.notify_at || event.push_notification_enabled),
            repeatPattern: isRecurring ? event.repeat_pattern : 'nessuna',
            repeatEndDate: isRecurring ? format(
                events.filter(e => e.recurrence_id === event.recurrence_id)
                    .sort((a, b) => b.end - a.end)[0]?.end || event.end, 
                'yyyy-MM-dd'
            ) : ''
        });
        setShowRecurrenceModal(false);
    };

    const handleDeleteEvent = async (mode = 'single') => {
        if (!modalData?.id) return;
        
        const { error } = mode === 'all' && modalData.recurrence_id
            ? await supabase.from('events').delete().eq('recurrence_id', modalData.recurrence_id)
            : await supabase.from('events').delete().eq('id', modalData.id);

        if (!error) {
            setEvents(prev => mode === 'all' && modalData.recurrence_id
                ? prev.filter(ev => ev.recurrence_id !== modalData.recurrence_id)
                : prev.filter(ev => ev.id !== modalData.id)
            );
        }
        setModalData(null);
        setShowRecurrenceModal(false);
    };

    const eventStyleGetter = (event) => ({
        style: {
            backgroundColor: categoryColors[event.categoria_eve] || '#2196f3',
            color: 'white', borderRadius: '8px', border: 'none', padding: '4px 8px',
            whiteSpace: 'pre-wrap', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', fontSize: '14px'
        }
    });

    const getNotificationStatusIcon = () => {
        if (!pushSupported) return '❌';
        if (notificationPermission === 'granted') return '✅';
        if (notificationPermission === 'denied') return '🚫';
        return '⏳';
    };

    const getNotificationStatusText = () => {
        if (!pushSupported) return 'Non supportate';
        if (notificationPermission === 'granted') return 'Attive';
        if (notificationPermission === 'denied') return 'Negate';
        return 'In attesa';
    };

    return (
        <div className="app-layout">
            <div className="header">
                <h1>📅 Calendario Famiglia</h1>
                <p>Organizza gli appuntamenti del tuo gruppo famiglia!</p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button onClick={() => navigate('/main-menu')} className="btn-secondary">
                        Menu Principale
                    </button>
                    
                    {/* Sezione Notifiche Push */}
                    {pushSupported && (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                            {notificationPermission !== 'granted' ? (
                                <button 
                                    onClick={requestNotificationPermission} 
                                    className="btn-warning"
                                    style={{ fontSize: '14px', padding: '6px 12px' }}
                                >
                                    🔔 Abilita Notifiche
                                </button>
                            ) : (
                                <button 
                                    onClick={testPushNotification} 
                                    className="btn-success"
                                    disabled={isLoadingNotification}
                                    style={{ fontSize: '14px', padding: '6px 12px' }}
                                >
                                    {isLoadingNotification ? '⏳ Invio...' : '🧪 Test Notifica Push'}
                                </button>
                            )}
                            
                            <span style={{ 
                                fontSize: '12px', 
                                color: '#666', 
                                backgroundColor: '#f8f9fa', 
                                padding: '4px 8px', 
                                borderRadius: '4px',
                                border: '1px solid #dee2e6'
                            }}>
                                {getNotificationStatusIcon()} {getNotificationStatusText()}
                            </span>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="main-content">
                <div className="info-box">
                    <h2>Gestisci gli Eventi</h2>
                    <p>Clicca su una data o su un evento per gestirlo.</p>
                    {pushSupported && notificationPermission === 'granted' && (
                        <p style={{ color: '#28a745', fontSize: '14px', margin: '8px 0 0 0' }}>
                            🔔 Le notifiche push sono attive per questo dispositivo
                        </p>
                    )}
                    {!pushSupported && (
                        <p style={{ color: '#dc3545', fontSize: '14px', margin: '8px 0 0 0' }}>
                            ⚠️ Le notifiche push non sono supportate su questo browser/dispositivo
                        </p>
                    )}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                    <button className="btn-primary" onClick={() => { setModalData({ date: new Date() }); resetForm(); }}>
                        + Nuovo Evento
                    </button>
                </div>
                
                <div className="calendar-wrapper">
                    {profile ? (
                        <Calendar
                            localizer={localizer} 
                            events={events} 
                            culture="it"
                            startAccessor="start" 
                            endAccessor="end" 
                            style={{ height: 600 }} 
                            selectable
                            views={["month", "week", "day", "agenda"]} 
                            view={view} 
                            onView={setView}
                            date={currentDate} 
                            onNavigate={setCurrentDate}
                            onSelectSlot={handleSelectSlot} 
                            onSelectEvent={handleSelectEvent}
                            eventPropGetter={eventStyleGetter}
                            components={{ event: CustomEventContent, toolbar: CustomToolbar }}
                            messages={{
                                today: 'Oggi', previous: 'Precedente', next: 'Successivo',
                                month: 'Mese', week: 'Settimana', day: 'Giorno', agenda: 'Agenda'
                            }}
                        />
                    ) : (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <p>Caricamento del profilo in corso...</p>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="footer">
                <p>&copy; 2024 Gruppo Famiglia. Tutti i diritti riservati.</p>
            </div>

            {/* Recurrence Modal */}
            {showRecurrenceModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Gestisci Evento Ricorrente</h2>
                            <button className="modal-close-btn" onClick={() => { setShowRecurrenceModal(false); setModalData(null); }}>&times;</button>
                        </div>
                        <p>Questo evento fa parte di una serie. Come vuoi procedere?</p>
                        <div className="modal-actions">
                            <button className="btn-primary" onClick={() => openEventModal(modalData, false)}>Modifica Solo Questo</button>
                            <button className="btn-primary" onClick={() => openEventModal(modalData, true)}>Modifica Tutta la Serie</button>
                            <button className="btn-delete" onClick={() => handleDeleteEvent('single')}>Elimina Solo Questo</button>
                            <button className="btn-delete" onClick={() => handleDeleteEvent('all')}>Elimina Tutta la Serie</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Event Modal */}
            {modalData && !showRecurrenceModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>{modalData?.id ? 'Modifica Evento' : 'Aggiungi Nuovo Evento'}</h2>
                            <button className="modal-close-btn" onClick={() => setModalData(null)}>&times;</button>
                        </div>
                        <form onSubmit={handleSaveEvent}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Titolo:</label>
                                    <input type="text" className="search-input" value={formData.title} onChange={(e) => updateFormData({ title: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>Descrizione:</label>
                                    <textarea className="search-input" value={formData.description} onChange={(e) => updateFormData({ description: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Data:</label>
                                    <input type="date" className="search-input" value={formData.date} onChange={(e) => updateFormData({ date: e.target.value })} required />
                                </div>
                                <div className="form-group form-group-time">
                                    <label>Ora Inizio:</label>
                                    <input type="time" className="search-input" value={formData.startTime} onChange={(e) => updateFormData({ startTime: e.target.value })} required />
                                </div>
                                <div className="form-group form-group-time">
                                    <label>Ora Fine:</label>
                                    <input type="time" className="search-input" value={formData.endTime} onChange={(e) => updateFormData({ endTime: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>Categoria:</label>
                                    <select className="search-input" value={formData.category} onChange={(e) => updateFormData({ category: e.target.value })}>
                                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>
                                
                                {(!modalData?.id || modalData?.repeat_pattern) && (
                                    <>
                                        <div className="form-group">
                                            <label>Ripetizione:</label>
                                            <select className="search-input" value={formData.repeatPattern} onChange={(e) => updateFormData({ repeatPattern: e.target.value })}>
                                                <option value="nessuna">Nessuna</option>
                                                <option value="daily">Giornaliera</option>
                                                <option value="weekly">Settimanale</option>
                                                <option value="monthly">Mensile</option>
                                                <option value="annually">Annuale</option>
                                            </select>
                                        </div>
                                        {formData.repeatPattern !== 'nessuna' && (
                                            <div className="form-group">
                                                <label>Fine Ripetizione:</label>
                                                <input type="date" className="search-input" value={formData.repeatEndDate} 
                                                    onChange={(e) => updateFormData({ repeatEndDate: e.target.value })} required />
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className="form-group notification-toggle">
                                    <label>
                                        <input type="checkbox" checked={formData.isNotificationEnabled}
                                            onChange={(e) => updateFormData({ isNotificationEnabled: e.target.checked })} />
                                        Attiva Notifiche Push
                                        {!pushSupported && <span style={{color: '#dc3545', fontSize: '12px', marginLeft: '8px'}}>(Non supportate su questo dispositivo)</span>}
                                        {pushSupported && notificationPermission !== 'granted' && <span style={{color: '#ffc107', fontSize: '12px', marginLeft: '8px'}}>(Devi abilitare i permessi)</span>}
                                    </label>
                                </div>

                                {formData.isNotificationEnabled && (
                                    <div className="notification-container">
                                        <div className="form-group">
                                            <label>Notifica (ore prima dell'evento):</label>
                                            <select className="search-input" value={formData.sendBefore}
                                                onChange={(e) => updateFormData({ sendBefore: parseInt(e.target.value) })}>
                                                <option value={0.5}>30 minuti prima</option>
                                                <option value={1}>1 ora prima</option>
                                                <option value={2}>2 ore prima</option>
                                                <option value={6}>6 ore prima</option>
                                                <option value={12}>12 ore prima</option>
                                                <option value={24}>1 giorno prima</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Invia notifica push a tutti i membri della famiglia:</label>
                                            <div className="family-users-list">
                                                {familyUsers.map(user => (
                                                    <label key={user.id} className="checkbox-label">
                                                        <input type="checkbox" className="custom-checkbox" checked={formData.selectedEmails.includes(user.email)}
                                                            onChange={() => updateFormData({
                                                                selectedEmails: formData.selectedEmails.includes(user.email)
                                                                    ? formData.selectedEmails.filter(e => e !== user.email)
                                                                    : [...formData.selectedEmails, user.email]
                                                            })} />
                                                        <span className="family-username">
                                                            {user.username}
                                                            {user.id === profile?.id && ' (tu)'}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                            {formData.selectedEmails.length === 0 && formData.isNotificationEnabled && (
                                                <p style={{ color: '#dc3545', fontSize: '12px', margin: '8px 0 0 0' }}>
                                                    ⚠️ Seleziona almeno un membro per ricevere le notifiche
                                                </p>
                                            )}
                                        </div>
                                        
                                        {pushSupported && notificationPermission === 'granted' && (
                                            <div style={{ 
                                                backgroundColor: '#d4edda', 
                                                border: '1px solid #c3e6cb', 
                                                borderRadius: '4px', 
                                                padding: '8px 12px', 
                                                fontSize: '12px', 
                                                color: '#155724',
                                                marginTop: '10px'
                                            }}>
                                                ✅ Le notifiche push saranno inviate automaticamente all'orario stabilito
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                {modalData?.id && (
                                    <button type="button" className="btn-delete" onClick={() => handleDeleteEvent()}>Elimina</button>
                                )}
                                <button 
                                    type="submit" 
                                    className="btn-primary" 
                                    disabled={!profile || (formData.isNotificationEnabled && formData.selectedEmails.length === 0)}
                                >
                                    Salva Evento
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );