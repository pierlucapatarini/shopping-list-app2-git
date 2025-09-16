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

const initialFormData = {
    title: '',
    category: '',
    description: '',
    start: new Date(),
    end: new Date(),
    isAllDay: false,
    repetition: 'no-repetition',
    repetition_until: null,
    isNotificationEnabled: false,
    selectedEmails: [],
    createdBy: '',
    id: null
};

export default function Pagina6_CalendarioAppuntamenti() {
    const [profile, setProfile] = useState(null);
    const [events, setEvents] = useState([]);
    const [modalIsOpen, setModalIsOpen] = useState(false);
    const [formData, setFormData] = useState(initialFormData);
    const [modalData, setModalData] = useState(null);
    const [users, setUsers] = useState([]);
    const [selectedEmails, setSelectedEmails] = useState([]);
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    const fetchEventsAndProfile = async () => {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            navigate('/');
            return;
        }

        const { user } = session;
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error('Errore nel recupero del profilo:', profileError);
            return;
        }

        setProfile(profileData);
        await fetchUsers(user.id);
        await fetchEvents(user.id);
    };

    const fetchEvents = async (userId) => {
        const { data, error } = await supabase
            .from('calendar_events')
            .select('*')
            .or(`createdby.eq.${userId},selectedemails.cs.{"${userId}"}`);

        if (error) {
            console.error('Errore nel recupero degli eventi:', error);
        } else {
            const formattedEvents = data.map(event => ({
                ...event,
                start: new Date(event.start),
                end: new Date(event.end),
                id: event.id
            }));
            setEvents(formattedEvents);
        }
    };

    const fetchUsers = async (currentUserId) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, email');
        if (error) {
            console.error('Errore nel recupero degli utenti:', error);
        } else {
            const allUsers = data.filter(user => user.id !== currentUserId);
            setUsers(allUsers);
        }
    };

    useEffect(() => {
        fetchEventsAndProfile();
    }, []);

    const handleSelectSlot = ({ start, end }) => {
        if (!profile) return;
        setFormData({
            ...initialFormData,
            start: start,
            end: end,
            isAllDay: false,
            createdBy: profile.id
        });
        setModalData(null);
        setModalIsOpen(true);
    };

    const handleSelectEvent = (event) => {
        if (!profile) return;
        setFormData({
            title: event.title,
            category: event.category,
            description: event.description,
            start: event.start,
            end: event.end,
            isAllDay: event.is_all_day,
            repetition: event.repetition,
            repetition_until: event.repetition_until ? new Date(event.repetition_until) : null,
            isNotificationEnabled: event.is_notification_enabled,
            selectedEmails: event.selected_emails || [],
            createdBy: event.created_by,
            id: event.id
        });
        setSelectedEmails(event.selected_emails ? event.selected_emails.map(email => users.find(u => u.email === email)) : []);
        setModalData(event);
        setModalIsOpen(true);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleDateChange = (date, name) => {
        setFormData(prev => ({ ...prev, [name]: date }));
    };

    const handleTimeChange = (date, name) => {
        const newTime = date;
        const newDate = new Date(formData[name]);
        newDate.setHours(newTime.getHours());
        newDate.setMinutes(newTime.getMinutes());
        setFormData(prev => ({ ...prev, [name]: newDate }));
    };

    const getEventColor = (event) => {
        const category = event.category || 'ALTRO';
        return categoryColors[category] || '#6c757d';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const eventData = {
            title: formData.title,
            category: formData.category,
            description: formData.description,
            start: formData.start.toISOString(),
            end: formData.end.toISOString(),
            is_all_day: formData.isAllDay,
            repetition: formData.repetition,
            repetition_until: formData.repetition_until ? formData.repetition_until.toISOString() : null,
            is_notification_enabled: formData.isNotificationEnabled,
            selected_emails: selectedEmails.map(u => u.email),
            created_by: profile.id,
        };

        try {
            if (modalData?.id) {
                const { error } = await supabase
                    .from('calendar_events')
                    .update(eventData)
                    .eq('id', modalData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('calendar_events')
                    .insert([{ ...eventData, id: uuidv4() }]);
                if (error) throw error;
            }
            await fetchEvents(profile.id);
            setModalIsOpen(false);
        } catch (error) {
            console.error('Errore nel salvataggio dell\'evento:', error);
            alert('Errore nel salvataggio dell\'evento. Riprova.');
        }
    };

    const handleDeleteEvent = async () => {
        try {
            const { error } = await supabase
                .from('calendar_events')
                .delete()
                .eq('id', modalData.id);
            if (error) throw error;
            await fetchEvents(profile.id);
            setModalIsOpen(false);
        } catch (error) {
            console.error('Errore nell\'eliminazione dell\'evento:', error);
            alert('Errore nell\'eliminazione dell\'evento. Riprova.');
        }
    };

    const handleUserSelect = (user) => {
        if (!selectedEmails.some(u => u.id === user.id)) {
            setSelectedEmails(prev => [...prev, user]);
        }
        setSearchTerm('');
        setShowUserDropdown(false);
    };

    const handleRemoveEmail = (userToRemove) => {
        setSelectedEmails(prev => prev.filter(user => user.id !== userToRemove.id));
    };

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !selectedEmails.some(u => u.id === user.id)
    );

    const formatEventTitle = (event) => {
        const isPast = new Date(event.end) < new Date();
        return (
            <div style={{ color: 'white', opacity: isPast ? 0.6 : 1 }}>
                <strong>{event.title}</strong>
                <p>{event.description}</p>
                {event.is_notification_enabled && (
                    <span style={{ marginLeft: '5px' }}>🔔</span>
                )}
            </div>
        );
    };

    return (
        <div className="main-container">
            <div className="calendar-container">
                <Calendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: 'calc(100vh - 120px)' }}
                    onSelectSlot={handleSelectSlot}
                    onSelectEvent={handleSelectEvent}
                    selectable
                    culture="it"
                    eventPropGetter={(event) => ({
                        style: {
                            backgroundColor: getEventColor(event),
                        },
                    })}
                    formats={{
                        dayFormat: (date, culture, localizer) => localizer.format(date, 'E', culture),
                    }}
                    components={{
                        event: ({ event }) => formatEventTitle(event),
                    }}
                />
            </div>
            {modalIsOpen && (
                <div className="modal-backdrop">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h4>{modalData?.id ? 'Modifica Evento' : 'Aggiungi Nuovo Evento'}</h4>
                            <button type="button" className="close-btn" onClick={() => setModalIsOpen(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Titolo</label>
                                    <input type="text" name="title" value={formData.title} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Categoria</label>
                                    <select name="category" value={formData.category} onChange={handleChange} required>
                                        <option value="">Seleziona Categoria</option>
                                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Descrizione</label>
                                    <textarea name="description" value={formData.description} onChange={handleChange}></textarea>
                                </div>
                                <div className="form-group">
                                    <label>Inizio</label>
                                    <input type="datetime-local" name="start" value={format(formData.start, "yyyy-MM-dd'T'HH:mm")} onChange={(e) => handleDateChange(new Date(e.target.value), 'start')} required />
                                </div>
                                <div className="form-group">
                                    <label>Fine</label>
                                    <input type="datetime-local" name="end" value={format(formData.end, "yyyy-MM-dd'T'HH:mm")} onChange={(e) => handleDateChange(new Date(e.target.value), 'end')} required />
                                </div>
                                <div className="form-group">
                                    <label>
                                        <input type="checkbox" name="isAllDay" checked={formData.isAllDay} onChange={handleChange} />
                                        Tutto il giorno
                                    </label>
                                </div>
                                <div className="form-group">
                                    <label>Ripetizione</label>
                                    <select name="repetition" value={formData.repetition} onChange={handleChange}>
                                        <option value="no-repetition">Nessuna Ripetizione</option>
                                        <option value="daily">Giornaliera</option>
                                        <option value="weekly">Settimanale</option>
                                        <option value="monthly">Mensile</option>
                                        <option value="yearly">Annuale</option>
                                    </select>
                                </div>
                                {formData.repetition !== 'no-repetition' && (
                                    <div className="form-group">
                                        <label>Ripeti fino a</label>
                                        <input type="date" name="repetition_until" value={formData.repetition_until ? format(formData.repetition_until, 'yyyy-MM-dd') : ''} onChange={(e) => handleDateChange(new Date(e.target.value), 'repetition_until')} />
                                    </div>
                                )}
                                <div className="form-group">
                                    <label>
                                        <input type="checkbox" name="isNotificationEnabled" checked={formData.isNotificationEnabled} onChange={handleChange} />
                                        Abilita Notifiche Push
                                    </label>
                                </div>
                                {formData.isNotificationEnabled && (
                                    <div className="form-group">
                                        <label>Invia notifiche a:</label>
                                        <div className="user-select-container">
                                            <div className="selected-users">
                                                {selectedEmails.map(user => (
                                                    <span key={user.id} className="selected-user-tag">
                                                        {user.username}
                                                        <span onClick={() => handleRemoveEmail(user)} className="remove-tag">&times;</span>
                                                    </span>
                                                ))}
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Cerca utenti..."
                                                value={searchTerm}
                                                onChange={(e) => {
                                                    setSearchTerm(e.target.value);
                                                    setShowUserDropdown(true);
                                                }}
                                                onFocus={() => setShowUserDropdown(true)}
                                                onBlur={() => setTimeout(() => setShowUserDropdown(false), 200)}
                                            />
                                            {showUserDropdown && searchTerm && filteredUsers.length > 0 && (
                                                <ul className="user-dropdown">
                                                    {filteredUsers.map(user => (
                                                        <li key={user.id} onClick={() => handleUserSelect(user)}>
                                                            {user.username} ({user.email})
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
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
                                    disabled={!profile || (formData.isNotificationEnabled && selectedEmails.length === 0)}
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
}