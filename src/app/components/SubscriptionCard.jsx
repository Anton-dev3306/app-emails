"use client";
import { Card, Flex, Text, Box, Badge, Button } from "@radix-ui/themes";
import { Loader, AlertTriangle, RefreshCw, Trash2, ShieldOff, Ban } from 'lucide-react';
import AddToGroupButton from './AddToGroupButton';
import RemoveFromGroupButton from './RemoveFromGroupButton';

export default function SubscriptionCard({
                                             subscription,
                                             state = {},
                                             onToggleSubscription,
                                             onToggleSpam,
                                             groups = [],
                                             onAddToGroup,
                                             onRemoveFromGroup
                                         }) {
    const isUnsubscribed = state.unsubscribed;
    const isMarkedAsSpam = state.markedAsSpam;

    return (
        <Card style={{
            backgroundColor: isMarkedAsSpam ? 'var(--orange-2)' : 'var(--gray-2)'
        }}>
            <Flex justify="between" align="start" gap="4">
                <Box style={{ flex: 1 }}>
                    <Text weight="bold" size="3" mb="1">
                        {subscription.sender}
                    </Text>
                    <br/>
                    <Text size="2" color="gray" mb="2">
                        {subscription.senderEmail}
                    </Text>
                    <Flex gap="2" wrap="wrap">
                        <Badge color="blue" variant="soft">
                            {subscription.frequency}
                        </Badge>
                        <Badge color="green" variant="soft">
                            {subscription.category}
                        </Badge>
                        {isMarkedAsSpam && (
                            <Badge color="orange" variant="soft">
                                Marcado como spam
                            </Badge>
                        )}
                    </Flex>
                </Box>

                <Flex direction="column" gap="2" style={{ flexShrink: 0 }}>
                    {groups.length > 0 && (
                        <>
                            {/* Botón agregar a grupo */}
                            <AddToGroupButton
                                subscription={subscription}
                                groups={groups}
                                onAddToGroup={onAddToGroup}
                            />

                            {/* Botón remover de grupo */}
                            <RemoveFromGroupButton
                                subscription={subscription}
                                groups={groups}
                                onRemoveFromGroup={onRemoveFromGroup}
                            />
                        </>
                    )}

                    {/* Botón de Marcar/Desmarcar Spam */}
                    <Button
                        onClick={() => onToggleSpam(subscription)}
                        disabled={state.loadingSpam}
                        color={isMarkedAsSpam ? "green" : "orange"}
                        variant="soft"
                        size="2"
                    >
                        {state.loadingSpam ? (
                            <Flex align="center" gap="2">
                                <Loader className="animate-spin h-4 w-4" />
                                Procesando...
                            </Flex>
                        ) : state.errorSpam ? (
                            <Flex align="center" gap="2">
                                <AlertTriangle className="h-4 w-4" />
                                Reintentar
                            </Flex>
                        ) : isMarkedAsSpam ? (
                            <Flex align="center" gap="2">
                                <ShieldOff className="h-4 w-4" />
                                Desmarcar Spam
                            </Flex>
                        ) : (
                            <Flex align="center" gap="2">
                                <Ban className="h-4 w-4" />
                                Marcar Spam
                            </Flex>
                        )}
                    </Button>
                </Flex>
            </Flex>
        </Card>
    );
}