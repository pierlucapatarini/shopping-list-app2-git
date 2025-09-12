import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, setHours, setMinutes, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import it from 'date-fns/locale/it';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../styles/MainStyle.css';
import { FaEdit, FaTrash, FaPlus, FaTimes, FaExchangeAlt } from 'react-icons/fa';

const locales = { it };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });
const categoryColors = { 'FARMACO': '#33FFF9' };

const CustomEventContent = ({ event }) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '2px', fontSize: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</strong>
            <span style={{ fontSize: '10px', marginLeft: '5px', whiteSpace: 'nowrap' }}>
                {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
            </span>
        </div>
        {event.quantita && (
            <div style={{ fontSize: '12px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                Quantità: {event.quantita} - Farmaco: {event.nome_farmaco}
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

export default function Pagina7_GestioneFarmaci() {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [events, setEvents] = useState([]);
    const [archivioFarmaci, setArchivioFarmaci] = useState([]);
    const [familyUsers, setFamilyUsers] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState('month');

    const [modalData, setModalData] = useState(null);
    const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
    const [showMagazzinoModal, setShowMagazzinoModal] = useState(false);
    const [showArchivioModal, setShowArchivioModal] = useState(false);
    const [showUpdateStockModal, setShowUpdateStockModal] = useState(false);

    // Nuovo stato per la gestione delle modifiche in riga
    const [editedFarmaci, setEditedFarmaci] = useState({});

    const [formData, setFormData] = useState({
        id: null, title: '', description: '', date: '', startTime: '', endTime: '',
        nome_farmaco: '', quantita: 0,
        repeatPattern: 'nessuna', repeatEndDate: '',
        isNotificationEnabled: false, sendBefore: 1, selectedEmails: []
    });

    const [magazzinoFormData, setMagazzinoFormData] = useState({
        id: null, nome_farmaco: '', dosaggio: '', istruzioni: '',
        quantita_attuale: 0, quantita_scortaminima: 0, giorni_ricezione: ''
    });

    const [updateStockData, setUpdateStockData] = useState({
        id: null, quantita_attuale: 0
    });

    const updateFormData = (updates) => setFormData(prev => ({ ...prev, ...updates }));
    const updateMagazzinoFormData = (updates) => setMagazzinoFormData(prev => ({ ...prev, ...updates }));
    const updateUpdateStockData = (updates) => setUpdateStockData(prev => ({ ...prev, ...updates }));

    const combineDateTime = (date, time) => {
        if (!date || !time) return null;
        const [hours, minutes] = time.split(':').map(Number);
        return setMinutes(setHours(new Date(date), hours), minutes);
    };

    const fetchData = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: profileData, error: profileError } = await supabase
                .from('profiles').select('*').eq('id', session.user.id).single();
            if (profileError) throw profileError;
            setProfile(profileData);

            if (profileData.family_group) {
                const [eventsResponse, archivioResponse, usersResponse] = await Promise.all([
                    supabase.from('events_farmaci').select('*').eq('family_group', profileData.family_group).order('start', { ascending: true }),
                    supabase.from('ArchivioFarmaci').select('*').eq('family_group', profileData.family_group),
                    supabase.from('profiles').select('id, username, avatar, email').eq('family_group', profileData.family_group)
                ]);

                if (eventsResponse.data) {
                    setEvents(eventsResponse.data.map(e => ({ ...e, start: new Date(e.start), end: new Date(e.end) })));
                }
                if (archivioResponse.data) {
                    setArchivioFarmaci(archivioResponse.data);
                }
                if (usersResponse.data) setFamilyUsers(usersResponse.data);
            }
        } catch (err) {
            console.error("Errore caricamento dati:", err);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const channel = supabase
            .channel('db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'events_farmaci' }, payload => {
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ArchivioFarmaci' }, payload => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchData]);

    const createRecurringSeries = (options) => {
        const { startDateTime, duration, repeatPattern, repeatEndDate, baseEvent } = options;
        const eventsToInsert = [];
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
                ...baseEvent,
                start: currentStart.toISOString(),
                end: new Date(currentStart.getTime() + duration).toISOString(),
            });
            currentStart = incrementFunctions[repeatPattern](currentStart);
        }
        return eventsToInsert;
    };

    const handleSaveEvent = async (e) => {
        e.preventDefault();
        if (!profile?.family_group || !formData.nome_farmaco || !formData.quantita) {
            alert('Assicurati di aver selezionato il farmaco e la quantità.');
            return;
        }

        const startDateTime = combineDateTime(formData.date, formData.startTime);
        const endDateTime = combineDateTime(formData.date, formData.endTime);
        if (!startDateTime || !endDateTime || endDateTime <= startDateTime) {
            alert('Date e orari non validi');
            return;
        }

        const baseEvent = {
            title: `Assunzione ${formData.nome_farmaco}`,
            description: `Dose: ${formData.quantita}`,
            categoria_eve: 'FARMACO',
            nome_farmaco: formData.nome_farmaco,
            quantita: formData.quantita,
            notify_at: formData.isNotificationEnabled ?
                new Date(startDateTime.getTime() - formData.sendBefore * 60 * 60 * 1000).toISOString() : null,
            notify_emails: formData.isNotificationEnabled ? formData.selectedEmails : [],
            family_group: profile.family_group,
            created_by: profile.id,
            username: profile.username,
        };

        try {
            if (formData.repeatPattern === 'nessuna' || formData.repeatPattern === undefined || formData.repeatPattern === '') {
                // Gestione di un singolo evento
                const eventData = { ...baseEvent, start: startDateTime.toISOString(), end: endDateTime.toISOString() };

                if (modalData?.id) {
                    // Update
                    const { data, error } = await supabase.from('events_farmaci').update(eventData).eq('id', modalData.id).select();
                    if (error) throw error;
                    setEvents(prev => [...prev.filter(ev => ev.id !== data[0].id), { ...data[0], start: new Date(data[0].start), end: new Date(data[0].end) }]);
                } else {
                    // Insert
                    const { data, error } = await supabase.from('events_farmaci').insert([eventData]).select();
                    if (error) throw error;
                    setEvents(prev => [...prev, { ...data[0], start: new Date(data[0].start), end: new Date(data[0].end) }]);
                }
            } else {
                // Gestione di eventi ricorrenti
                const recurrenceId = uuidv4();
                const eventsToInsert = createRecurringSeries({
                    baseEvent: { ...baseEvent, repeat_pattern: formData.repeatPattern, recurrence_id: recurrenceId, username: profile.username },
                    startDateTime,
                    duration: endDateTime.getTime() - startDateTime.getTime(),
                    repeatPattern: formData.repeatPattern,
                    repeatEndDate: formData.repeatEndDate,
                });

                if (modalData?.recurrence_id) {
                    await supabase.from('events_farmaci').delete().eq('recurrence_id', modalData.recurrence_id);
                }

                const { data, error } = await supabase.from('events_farmaci').insert(eventsToInsert).select();
                if (error) throw error;

                setEvents(prev => {
                    const filtered = modalData?.recurrence_id
                        ? prev.filter(ev => ev.recurrence_id !== modalData.recurrence_id)
                        : prev;
                    const newEvents = data.map(e => ({ ...e, start: new Date(e.start), end: new Date(e.end) }));
                    return [...filtered, ...newEvents];
                });
            }
            setModalData(null);
        } catch (err) {
            console.error('Errore salvataggio:', err);
            alert(`Errore: ${err.message}`);
        }
    };

    const handleSaveMagazzinoItem = async (e) => {
        e.preventDefault();
        if (!profile?.family_group) return;

        try {
            let data, error;
            const { id, ...itemDataToSave } = magazzinoFormData;

            if (id) {
                const { data: updateData, error: updateError } = await supabase
                    .from('ArchivioFarmaci')
                    .update({ ...itemDataToSave, family_group: profile.family_group })
                    .eq('id', id)
                    .select();
                data = updateData;
                error = updateError;
            } else {
                const { data: insertData, error: insertError } = await supabase
                    .from('ArchivioFarmaci')
                    .insert([{ ...itemDataToSave, family_group: profile.family_group, username: profile.username }])
                    .select();
                data = insertData;
                error = insertError;
            }

            if (error) throw error;
            if (data?.length) {
                const savedItem = data[0];
                setArchivioFarmaci(prev => [...prev.filter(i => i.id !== savedItem.id), savedItem]);
            }
            setShowMagazzinoModal(false);
            setMagazzinoFormData({ id: null, nome_farmaco: '', dosaggio: '', istruzioni: '', quantita_attuale: 0, quantita_scortaminima: 0, giorni_ricezione: '' });
            setShowArchivioModal(false);
        } catch (err) {
            console.error('Errore salvataggio farmaco:', err);
            alert(`Errore: ${err.message}`);
        }
    };

    const handleDeleteMagazzinoItem = async (itemId) => {
        if (window.confirm("Sei sicuro di voler eliminare questo farmaco?")) {
            try {
                const { error } = await supabase.from('ArchivioFarmaci').delete().eq('id', itemId);
                if (error) throw error;
                setArchivioFarmaci(prev => prev.filter(i => i.id !== itemId));
            } catch (err) {
                console.error('Errore eliminazione farmaco:', err);
                alert(`Errore: ${err.message}`);
            }
        }
    };

    // Funzione per gestire le modifiche in riga
    const handleTableChange = (id, field, value) => {
        setEditedFarmaci(prev => ({
            ...prev,
            [id]: {
                ...(prev[id] || archivioFarmaci.find(f => f.id === id)),
                [field]: value
            }
        }));
    };

    // Funzione per salvare tutte le modifiche
    const handleSaveAllEdits = async () => {
        try {
            const updates = Object.values(editedFarmaci).map(farmaco => {
                const { id, ...fieldsToUpdate } = farmaco;
                return supabase.from('ArchivioFarmaci').update(fieldsToUpdate).eq('id', id);
            });
            await Promise.all(updates);

            // Aggiorna lo stato locale con i nuovi dati salvati
            setArchivioFarmaci(prev => prev.map(farmaco => editedFarmaci[farmaco.id] || farmaco));
            setEditedFarmaci({}); // Resetta le modifiche in sospeso
            alert("Modifiche salvate con successo!");

        } catch (err) {
            console.error('Errore nel salvataggio delle modifiche:', err);
            alert('Si è verificato un errore durante il salvataggio.');
        }
    };

    const handleUpdateStock = async (e) => {
        e.preventDefault();
        try {
            const { data, error } = await supabase
                .from('ArchivioFarmaci')
                .update({ quantita_attuale: updateStockData.quantita_attuale })
                .eq('id', updateStockData.id)
                .select();

            if (error) throw error;

            if (data?.length) {
                setArchivioFarmaci(prev => prev.map(item =>
                    item.id === data[0].id ? { ...item, quantita_attuale: data[0].quantita_attuale } : item
                ));
            }

            setShowUpdateStockModal(false);
            setUpdateStockData({ id: null, quantita_attuale: 0 });
        } catch (err) {
            console.error('Errore aggiornamento stock:', err);
            alert(`Errore: ${err.message}`);
        }
    };

    const handleOpenUpdateStock = (item) => {
        setUpdateStockData({
            id: item.id,
            quantita_attuale: item.quantita_attuale
        });
        setShowUpdateStockModal(true);
    };

    const resetEventForm = (date = new Date()) => {
        const now = new Date();
        setFormData({
            id: null, title: '', description: '', date: format(date, 'yyyy-MM-dd'),
            startTime: format(now, 'HH:mm'), endTime: format(setHours(now, now.getHours() + 1), 'HH:mm'),
            nome_farmaco: '', quantita: 0,
            repeatPattern: 'nessuna', repeatEndDate: '',
            isNotificationEnabled: false, sendBefore: 1, selectedEmails: []
        });
    };

    const handleSelectSlot = ({ start }) => {
        setModalData({ date: start });
        resetEventForm(start);
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
            ...formData,
            id: event.id || null,
            title: event.title || '',
            description: event.description || '',
            date: format(event.start, 'yyyy-MM-dd'),
            startTime: format(event.start, 'HH:mm'),
            endTime: format(event.end, 'HH:mm'),
            nome_farmaco: event.nome_farmaco || '',
            quantita: event.quantita || 0,
            selectedEmails: event.notify_emails || [],
            sendBefore: event.notify_at ? Math.round((event.start - new Date(event.notify_at)) / (1000 * 60 * 60)) : 1,
            isNotificationEnabled: !!event.notify_at,
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
            ? await supabase.from('events_farmaci').delete().eq('recurrence_id', modalData.recurrence_id)
            : await supabase.from('events_farmaci').delete().eq('id', modalData.id);

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
            backgroundColor: categoryColors['FARMACO'],
            color: 'white', borderRadius: '8px', border: 'none', padding: '4px 8px',
            whiteSpace: 'pre-wrap', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', fontSize: '14px'
        }
    });

    return (
        <div className="app-layout">
            <div className="header">
                <h1>💊 Gestione Farmaci</h1>
                <p>Gestisci l'archivio dei farmaci e gli appuntamenti per l'assunzione!</p>
                <div className="tab-buttons">
                    <button onClick={() => navigate('/main-menu')} className="btn-secondary">
                        Torna al Menu Principale
                    </button>
                    <button className="btn-add" onClick={() => { setModalData({ date: new Date() }); resetEventForm(); }}>
                        Nuovo Appuntamento
                    </button>
                    <button className="btn-add" onClick={() => { setShowMagazzinoModal(true); setMagazzinoFormData({ id: null, nome_farmaco: '', dosaggio: '', istruzioni: '', quantita_attuale: 0, quantita_scortaminima: 0, giorni_ricezione: '' }); }}>
                        Aggiungi Farmaco
                    </button>
                    <button className="btn-primary" onClick={() => { setShowArchivioModal(true); }}>
                        Visualizza Magazzino
                    </button>
                </div>
            </div>

            <div className="main-content">
                <div className="info-box">
                    <h2>Gestisci gli appuntamenti</h2>
                    <p>Clicca su una data o su un appuntamento per gestirlo.</p>
                </div>
                <div className="calendar-wrapper">
                    {profile ? (
                        <Calendar
                            localizer={localizer} events={events} culture="it"
                            startAccessor="start" endAccessor="end" style={{ height: 600 }} selectable
                            views={["month", "week", "day", "agenda"]} view={view} onView={setView}
                            date={currentDate} onNavigate={setCurrentDate}
                            onSelectSlot={handleSelectSlot} onSelectEvent={handleSelectEvent}
                            eventPropGetter={eventStyleGetter}
                            components={{ event: CustomEventContent, toolbar: CustomToolbar }}
                            messages={{
                                today: 'Oggi', previous: 'Precedente', next: 'Successivo',
                                month: 'Mese', week: 'Settimana', day: 'Giorno', agenda: 'Agenda'
                            }}
                        />
                    ) : (
                        <p>Caricamento del profilo in corso...</p>
                    )}
                </div>
            </div>
            <div className="footer">
                <p>&copy; 2024 Gruppo Famiglia. Tutti i diritti riservati.</p>
            </div>

            {/* Modals */}

            {/* Recurrence Modal */}
            {showRecurrenceModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Gestisci Appuntamento Ricorrente</h2>
                            <button className="modal-close-btn" onClick={() => { setShowRecurrenceModal(false); setModalData(null); }}>&times;</button>
                        </div>
                        <p>Questo appuntamento fa parte di una serie. Come vuoi procedere?</p>
                        <div className="modal-actions">
                            <button className="btn-primary" onClick={() => openEventModal(modalData, false)}>Modifica Solo Questo</button>
                            <button className="btn-primary" onClick={() => openEventModal(modalData, true)}>Modifica Tutta la Serie</button>
                            <button className="btn-delete" onClick={() => handleDeleteEvent('single')}>Elimina Solo Questo</button>
                            <button className="btn-delete" onClick={() => handleDeleteEvent('all')}>Elimina Tutta la Serie</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Event Modal per Appuntamenti Farmaco */}
            {modalData && !showRecurrenceModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>{modalData?.id ? 'Modifica Appuntamento Farmaco' : 'Aggiungi Nuovo Appuntamento'}</h2>
                            <button className="modal-close-btn" onClick={() => setModalData(null)}>&times;</button>
                        </div>
                        <form onSubmit={handleSaveEvent}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Farmaco:</label>
                                    <select className="search-input" value={formData.nome_farmaco} onChange={(e) => updateFormData({ nome_farmaco: e.target.value })} required>
                                        <option value="">Seleziona un farmaco...</option>
                                        {archivioFarmaci.map(farmaco => (
                                            <option key={farmaco.id} value={farmaco.nome_farmaco}>
                                                {farmaco.nome_farmaco}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Quantità:</label>
                                    <input type="number" step="0.01" className="search-input" value={formData.quantita} onChange={(e) => updateFormData({ quantita: parseFloat(e.target.value) })} required />
                                </div>
                                <div className="form-group">
                                    <label>Data:</label>
                                    <input type="date" className="search-input" value={formData.date} onChange={(e) => updateFormData({ date: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>Ora Assunzione:</label>
                                    <input type="time" className="search-input" value={formData.startTime} onChange={(e) => updateFormData({ startTime: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>Frequenza di Ripetizione:</label>
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
                                        <label>Data di Fine Ripetizione:</label>
                                        <input type="date" className="search-input" value={formData.repeatEndDate} onChange={(e) => updateFormData({ repeatEndDate: e.target.value })} required />
                                    </div>
                                )}
                                <div className="form-group notification-toggle">
                                    <label>
                                        <input type="checkbox" checked={formData.isNotificationEnabled}
                                            onChange={(e) => updateFormData({ isNotificationEnabled: e.target.checked })} />
                                        Attiva Notifiche
                                    </label>
                                </div>
                            </div>
                            <div className="modal-footer">
                                {modalData?.id && (
                                    <button type="button" className="btn-delete" onClick={() => handleDeleteEvent()}>Elimina</button>
                                )}
                                <button type="submit" className="btn-primary" disabled={!profile}>Salva</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Magazzino Modal (Inserisci/Modifica Farmaco) */}
            {showMagazzinoModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>{magazzinoFormData.id ? 'Modifica Farmaco' : 'Aggiungi Nuovo Farmaco'}</h2>
                            <button className="modal-close-btn" onClick={() => setShowMagazzinoModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleSaveMagazzinoItem}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Nome Farmaco:</label>
                                    <input type="text" className="search-input" value={magazzinoFormData.nome_farmaco} onChange={(e) => updateMagazzinoFormData({ nome_farmaco: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>Dosaggio:</label>
                                    <input type="text" className="search-input" value={magazzinoFormData.dosaggio} onChange={(e) => updateMagazzinoFormData({ dosaggio: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Istruzioni:</label>
                                    <textarea className="search-input" value={magazzinoFormData.istruzioni} onChange={(e) => updateMagazzinoFormData({ istruzioni: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Quantità Attuale:</label>
                                    <input type="number" step="0.01" className="search-input" value={magazzinoFormData.quantita_attuale} onChange={(e) => updateMagazzinoFormData({ quantita_attuale: parseFloat(e.target.value) })} required />
                                </div>
                                <div className="form-group">
                                    <label>Quantità Scorta Minima:</label>
                                    <input type="number" step="0.01" className="search-input" value={magazzinoFormData.quantita_scortaminima} onChange={(e) => updateMagazzinoFormData({ quantita_scortaminima: parseFloat(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label>Giorni di Ricezione:</label>
                                    <input type="text" className="search-input" value={magazzinoFormData.giorni_ricezione} onChange={(e) => updateMagazzinoFormData({ giorni_ricezione: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="submit" className="btn-primary">Salva</button>
                                {magazzinoFormData.id && (
                                    <button type="button" className="btn-delete" onClick={() => handleDeleteMagazzinoItem(magazzinoFormData.id)}>Elimina</button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Nuovo Modale per l'aggiornamento dello stock */}
            {showUpdateStockModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Aggiorna Stock</h2>
                            <button className="modal-close-btn" onClick={() => setShowUpdateStockModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleUpdateStock}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Nuova Quantità:</label>
                                    <input type="number" step="0.01" className="search-input" value={updateStockData.quantita_attuale} onChange={(e) => updateUpdateStockData({ quantita_attuale: parseFloat(e.target.value) })} required />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="submit" className="btn-primary">Salva</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Archivio completo in tabella editabile */}
            {showArchivioModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Archivio Magazzino Farmaci</h2>
                            <button className="modal-close-btn" onClick={() => setShowArchivioModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body shopping-table-container">
                            <table className="shopping-table">
                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>Dosaggio</th>
                                        <th>Quantità Attuale</th>
                                        <th>Scorta Minima</th>
                                        <th>Giorni di Ricezione</th>
                                        <th>Azioni</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {archivioFarmaci.map(item => (
                                        <tr key={item.id} className={item.quantita_attuale <= item.quantita_scortaminima ? 'low-stock' : ''}>
                                            <td>{item.nome_farmaco}</td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={(editedFarmaci[item.id] || item).dosaggio}
                                                    onChange={(e) => handleTableChange(item.id, 'dosaggio', e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    value={(editedFarmaci[item.id] || item).quantita_attuale}
                                                    onChange={(e) => handleTableChange(item.id, 'quantita_attuale', parseFloat(e.target.value))}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    value={(editedFarmaci[item.id] || item).quantita_scortaminima}
                                                    onChange={(e) => handleTableChange(item.id, 'quantita_scortaminima', parseFloat(e.target.value))}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={(editedFarmaci[item.id] || item).giorni_ricezione}
                                                    onChange={(e) => handleTableChange(item.id, 'giorni_ricezione', e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <button className="btn-delete" onClick={() => handleDeleteMagazzinoItem(item.id)}>
                                                    <FaTrash /> Elimina
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn-primary" onClick={handleSaveAllEdits}>Salva Modifiche</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}