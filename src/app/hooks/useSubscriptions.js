import { useState, useCallback } from 'react';

const API = {
    markSpam: '/api/mark-spam',
    unmarkSpam: '/api/unmark-spam',
};

export function useSubscriptions(userEmail) {
    const [subscriptionStates, setSubscriptionStates] = useState({});

    const apiRequest = useCallback(async (endpoint, payload) => {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            if (!response.ok) new Error(data.error || 'Error desconocido');

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
                markedAsSpam: !isSpam,
                errorSpam: !success,
                spamDetails: data?.details,
            });

            if (data?.details) {
                const summary = isSpam
                    ? ` ${data.details.restoredToInbox} correos restaurados a la bandeja de entrada`
                    : ` ${data.details.markedAsSpam} correos marcados como spam`;

                alert(summary);
            }

            if (error) alert(error);
        },
        [subscriptionStates, userEmail, apiRequest, updateState]
    );

    return { subscriptionStates, handleSpamToggle };
}
