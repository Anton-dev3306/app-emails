"use client";
import { Select, Flex, Badge } from "@radix-ui/themes";
import { Folder } from "lucide-react";

export default function GroupSelector({ groups, selectedGroup, onSelectGroup }) {
    return (
        <Flex align="center" gap="2" style={{ minWidth: '200px' }}>
            <Folder className="h-4 w-4 text-gray-600" />
            <Select.Root value={selectedGroup || 'all'} onValueChange={onSelectGroup}>
                <Select.Trigger placeholder="Todos los grupos" style={{ width: '100%' }} />
                <Select.Content>
                    <Select.Item value="all">
                        <Flex align="center" gap="2">
                            Todas las newsletters
                            <Badge variant="soft" color="gray">Sin filtro</Badge>
                        </Flex>
                    </Select.Item>

                    <Select.Separator />

                    {groups.map((group) => (
                        <Select.Item key={group.id} value={group.id}>
                            <Flex align="center" gap="2">
                                <div style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: group.color
                                }} />
                                {group.groupName}
                                <Badge variant="soft">{group.newsletter_count}</Badge>
                            </Flex>
                        </Select.Item>
                    ))}
                </Select.Content>
            </Select.Root>
        </Flex>
    );
}