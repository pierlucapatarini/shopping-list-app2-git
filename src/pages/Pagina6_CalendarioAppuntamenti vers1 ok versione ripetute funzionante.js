import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, setHours, setMinutes } from 'date-fns';
import it from 'date-fns/locale/it';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../styles/archivio.css';

const locales = { it };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

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
    const [view, setView] = useState('month'); // ✅ NUOVO STATO PER LA VISUALIZZAZIONE

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

    const handleSaveEvent = async (e) => {
        e.preventDefault();
        if (!profile || !profile.family_group) return;

        const startDateTime = combineDateTime(modalDate, modalStartTime);
        const endDateTime = combineDateTime(modalDate, modalEndTime);

        let notifyAt = null;
        if (sendBefore > 0) {
            notifyAt = new Date(startDateTime.getTime() - sendBefore * 60 * 60 * 1000);
        }

        const baseEvent = {
            title: modalTitle,
            description: modalDescription,
            start: startDateTime.toISOString(),
            end: endDateTime.toISOString(),
            categoria_eve: modalCategory,
            notify_at: notifyAt ? notifyAt.toISOString() : null,
            notify_emails: selectedEmails,
        };

        let response;
        if (!modalData?.id) {
            response = await supabase.from('events').insert([{
                ...baseEvent,
                family_group: profile.family_group,
                created_by: profile.id
            }]).select();
        } else {
            response = await supabase.from('events').update(baseEvent).eq('id', modalData.id).select();
        }

        const { data, error } = response;
        if (error) {
            console.error('Error saving event:', error);
        } else if (data && data.length > 0) {
            const savedEvent = {
                ...data[0],
                start: new Date(data[0].start),
                end: new Date(data[0].end),
            };
            setEvents(prev =>
                modalData?.id
                    ? prev.map(ev => ev.id === savedEvent.id ? savedEvent : ev)
                    : [...prev, savedEvent]
            );
            setModalData(null);
        }
    };

    const handleDeleteEvent = async () => {
        if (window.confirm("Sei sicuro di voler eliminare questo evento?")) {
            const { error } = await supabase.from('events').delete().eq('id', modalData.id);
            if (!error) {
                setEvents(prev => prev.filter(ev => ev.id !== modalData.id));
                setModalData(null);
            }
        }
    };

    const handleSelectSlot = ({ start }) => {
        const now = new Date();
        setModalData({ date: start });
        setModalTitle('');
        setModalDescription('');
        setModalDate(format(start, 'yyyy-MM-dd'));
        setModalStartTime(format(now, 'HH:mm'));
        setModalEndTime(format(setHours(now, now.getHours() + 1), 'HH:mm'));
        setModalCategory('ALTRO');
        setSelectedEmails([]);
        setSendBefore(1);
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
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }
        };
    };

    return (
        <div className="archivio-container">
            <h1 className="title">📅 Calendario Famiglia</h1>
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
                        view={view} // ✅ Collega la prop 'view' allo stato
                        onView={setView} // ✅ Collega la prop 'onView' al gestore di stato
                        date={currentDate}
                        onNavigate={date => setCurrentDate(date)}
                        onSelectSlot={handleSelectSlot}
                        onSelectEvent={handleSelectEvent}
                        eventPropGetter={eventStyleGetter}
                        tooltipAccessor={event => `Evento: ${event.title}\nDescrizione: ${event.description}`}
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

            {modalData && (
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
                            <div className="modal-footer">
                                {modalData?.id && (
                                    <button type="button" className="btn btn-delete" onClick={handleDeleteEvent}>
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