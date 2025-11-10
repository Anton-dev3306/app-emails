"use client";
import { useState } from 'react';
import { Button, DropdownMenu, Flex } from "@radix-ui/themes";
import { FolderMinus, X } from "lucide-react";

export default function RemoveFromGroupButton({ subscription, groups, onRemoveFromGroup }) {
    const [isRemoving, setIsRemoving] = useState(false);

    const handleRemoveFromGroup = async (groupId) => {
        setIsRemoving(true);
        try {
            await onRemoveFromGroup(groupId, subscription.senderEmail);
        } catch (error) {
            console.error('Error removing from group:', error);
        } finally {
            setIsRemoving(false);
        }
    };

    // Filtrar solo los grupos que contienen esta newsletter
    const groupsWithNewsletter = groups.filter(group =>
        group.newsletters?.some(n => n.senderEmail === subscription.senderEmail)
    );

    // Si no está en ningún grupo, no mostrar el botón
    if (groupsWithNewsletter.length === 0) {
        return null;
    }

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger>
                <Button size="2" variant="soft" color="red" disabled={isRemoving}>
                    <FolderMinus className="h-4 w-4" />
                    Quitar de grupo
                </Button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Content>
                {groupsWithNewsletter.map((group) => (
                    <DropdownMenu.Item
                        key={group.id}
                        onClick={() => handleRemoveFromGroup(group.id)}
                    >
                        <Flex align="center" gap="2" style={{ width: '100%' }}>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: group.color
                            }} />
                            {group.groupName}
                            <X className="h-3 w-3 ml-auto text-red-600" />
                        </Flex>
                    </DropdownMenu.Item>
                ))}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );
}