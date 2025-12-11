import { useState, useCallback } from 'react';

const API = {
    markSpam: '/api/mark-spam',
    unmarkSpam: '/api/unmark-spam',
    countEmails: '/api/email-count'
};

export function useSubscriptions(userEmail) {
    const [subscriptionStates, setSubscriptionStates] = useState({});
    const [notification, setNotification] = useState(null);

    const apiRequest = useCallback(async (endpoint, payload) => {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) return { success: false, error: data.error || 'Error desconocido' };

            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message || 'Error de conexión' };
        }
    }, []);

    const updateState = useCallback((email, changes) => {
        setSubscriptionStates(prev => ({
            ...prev,
            [email]: { ...prev[email], ...changes },
        }));
    }, []);

    const handleSpamToggle = useCallback(
        async (subscription) => {
            const { senderEmail, sender } = subscription;
            const current = subscriptionStates[senderEmail] || {};
            if (current.loadingSpam) return;

            const isSpam = current.markedAsSpam;
            updateState(senderEmail, { loadingSpam: true, errorSpam: false });

            const { success, data, error } = await apiRequest(
                isSpam ? API.unmarkSpam : API.markSpam,
                { senderEmail, sender, userEmail }
            );

            updateState(senderEmail, {
                loadingSpam: false,
                markedAsSpam: success ? !isSpam : isSpam,
                errorSpam: !success,
                spamDetails: data?.details,
            });

            // 🔥 ENVÍA JSON COMO NOTIFICACIÓN AL COMPONENTE
            if (success && data) {
                setNotification({
                    type: isSpam ? 'success' : 'warning',
                    message: data.summary,   // ← Aquí llega el "3 correos marcados como spam"
                    details: data.details    // ← JSON completo
                });
            }

            if (!success) {
                setNotification({
                    type: 'error',
                    message: error
                });
            }
        },
        [subscriptionStates, userEmail, apiRequest, updateState]
    );

    return {
        subscriptionStates,
        handleSpamToggle,
        notification,
        clearNotification: () => setNotification(null),
    };
}
