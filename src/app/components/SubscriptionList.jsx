"use client";
import { Box, Text, Flex } from "@radix-ui/themes";
import SubscriptionCard from './SubscriptionCard';
export default function SubscriptionList({
                                             subscriptions,
                                             subscriptionStates,
                                             onToggleSubscription,
                                             onToggleSpam,
                                             groups = [],
                                             onAddToGroup
                                         }) {
    if (subscriptions.length === 0) return null;

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
                        />
                    );
                })}
            </Flex>
        </Box>
    );
}