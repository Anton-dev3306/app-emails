// hooks/useNewsletterGroups.js
import { useState, useEffect } from 'react';

const API_URL = 'http://localhost/aplicacion_emails/app-emails/src/backend';

export function useNewsletterGroups(userEmail) {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (userEmail) {
            fetchGroups();
        } else {
            setGroups([]);
            setLoading(false);
        }
    }, [userEmail]);

    const fetchGroups = async () => {
        if (!userEmail) return;

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`${API_URL}/read-groups.php?user_email=${encodeURIComponent(userEmail)}`);
            const data = await response.json();

            if (data.success) {
                setGroups(data.groups || []);
            } else {
                setError(data.error || 'Error al cargar grupos');
                setGroups([]);
            }
        } catch (err) {
            console.error('Error fetching groups:', err);
            setError('Error de conexión al cargar grupos');
            setGroups([]);
        } finally {
            setLoading(false);
        }
    };

    const createGroup = async (groupName, description = '', color = '#3b82f6', newsletters = []) => {
        if (!userEmail) {
            return { success: false, error: 'Email de usuario no disponible' };
        }

        try {
            const response = await fetch(`${API_URL}/create-group.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_email: userEmail,
                    group_name: groupName,
                    description: description,
                    color: color,
                    newsletters: newsletters
                })
            });

            const data = await response.json();

            if (data.success) {
                await fetchGroups();
                return { success: true, group: data.group };
            } else {
                return { success: false, error: data.error || 'Error al crear grupo' };
            }
        } catch (err) {
            console.error('Error creating group:', err);
            return { success: false, error: 'Error de conexión al crear grupo' };
        }
    };

    const updateGroup = async (groupId, updates) => {
        if (!userEmail) {
            return { success: false, error: 'Email de usuario no disponible' };
        }

        try {
            const response = await fetch(`${API_URL}/update-group.php`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    group_id: groupId,
                    user_email: userEmail,
                    ...updates
                })
            });

            const data = await response.json();

            if (data.success) {
                await fetchGroups();
                return { success: true, group: data.group };
            } else {
                return { success: false, error: data.error || 'Error al actualizar grupo' };
            }
        } catch (err) {
            console.error('Error updating group:', err);
            return { success: false, error: 'Error de conexión al actualizar grupo' };
        }
    };

    const deleteGroup = async (groupId) => {
        if (!userEmail) {
            return { success: false, error: 'Email de usuario no disponible' };
        }

        try {
            const response = await fetch(`${API_URL}/delete-group.php`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    group_id: groupId,
                    user_email: userEmail
                })
            });

            const data = await response.json();

            if (data.success) {
                await fetchGroups();
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Error al eliminar grupo' };
            }
        } catch (err) {
            console.error('Error deleting group:', err);
            return { success: false, error: 'Error de conexión al eliminar grupo' };
        }
    };

    const addNewsletterToGroup = async (groupId, senderEmail, senderName = null) => {
        try {
            const response = await fetch(`${API_URL}/add-newsletter.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    group_id: groupId,
                    sender_email: senderEmail,
                    sender_name: senderName
                })
            });

            const data = await response.json();

            if (data.success) {
                await fetchGroups();
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Error al agregar newsletter' };
            }
        } catch (err) {
            console.error('Error adding newsletter:', err);
            return { success: false, error: 'Error de conexión al agregar newsletter' };
        }
    };

    const removeNewsletterFromGroup = async (groupId, senderEmail) => {
        try {
            const response = await fetch(`${API_URL}/remove-newsletter.php`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    group_id: groupId,
                    sender_email: senderEmail
                })
            });

            const data = await response.json();

            if (data.success) {
                await fetchGroups();
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Error al remover newsletter' };
            }
        } catch (err) {
            console.error('Error removing newsletter:', err);
            return { success: false, error: 'Error de conexión al remover newsletter' };
        }
    };

    return {
        groups,
        loading,
        error,
        createGroup,
        updateGroup,
        deleteGroup,
        addNewsletterToGroup,
        removeNewsletterFromGroup,
        refreshGroups: fetchGroups
    };
}