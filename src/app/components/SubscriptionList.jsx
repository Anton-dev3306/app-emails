"use client";
import { useState } from 'react';
import { Box, Text, Flex, TextField } from "@radix-ui/themes";
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import SubscriptionCard from './SubscriptionCard';

export default function SubscriptionList({
                                             subscriptions,
                                             subscriptionStates,
                                             onToggleSubscription,
                                             onToggleSpam,
                                             groups = [],
                                             onAddToGroup,
                                             onRemoveFromGroup
                                         }) {
    const [searchQuery, setSearchQuery] = useState('');

    if (subscriptions.length === 0) return null;

    // Filtrar suscripciones por el nombre del remitente
    const filteredSubscriptions = subscriptions.filter(sub =>
        sub.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Box mt="6">
            <Text size="5" weight="bold" mb="4">
                Suscripciones Encontradas ({subscriptions.length})
            </Text>
            <Flex direction="column" gap="3">
                {subscriptions.map((sub, index) => {
                    const state = subscriptionStates[sub.senderEmail] || {};

                    return (
                        <SubscriptionCard
                            key={index}
                            subscription={sub}
                            state={state}
                            onToggleSubscription={onToggleSubscription}
                            onToggleSpam={onToggleSpam}
                            groups={groups}
                            onAddToGroup={onAddToGroup}
                            onRemoveFromGroup={onRemoveFromGroup}
                        />
                    );
                })}
            </Flex>
        </Box>
    );
}