import { useState } from 'react';

export function useSubscriptions(userEmail) {
    const [subscriptionStates, setSubscriptionStates] = useState({});

    const handleSubscriptionToggle = async (subscription) => {
        const isCurrentlySubscribed = !subscriptionStates[subscription.senderEmail]?.unsubscribed;

        if (subscriptionStates[subscription.senderEmail]?.loading) return;

        try {
            setSubscriptionStates(prev => ({
                ...prev,
                [subscription.senderEmail]: {
                    ...prev[subscription.senderEmail],
                    loading: true
                }
            }));

            const endpoint = isCurrentlySubscribed ? '/api/unsubscribe' : '/api/subscribe';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    senderEmail: subscription.senderEmail,
                    sender: subscription.sender,
                    userEmail: userEmail
                }),
            });

            if (!response.ok) {
                throw new Error(`Error al ${isCurrentlySubscribed ? 'desuscribir' : 'suscribir'}`);
            }

            setSubscriptionStates(prev => ({
                ...prev,
                [subscription.senderEmail]: {
                    unsubscribed: isCurrentlySubscribed,
                    error: false,
                    loading: false,
                    markedAsSpam: false
                }
            }));

        } catch (error) {
            console.error('Error:', error);
            setSubscriptionStates(prev => ({
                ...prev,
                [subscription.senderEmail]: {
                    ...prev[subscription.senderEmail],
                    error: true,
                    loading: false
                }
            }));
        }
    };

    const handleSpamToggle = async (subscription) => {
        const currentState = subscriptionStates[subscription.senderEmail] || {};
        const isCurrentlyMarkedAsSpam = currentState.markedAsSpam;

        if (currentState.loadingSpam) return;

        try {
            setSubscriptionStates(prev => ({
                ...prev,
                [subscription.senderEmail]: {
                    ...prev[subscription.senderEmail],
                    loadingSpam: true
                }
            }));

            const endpoint = isCurrentlyMarkedAsSpam ? '/api/unmark-spam' : '/api/mark-spam';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    senderEmail: subscription.senderEmail,
                    sender: subscription.sender,
                    userEmail: userEmail
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Error al ${isCurrentlyMarkedAsSpam ? 'desmarcar' : 'marcar'} como spam`);
            }

            setSubscriptionStates(prev => ({
                ...prev,
                [subscription.senderEmail]: {
                    ...prev[subscription.senderEmail],
                    markedAsSpam: !isCurrentlyMarkedAsSpam,
                    errorSpam: false,
                    loadingSpam: false,
                    spamDetails: data.details
                }
            }));

            // Mostrar resumen de la operación
            if (data.details) {
                const summary = isCurrentlyMarkedAsSpam
                    ? `✓ ${data.details.restoredToInbox} correos restaurados a la bandeja de entrada`
                    : `✓ ${data.details.markedAsSpam} newsletters marcadas como spam`;
                alert(summary);
            }

        } catch (error) {
            console.error('Error:', error);
            setSubscriptionStates(prev => ({
                ...prev,
                [subscription.senderEmail]: {
                    ...prev[subscription.senderEmail],
                    errorSpam: true,
                    loadingSpam: false
                }
            }));

            alert(error.message || 'Error al procesar la solicitud');
        }
    };

    return {
        subscriptionStates,
        handleSubscriptionToggle,
        handleSpamToggle
    };
}