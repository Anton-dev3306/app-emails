"use client";
import { useState } from 'react';
import { Card, Flex, Text, Button, Box, Badge, Dialog, TextField, TextArea } from "@radix-ui/themes";
import { Plus, Edit, Trash2, Folder, X } from 'lucide-react';

export default function GroupManagementPanel({
                                                 groups,
                                                 onCreateGroup,
                                                 onUpdateGroup,
                                                 onDeleteGroup,
                                                 onRemoveFromGroup
                                             }) {
    console.log('[Panel] Grupos recibidos:', groups);
    console.log('[Panel] Es array?:', Array.isArray(groups));
    console.log('[Panel] Total:', groups?.length);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);

    const [groupName, setGroupName] = useState('');
    const [groupDesc, setGroupDesc] = useState('');
    const [groupColor, setGroupColor] = useState('#3b82f6');

    const handleCreate = async () => {
        if (!groupName.trim()) return;

        const result = await onCreateGroup(groupName, groupDesc, groupColor);

        if (result.success) {
            setGroupName('');
            setGroupDesc('');
            setGroupColor('#3b82f6');
            setIsCreateOpen(false);
        } else {
            alert(result.error);
        }
    };

    const handleUpdate = async () => {
        if (!editingGroup || !groupName.trim()) return;

        const result = await onUpdateGroup(editingGroup.id, {
            group_name: groupName,
            description: groupDesc,
            color: groupColor
        });

        if (result.success) {
            setIsEditOpen(false);
            setEditingGroup(null);
        } else {
            alert(result.error);
        }
    };

    const openEdit = (group) => {
        setEditingGroup(group);
        setGroupName(group.groupName);
        setGroupDesc(group.description || '');
        setGroupColor(group.color);
        setIsEditOpen(true);
    };

    return (
        <Card size="2">
            <Flex direction="column" gap="3">
                <Flex justify="between" align="center">
                    <Flex align="center" gap="2">
                        <Folder className="h-5 w-5" />
                        <Text size="4" weight="bold">Mis Grupos</Text>
                    </Flex>
                    <Dialog.Root open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <Dialog.Trigger>
                            <Button size="1" variant="soft">
                                <Plus className="h-3 w-3" />
                            </Button>
                        </Dialog.Trigger>
                        <Dialog.Content style={{ maxWidth: 400 }}>
                            <Dialog.Title>Crear Grupo</Dialog.Title>
                            <Flex direction="column" gap="3" mt="3">
                                <Box>
                                    <Text size="2" weight="medium" mb="1">Nombre</Text>
                                    <TextField.Root
                                        placeholder="Ej: Trabajo, Personal"
                                        value={groupName}
                                        onChange={(e) => setGroupName(e.target.value)}
                                    />
                                </Box>
                                <Box>
                                    <Text size="2" weight="medium" mb="1">Descripción</Text>
                                    <TextArea
                                        placeholder="Opcional"
                                        value={groupDesc}
                                        onChange={(e) => setGroupDesc(e.target.value)}
                                    />
                                </Box>
                                <Box>
                                    <Text size="2" weight="medium" mb="1">Color</Text>
                                    <input
                                        type="color"
                                        value={groupColor}
                                        onChange={(e) => setGroupColor(e.target.value)}
                                        style={{ width: '100%', height: '36px', cursor: 'pointer' }}
                                    />
                                </Box>
                                <Flex gap="2" justify="end">
                                    <Dialog.Close>
                                        <Button variant="soft" color="gray">Cancelar</Button>
                                    </Dialog.Close>
                                    <Button onClick={handleCreate}>Crear</Button>
                                </Flex>
                            </Flex>
                        </Dialog.Content>
                    </Dialog.Root>
                </Flex>

                {!groups || groups.length === 0 ? (
                    <Text size="2" color="gray">No tienes grupos. ¡Crea uno!</Text>
                ) : (
                    <Flex direction="column" gap="2">
                        {groups.map((group) => (
                            <Card key={group.id} variant="surface" style={{ borderLeft: `3px solid ${group.color}` }}>
                                <Flex direction="column" gap="2">
                                    <Flex justify="between" align="start">
                                        <Flex direction="column" gap="1" style={{ flex: 1 }}>
                                            <Text size="2" weight="bold">{group.groupName}</Text>
                                            {group.description && (
                                                <Text size="1" color="gray">{group.description}</Text>
                                            )}
                                            <Badge size="1" variant="soft">
                                                {group.newsletter_count || 0} newsletters
                                            </Badge>
                                        </Flex>
                                        <Flex gap="1">
                                            <Button size="1" variant="ghost" onClick={() => openEdit(group)}>
                                                <Edit className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                size="1"
                                                variant="ghost"
                                                color="red"
                                                onClick={() => onDeleteGroup(group.id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </Flex>
                                    </Flex>

                                    {group.newsletters && group.newsletters.length > 0 && (
                                        <Flex gap="1" wrap="wrap">
                                            {group.newsletters.slice(0, 3).map((item) => (
                                                <Badge key={item.id} size="1" variant="outline">
                                                    <Flex align="center" gap="1">
                                                        {item.senderName || item.senderEmail}
                                                        <X
                                                            className="h-2 w-2 cursor-pointer"
                                                            onClick={() => onRemoveFromGroup(group.id, item.senderEmail)}
                                                        />
                                                    </Flex>
                                                </Badge>
                                            ))}
                                            {group.newsletters.length > 3 && (
                                                <Badge size="1" variant="soft">
                                                    +{group.newsletters.length - 3} más
                                                </Badge>
                                            )}
                                        </Flex>
                                    )}
                                </Flex>
                            </Card>
                        ))}
                    </Flex>
                )}
            </Flex>

            {/* Dialog de edición */}
            <Dialog.Root open={isEditOpen} onOpenChange={setIsEditOpen}>
                <Dialog.Content style={{ maxWidth: 400 }}>
                    <Dialog.Title>Editar Grupo</Dialog.Title>
                    <Flex direction="column" gap="3" mt="3">
                        <Box>
                            <Text size="2" weight="medium" mb="1">Nombre</Text>
                            <TextField.Root
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                            />
                        </Box>
                        <Box>
                            <Text size="2" weight="medium" mb="1">Descripción</Text>
                            <TextArea
                                value={groupDesc}
                                onChange={(e) => setGroupDesc(e.target.value)}
                            />
                        </Box>
                        <Box>
                            <Text size="2" weight="medium" mb="1">Color</Text>
                            <input
                                type="color"
                                value={groupColor}
                                onChange={(e) => setGroupColor(e.target.value)}
                                style={{ width: '100%', height: '36px' }}
                            />
                        </Box>
                        <Flex gap="2" justify="end">
                            <Dialog.Close>
                                <Button variant="soft" color="gray">Cancelar</Button>
                            </Dialog.Close>
                            <Button onClick={handleUpdate}>Guardar</Button>
                        </Flex>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>
        </Card>
    );
}