// hooks/useNewsletterGroups.js
import { useState, useEffect } from 'react';

const API_URL = 'http://localhost/aplicacion_emails/app-emails/src/backend';

export function useNewsletterGroups(userEmail) {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Cargar grupos automáticamente cuando hay userEmail
    useEffect(() => {
        if (userEmail) {
            fetchGroups();
        } else {
            setGroups([]);
            setLoading(false);
        }
    }, [userEmail]);

    // Función para obtener grupos desde el backend
    const fetchGroups = async () => {
        if (!userEmail) return;

        try {
            setLoading(true);
            setError(null);

            console.log('[fetchGroups] Obteniendo grupos para:', userEmail);

            const response = await fetch(
                `${API_URL}/read-groups.php?user_email=${encodeURIComponent(userEmail)}`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('[fetchGroups] Respuesta:', data);

            if (data.success) {
                console.log('[fetchGroups] Grupos cargados:', data.groups?.length || 0);
                setGroups(data.groups || []);
            } else {
                throw new Error(data.error || 'Error al cargar grupos');
            }
        } catch (err) {
            console.error('[fetchGroups] Error:', err);
            setError(err.message || 'Error de conexión al cargar grupos');
            setGroups([]);
        } finally {
            setLoading(false);
        }
    };

    // Crear nuevo grupo
    const createGroup = async (groupName, description = '', color = '#3b82f6', newsletters = []) => {
        if (!userEmail) {
            return { success: false, error: 'Email de usuario no disponible' };
        }

        try {
            console.log('[createGroup] Creando grupo:', { groupName, description, color });

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
            console.log('[createGroup] Respuesta:', data);

            if (data.success) {
                // Recargar grupos inmediatamente después de crear
                await fetchGroups();
                return { success: true, group: data.group };
            } else {
                return { success: false, error: data.error || 'Error al crear grupo' };
            }
        } catch (err) {
            console.error('[createGroup] Error:', err);
            return { success: false, error: 'Error de conexión al crear grupo' };
        }
    };

    // Actualizar grupo existente
    const updateGroup = async (groupId, updates) => {
        if (!userEmail) {
            return { success: false, error: 'Email de usuario no disponible' };
        }

        try {
            console.log('[updateGroup] Actualizando grupo:', groupId, updates);

            const response = await fetch(`${API_URL}/update-group.php`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    group_id: groupId,
                    user_email: userEmail,
                    group_name: updates.group_name,
                    description: updates.description,
                    color: updates.color
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('[updateGroup] Respuesta:', data);

            if (data.success) {
                // Recargar grupos después de actualizar
                await fetchGroups();
                return { success: true, group: data.group };
            } else {
                return { success: false, error: data.error || 'Error al actualizar grupo' };
            }
        } catch (err) {
            console.error('[updateGroup] Error:', err);
            return { success: false, error: err.message || 'Error de conexión al actualizar grupo' };
        }
    };

    // Eliminar grupo
    const deleteGroup = async (groupId) => {
        if (!userEmail) {
            return { success: false, error: 'Email de usuario no disponible' };
        }

        try {
            console.log('[deleteGroup] Eliminando grupo:', groupId);

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
            console.log('[deleteGroup] Respuesta:', data);

            if (data.success) {
                // Recargar grupos después de eliminar
                await fetchGroups();
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Error al eliminar grupo' };
            }
        } catch (err) {
            console.error('[deleteGroup] Error:', err);
            return { success: false, error: 'Error de conexión al eliminar grupo' };
        }
    };

    // Agregar newsletter a grupo
    const addNewsletterToGroup = async (groupId, senderEmail, senderName = null) => {
        try {
            console.log('[addNewsletterToGroup] Agregando:', { groupId, senderEmail, senderName });

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
            console.log('[addNewsletterToGroup] Respuesta:', data);

            if (data.success) {
                // Recargar grupos después de agregar newsletter
                await fetchGroups();
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Error al agregar newsletter' };
            }
        } catch (err) {
            console.error('[addNewsletterToGroup] Error:', err);
            return { success: false, error: 'Error de conexión al agregar newsletter' };
        }
    };

    // Remover newsletter de grupo
    const removeNewsletterFromGroup = async (groupId, senderEmail) => {
        try {
            console.log('[removeNewsletterFromGroup] Removiendo:', { groupId, senderEmail });

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
            console.log('[removeNewsletterFromGroup] Respuesta:', data);

            if (data.success) {
                // Recargar grupos después de remover newsletter
                await fetchGroups();
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Error al remover newsletter' };
            }
        } catch (err) {
            console.error('[removeNewsletterFromGroup] Error:', err);
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
