import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, setHours, setMinutes, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import it from 'date-fns/locale/it';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../styles/archivio.css';

const locales = { it };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// Componente per il contenuto dell'evento nel calendario
const CustomEventContent = ({ event }) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            padding: '2px',
            fontSize: '14px',
        }}>
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
};

// Componente per la toolbar personalizzata
const CustomToolbar = (toolbar) => {
    const goToBack = () => {
        toolbar.onNavigate('PREV');
    };
    const goToNext = () => {
        toolbar.onNavigate('NEXT');
    };
    const goToToday = () => {
        toolbar.onNavigate('TODAY');
    };

    return (
        <div className="rbc-toolbar">
            <span className="rbc-btn-group">
                <button type="button" onClick={goToToday}>Oggi</button>
            </span>
            <span className="rbc-toolbar-label">
                <button type="button" onClick={goToBack} className="rbc-btn-nav">
                    <span className="rbc-icon">{'<'}</span>
                </button>
                <span className="toolbar-label-text">{toolbar.label}</span>
                <button type="button" onClick={goToNext} className="rbc-btn-nav">
                    <span className="rbc-icon">{'>'}</span>
                </button>
            </span>
            <span className="rbc-btn-group">
                <button type="button" onClick={() => toolbar.onView('month')} className={toolbar.view === 'month' ? 'active' : ''}>Mese</button>
                <button type="button" onClick={() => toolbar.onView('week')} className={toolbar.view === 'week' ? 'active' : ''}>Settimana</button>
                <button type="button" onClick={() => toolbar.onView('day')} className={toolbar.view === 'day' ? 'active' : ''}>Giorno</button>
                <button type="button" onClick={() => toolbar.onView('agenda')} className={toolbar.view === 'agenda' ? 'active' : ''}>Agenda</button>
            </span>
        </div>
    );
};

export default function Pagina6() {
    const [profile, setProfile] = useState(null);
    const [events, setEvents] = useState([]);
    const [modalData, setModalData] = useState(null);
    const [modalTitle, setModalTitle] = useState('');
    const [modalDescription, setModalDescription] = useState('');
    const [modalDate, setModalDate] = useState('');
    const [modalStartTime, setModalStartTime] = useState('');
    const [modalEndTime, setModalEndTime] = useState('');
    const [modalCategory, setModalCategory] = useState('ALTRO');
    const [sendBefore, setSendBefore] = useState(1);
    const [familyUsers, setFamilyUsers] = useState([]);
    const [selectedEmails, setSelectedEmails] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState('month');
    const [repeatPattern, setRepeatPattern] = useState('nessuna');
    const [repeatEndDate, setRepeatEndDate] = useState('');
    const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
    const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);

    const navigate = useNavigate();
    const categories = ['LAVORO', 'CASA', 'FINANZA', 'STUDIO', 'SALUTE', 'FARMACO', 'ALTRO'];

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                if (profileError) throw profileError;
                setProfile(profileData);

                if (profileData.family_group) {
                    const { data: eventsData, error: eventsError } = await supabase
                        .from('events')
                        .select('*')
                        .eq('family_group', profileData.family_group)
                        .order('start', { ascending: true });

                    if (!eventsError && eventsData) {
                        setEvents(eventsData.map(e => ({
                            ...e,
                            start: new Date(e.start),
                            end: new Date(e.end),
                        })));
                    }

                    const { data: usersData, error: usersError } = await supabase
                        .from('profiles')
                        .select('id, username, avatar, email')
                        .eq('family_group', profileData.family_group);

                    if (!usersError && usersData) setFamilyUsers(usersData);
                }
            } catch (err) {
                console.error("Errore caricamento dati:", err);
            }
        };
        fetchData();
    }, []);

    const combineDateTime = (date, time) => {
        if (!date || !time) return null;
        const [hours, minutes] = time.split(':').map(Number);
        const newDate = new Date(date);
        return setMinutes(setHours(newDate, hours), minutes);
    };

    const createOrUpdateSeries = async (options) => {
        const { recurrenceId, title, description, category, repeatPattern, repeatEndDate,
            isNotificationEnabled, sendBefore, selectedEmails, familyGroup, createdBy,
            modalDate, modalStartTime, modalEndTime } = options;

        try {
            const startDateTime = combineDateTime(modalDate, modalStartTime);
            const endDateTime = combineDateTime(modalDate, modalEndTime);

            if (!startDateTime || !endDateTime) {
                throw new Error('Date e orari non validi');
            }

            const duration = endDateTime.getTime() - startDateTime.getTime();

            if (duration <= 0) {
                throw new Error('L\'orario di fine deve essere successivo a quello di inizio');
            }

            // Validazione data di fine
            if (repeatPattern !== 'nessuna' && (!repeatEndDate || new Date(repeatEndDate) < startDateTime)) {
                throw new Error('La data di fine ripetizione non è valida o è precedente alla data di inizio.');
            }

            const baseEvent = {
                title: title,
                description: description,
                categoria_eve: category,
                notify_at: isNotificationEnabled ? new Date(startDateTime.getTime() - sendBefore * 60 * 60 * 1000).toISOString() : null,
                notify_emails: isNotificationEnabled ? selectedEmails : [],
            };

            let eventsToInsert = [];
            let currentStart = new Date(startDateTime);

            // Correzione: Aggiungi un giorno alla data di fine per includerla nel ciclo
            let finalEndDate = addDays(new Date(repeatEndDate), 1);

            let iterationCount = 0;
            const maxIterations = 1000; // Previeni loop infiniti

            while (currentStart.getTime() < finalEndDate.getTime() && iterationCount < maxIterations) {
                let currentEnd = new Date(currentStart.getTime() + duration);

                eventsToInsert.push({
                    ...baseEvent,
                    start: currentStart.toISOString(),
                    end: currentEnd.toISOString(),
                    family_group: familyGroup,
                    created_by: createdBy,
                    repeat_pattern: repeatPattern,
                    recurrence_id: recurrenceId,
                });

                // Calcola la prossima occorrenza
                if (repeatPattern === 'daily') {
                    currentStart = addDays(currentStart, 1);
                } else if (repeatPattern === 'weekly') {
                    currentStart = addWeeks(currentStart, 1);
                } else if (repeatPattern === 'monthly') {
                    currentStart = addMonths(currentStart, 1);
                } else if (repeatPattern === 'annually') {
                    currentStart = addYears(currentStart, 1);
                } else {
                    break;
                }

                iterationCount++;
            }

            if (iterationCount >= maxIterations) {
                throw new Error('Troppi eventi da creare. Riduci il periodo di ripetizione.');
            }

            if (eventsToInsert.length === 0) {
                throw new Error('Nessun evento da creare con i parametri specificati');
            }

            console.log(`Creazione di ${eventsToInsert.length} eventi ricorrenti`);

            const { data, error } = await supabase.from('events').insert(eventsToInsert).select();

            if (error) {
                console.error('Errore database durante creazione serie:', error);
                throw error;
            }

            console.log('Serie creata con successo:', data.length, 'eventi inseriti');
            return data;

        } catch (error) {
            console.error('Errore in createOrUpdateSeries:', error.message);
            throw error;
        }
    };

    const handleSaveEvent = async (e) => {
        e.preventDefault();
        if (!profile || !profile.family_group) return;

        const startDateTime = combineDateTime(modalDate, modalStartTime);
        const endDateTime = combineDateTime(modalDate, modalEndTime);

        const baseEvent = {
            title: modalTitle,
            description: modalDescription,
            categoria_eve: modalCategory,
            notify_at: isNotificationEnabled ? new Date(startDateTime.getTime() - sendBefore * 60 * 60 * 1000).toISOString() : null,
            notify_emails: isNotificationEnabled ? selectedEmails : [],
        };

        try {
            if (repeatPattern === 'nessuna') {
                // Gestione evento singolo
                let response;
                if (!modalData?.id) {
                    response = await supabase.from('events').insert([{
                        ...baseEvent,
                        start: startDateTime.toISOString(),
                        end: endDateTime.toISOString(),
                        family_group: profile.family_group,
                        created_by: profile.id,
                        repeat_pattern: null,
                        recurrence_id: null,
                    }]).select();
                } else {
                    response = await supabase.from('events').update({
                        ...baseEvent,
                        start: startDateTime.toISOString(),
                        end: endDateTime.toISOString(),
                        repeat_pattern: null,
                        recurrence_id: null,
                    }).eq('id', modalData.id).select();
                }

                const { data, error } = response;
                if (error) throw error;

                if (data && data.length > 0) {
                    const savedEvent = { ...data[0], start: new Date(data[0].start), end: new Date(data[0].end)};
                    setEvents(prev => {
                        const filtered = prev.filter(ev => ev.id !== savedEvent.id);
                        return [...filtered, savedEvent];
                    });
                }
            } else {
                // Gestione evento ricorrente
                const oldRecurrenceId = modalData?.recurrence_id;
                const newRecurrenceId = uuidv4();

                const options = {
                    recurrenceId: newRecurrenceId,
                    title: modalTitle,
                    description: modalDescription,
                    category: modalCategory,
                    repeatPattern: repeatPattern,
                    repeatEndDate: repeatEndDate,
                    isNotificationEnabled,
                    sendBefore,
                    selectedEmails,
                    familyGroup: profile.family_group,
                    createdBy: profile.id,
                    modalDate,
                    modalStartTime,
                    modalEndTime
                };

                const newEventsData = await createOrUpdateSeries(options);

                if (newEventsData && newEventsData.length > 0) {
                    console.log('Nuova serie creata con successo:', newEventsData.length, 'eventi');

                    if (oldRecurrenceId) {
                        console.log('Eliminazione serie precedente con ID:', oldRecurrenceId);
                        const { error: deleteError } = await supabase
                            .from('events')
                            .delete()
                            .eq('recurrence_id', oldRecurrenceId);

                        if (deleteError) {
                            console.error('Errore eliminazione serie precedente:', deleteError);
                        }
                    }

                    const savedEvents = newEventsData.map(e => ({
                        ...e,
                        start: new Date(e.start),
                        end: new Date(e.end)
                    }));

                    setEvents(prev => {
                        let filtered = prev;
                        if (oldRecurrenceId) {
                            filtered = prev.filter(ev => ev.recurrence_id !== oldRecurrenceId);
                        }
                        return [...filtered, ...savedEvents];
                    });

                    console.log('Serie aggiornata con successo nel calendario');
                } else {
                    throw new Error('Errore nella creazione della nuova serie di eventi');
                }
            }

            setModalData(null);

        } catch (err) {
            console.error('Errore durante il salvataggio/aggiornamento dell\'evento:', err);
            alert('Errore durante il salvataggio dell\'evento. Riprova. Dettagli: ' + err.message);
        }
    };

    const handleDeleteRecurrence = async (mode) => {
        if (!modalData?.id) return;

        let error;
        if (mode === 'single') {
            ({ error } = await supabase.from('events').delete().eq('id', modalData.id));
            if (!error) {
                setEvents(prev => prev.filter(ev => ev.id !== modalData.id));
            }
        } else if (mode === 'all') {
            ({ error } = await supabase.from('events').delete().eq('recurrence_id', modalData.recurrence_id));
            if (!error) {
                setEvents(prev => prev.filter(ev => ev.recurrence_id !== modalData.recurrence_id));
            }
        }

        if (error) console.error('Error deleting event:', error);
        setShowRecurrenceModal(false);
        setModalData(null);
    };

    const handleSelectSlot = ({ start }) => {
        handleNewEvent(start);
    };

    const handleNewEvent = (date = new Date()) => {
        const now = new Date();
        const eventDate = new Date(date);
        setModalData({ date: eventDate });
        setModalTitle('');
        setModalDescription('');
        setModalDate(format(eventDate, 'yyyy-MM-dd'));
        setModalStartTime(format(now, 'HH:mm'));
        setModalEndTime(format(setHours(now, now.getHours() + 1), 'HH:mm'));
        setModalCategory('ALTRO');
        setSelectedEmails([]);
        setSendBefore(1);
        setRepeatPattern('nessuna');
        setRepeatEndDate('');
        setIsNotificationEnabled(false);
    };

    const handleSelectEvent = (event) => {
        setModalData({ ...event });
        setModalTitle(event.title || '');
        setModalDescription(event.description || '');
        setModalDate(format(event.start, 'yyyy-MM-dd'));
        setModalStartTime(format(event.start, 'HH:mm'));
        setModalEndTime(format(event.end, 'HH:mm'));
        setModalCategory(event.categoria_eve || 'ALTRO');
        setSelectedEmails(event.notify_emails || []);
        setSendBefore(event.notify_at ?
            Math.round((new Date(event.start) - new Date(event.notify_at)) / (1000 * 60 * 60))
            : 1);
        setIsNotificationEnabled(event.notify_at !== null);

        if (event.repeat_pattern) {
            setShowRecurrenceModal(true);
        }
    };

    const handleModifySeriesClick = () => {
        setModalTitle(modalData.title);
        setModalDescription(modalData.description);
        setModalDate(format(modalData.start, 'yyyy-MM-dd'));
        setModalStartTime(format(modalData.start, 'HH:mm'));
        setModalEndTime(format(modalData.end, 'HH:mm'));
        setModalCategory(modalData.categoria_eve);
        setSelectedEmails(modalData.notify_emails);
        setSendBefore(modalData.notify_at ? Math.round((new Date(modalData.start) - new Date(modalData.notify_at)) / (1000 * 60 * 60)) : 1);
        setIsNotificationEnabled(modalData.notify_at !== null);
        setRepeatPattern(modalData.repeat_pattern);

        const lastEventInSeries = events
            .filter(e => e.recurrence_id === modalData.recurrence_id)
            .sort((a, b) => b.end - a.end)[0];

        if (lastEventInSeries) {
            setRepeatEndDate(format(lastEventInSeries.end, 'yyyy-MM-dd'));
        } else {
            setRepeatEndDate('');
        }

        setShowRecurrenceModal(false);
    };

    const handleModifySingleClick = () => {
        setModalTitle(modalData.title);
        setModalDescription(modalData.description);
        setModalDate(format(modalData.start, 'yyyy-MM-dd'));
        setModalStartTime(format(modalData.start, 'HH:mm'));
        setModalEndTime(format(modalData.end, 'HH:mm'));
        setModalCategory(modalData.categoria_eve);
        setSelectedEmails(modalData.notify_emails);
        setSendBefore(modalData.notify_at ? Math.round((new Date(modalData.start) - new Date(modalData.notify_at)) / (1000 * 60 * 60)) : 1);
        setIsNotificationEnabled(modalData.notify_at !== null);
        setRepeatPattern('nessuna');
        setRepeatEndDate('');
        setShowRecurrenceModal(false);
    };

    const eventStyleGetter = (event) => {
        const categoryColors = {
            'LAVORO': '#FF5733',
            'CASA': '#337AFF',
            'FINANZA': '#33FF57',
            'STUDIO': '#9B33FF',
            'SALUTE': '#FF33A8',
            'FARMACO': '#33FFF9',
            'ALTRO': '#6c757d',
        };
        return {
            style: {
                backgroundColor: categoryColors[event.categoria_eve] || '#2196f3',
                color: 'white',
                borderRadius: '8px',
                border: 'none',
                padding: '4px 8px',
                whiteSpace: 'pre-wrap',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                fontSize: '14px',
            }
        };
    };

    return (
        <div className="archivio-container">
            <h1 className="title">📅 Calendario Famiglia</h1>
            <div className="button-container">
                <button className="main-menu-btn" onClick={() => navigate('/main-menu')}>
                    Torna al Menu Principale
                </button>
                <button className="new-event-btn" onClick={() => handleNewEvent()}>
                    Nuovo Evento
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
                        onNavigate={date => setCurrentDate(date)}
                        onSelectSlot={handleSelectSlot}
                        onSelectEvent={handleSelectEvent}
                        eventPropGetter={eventStyleGetter}
                        components={{
                            event: CustomEventContent,
                            toolbar: CustomToolbar,
                        }}
                        messages={{
                            today: 'Oggi',
                            previous: 'Precedente',
                            next: 'Successivo',
                            month: 'Mese',
                            week: 'Settimana',
                            day: 'Giorno',
                            agenda: 'Agenda'
                        }}
                    />
                ) : (
                    <p>Caricamento del profilo in corso...</p>
                )}
            </div>

            {showRecurrenceModal && (
                <div className="modal-overlay">
                    <div className="modal-content recurrence-modal">
                        <h2>Gestisci Evento Ricorrente</h2>
                        <p>Questo evento fa parte di una serie. Come vuoi procedere?</p>
                        <div className="modal-actions">
                            <button className="btn btn-save" onClick={handleModifySingleClick}>Modifica Solo Questo</button>
                            <button className="btn btn-save" onClick={handleModifySeriesClick}>Modifica Tutta la Serie</button>
                            <button className="btn btn-delete" onClick={() => handleDeleteRecurrence('single')}>Elimina Solo Questo</button>
                            <button className="btn btn-delete" onClick={() => handleDeleteRecurrence('all')}>Elimina Tutta la Serie</button>
                        </div>
                        <button className="modal-close-btn" onClick={() => { setShowRecurrenceModal(false); setModalData(null); }}>&times;</button>
                    </div>
                </div>
            )}

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
                                    <label htmlFor="title">Titolo:</label>
                                    <input type="text" id="title" value={modalTitle} onChange={(e) => setModalTitle(e.target.value)} required />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="description">Descrizione:</label>
                                    <textarea id="description" value={modalDescription} onChange={(e) => setModalDescription(e.target.value)}></textarea>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="date">Data:</label>
                                    <input type="date" id="date" value={modalDate} onChange={(e) => setModalDate(e.target.value)} required />
                                </div>
                                <div className="form-group form-group-time">
                                    <label htmlFor="start_time">Ora Inizio:</label>
                                    <input type="time" id="start_time" value={modalStartTime} onChange={(e) => setModalStartTime(e.target.value)} required />
                                </div>
                                <div className="form-group form-group-time">
                                    <label htmlFor="end_time">Ora Fine:</label>
                                    <input type="time" id="end_time" value={modalEndTime} onChange={(e) => setModalEndTime(e.target.value)} required />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="category">Categoria:</label>
                                    <select id="category" value={modalCategory} onChange={(e) => setModalCategory(e.target.value)}>
                                        {categories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                {(!modalData?.id || modalData?.repeat_pattern) && (
                                    <>
                                        <div className="form-group">
                                            <label htmlFor="repeat">Ripetizione:</label>
                                            <select id="repeat" value={repeatPattern} onChange={(e) => setRepeatPattern(e.target.value)}>
                                                <option value="nessuna">Nessuna</option>
                                                <option value="daily">Giornaliera</option>
                                                <option value="weekly">Settimanale</option>
                                                <option value="monthly">Mensile</option>
                                                <option value="annually">Annuale</option>
                                            </select>
                                        </div>
                                        {repeatPattern !== 'nessuna' && (
                                            <div className="form-group">
                                                <label htmlFor="repeat-end-date">Fine Ripetizione:</label>
                                                <input
                                                    type="date"
                                                    id="repeat-end-date"
                                                    value={repeatEndDate}
                                                    onChange={(e) => setRepeatEndDate(e.target.value)}
                                                    required
                                                />
                                            </div>
                                        )}
                                    </>
                                )}
                                <div className="form-group notification-toggle">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={isNotificationEnabled}
                                            onChange={(e) => setIsNotificationEnabled(e.target.checked)}
                                        />
                                        Attiva Notifiche
                                    </label>
                                </div>
                                {isNotificationEnabled && (
                                    <div className="notification-container">
                                        <div className="form-group">
                                            <label>Notifica (ore prima):</label>
                                            <input type="number" min="1" value={sendBefore} onChange={(e) => setSendBefore(parseInt(e.target.value))} />
                                        </div>
                                        <div className="form-group">
                                            <label>Invia notifica a:</label>
                                            <div className="family-users-list">
                                                {familyUsers.map(user => (
                                                    <label key={user.id} className="family-user-box">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedEmails.includes(user.email)}
                                                            onChange={() => {
                                                                setSelectedEmails(prev =>
                                                                    prev.includes(user.email)
                                                                        ? prev.filter(e => e !== user.email)
                                                                        : [...prev, user.email]
                                                                );
                                                            }}
                                                        />
                                                        <img
                                                            src={user.avatar || "/default-avatar.png"}
                                                            alt="avatar"
                                                            className="family-avatar"
                                                        />
                                                        <span className="family-username">{user.username}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                {modalData?.id && (
                                    <button type="button" className="btn btn-delete" onClick={() => handleDeleteRecurrence('single')}>
                                        Elimina
                                    </button>
                                )}
                                <button type="submit" className="btn btn-save" disabled={!profile}>
                                    Salva
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}