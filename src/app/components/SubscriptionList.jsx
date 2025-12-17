"use client";
import { useState } from 'react';
import { Box, Text, Flex, TextField } from "@radix-ui/themes";
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import SubscriptionCard from './SubscriptionCard';

export default function SubscriptionList({
                                             subscriptions,
                                             subscriptionStates,
                                             onToggleSubscription,
                                             onToggleSpam
                                         }) {

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