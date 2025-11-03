"use client";
import { useState } from 'react';
import { Button, DropdownMenu, Flex } from "@radix-ui/themes";
import { FolderPlus, Check } from "lucide-react";

export default function AddToGroupButton({ subscription, groups, onAddToGroup }) {
    const [isAdding, setIsAdding] = useState(false);

    const handleAddToGroup = async (groupId) => {
        setIsAdding(true);
        await onAddToGroup(groupId, subscription);
        setIsAdding(false);
    };

    const isInGroup = (groupId) => {
        const group = groups.find(g => g.id === groupId);
        return group?.newsletters?.some(n => n.senderEmail === subscription.senderEmail);
    };

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger>
                <Button size="2" variant="soft" color="green" disabled={isAdding}>
                    <FolderPlus className="h-4 w-4" />
                    Agregar a grupo
                </Button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Content>
                {groups.length === 0 ? (
                    <DropdownMenu.Item disabled>
                        No hay grupos disponibles
                    </DropdownMenu.Item>
                ) : (
                    groups.map((group) => (
                        <DropdownMenu.Item
                            key={group.id}
                            onClick={() => handleAddToGroup(group.id)}
                            disabled={isInGroup(group.id)}
                        >
                            <Flex align="center" gap="2" style={{ width: '100%' }}>
                                <div style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: group.color
                                }} />
                                {group.groupName}
                                {isInGroup(group.id) && (
                                    <Check className="h-3 w-3 ml-auto text-green-600" />
                                )}
                            </Flex>
                        </DropdownMenu.Item>
                    ))
                )}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );
}