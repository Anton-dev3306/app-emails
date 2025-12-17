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
            <Flex direction="column" gap="4" mb="4">
                <Text size="5" weight="bold">
                    Remitentes encontrados ({subscriptions.length})
                </Text>

                <TextField.Root
                    placeholder="Buscar remitente..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    size="3"
                >
                    <TextField.Slot>
                        <MagnifyingGlassIcon height="16" width="16" />
                    </TextField.Slot>
                </TextField.Root>

                {searchQuery && (
                    <Text size="2" color="gray">
                        {filteredSubscriptions.length} resultado{filteredSubscriptions.length !== 1 ? 's' : ''} encontrado{filteredSubscriptions.length !== 1 ? 's' : ''}
                    </Text>
                )}
            </Flex>

            <Flex direction="column" gap="3">
                {filteredSubscriptions.length > 0 ? (
                    filteredSubscriptions.map((sub) => {
                        const state = subscriptionStates[sub.email] || {};

                        return (
                            <SubscriptionCard
                                key={sub.email}
                                subscription={sub}
                                state={state}
                                onToggleSubscription={onToggleSubscription}
                                onToggleSpam={onToggleSpam}
                                groups={groups}
                                onAddToGroup={onAddToGroup}
                                onRemoveFromGroup={onRemoveFromGroup}
                            />
                        );
                    })
                ) : (
                    <Box py="6" style={{ textAlign: 'center' }}>
                        <Text size="3" color="gray">
                            No se encontraron remitentes que coincidan con "{searchQuery}"
                        </Text>
                    </Box>
                )}
            </Flex>
        </Box>
    );
}