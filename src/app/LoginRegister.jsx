"use client";
import { useState } from 'react';
import { Card, Flex, Text, Button, TextField, Box, Tabs } from "@radix-ui/themes";
import { Mail, Lock, User, Loader } from 'lucide-react';

export default function LoginRegister({ onLogin, onRegister }) {
    const [activeTab, setActiveTab] = useState('login');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Login form
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Register form
    const [registerName, setRegisterName] = useState('');
    const [registerEmail, setRegisterEmail] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await onLogin(loginEmail, loginPassword);

        if (!result.success) {
            setError(result.error);
        }

        setLoading(false);
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await onRegister(registerName, registerEmail, registerPassword);

        if (!result.success) {
            setError(result.error);
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
            <Card style={{ maxWidth: '450px', width: '100%' }} size="4">
                <Flex direction="column" gap="4">
                    <Box style={{ textAlign: 'center' }} mb="2">
                        <Text size="7" weight="bold">
                            📧 Gmail Manager
                        </Text>
                    </Box>

                    <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
                        <Tabs.List>
                            <Tabs.Trigger value="login">Iniciar Sesión</Tabs.Trigger>
                            <Tabs.Trigger value="register">Crear Cuenta</Tabs.Trigger>
                        </Tabs.List>

                        <Box pt="4">
                            {/* TAB LOGIN */}
                            <Tabs.Content value="login">
                                <form onSubmit={handleLogin}>
                                    <Flex direction="column" gap="3">
                                        <Box>
                                            <Text size="2" weight="medium" mb="1">Email</Text>
                                            <TextField.Root
                                                type="email"
                                                placeholder="tu@email.com"
                                                value={loginEmail}
                                                onChange={(e) => setLoginEmail(e.target.value)}
                                                required
                                                size="3"
                                            >
                                                <TextField.Slot>
                                                    <Mail className="h-4 w-4" />
                                                </TextField.Slot>
                                            </TextField.Root>
                                        </Box>

                                        <Box>
                                            <Text size="2" weight="medium" mb="1">Contraseña</Text>
                                            <TextField.Root
                                                type="password"
                                                placeholder="••••••••"
                                                value={loginPassword}
                                                onChange={(e) => setLoginPassword(e.target.value)}
                                                required
                                                size="3"
                                            >
                                                <TextField.Slot>
                                                    <Lock className="h-4 w-4" />
                                                </TextField.Slot>
                                            </TextField.Root>
                                        </Box>

                                        {error && (
                                            <Text size="2" color="red">{error}</Text>
                                        )}

                                        <Button type="submit" size="3" disabled={loading}>
                                            {loading ? (
                                                <Flex align="center" gap="2">
                                                    <Loader className="animate-spin h-4 w-4" />
                                                    Iniciando...
                                                </Flex>
                                            ) : (
                                                'Iniciar Sesión'
                                            )}
                                        </Button>
                                    </Flex>
                                </form>
                            </Tabs.Content>

                            {/* TAB REGISTER */}
                            <Tabs.Content value="register">
                                <form onSubmit={handleRegister}>
                                    <Flex direction="column" gap="3">
                                        <Box>
                                            <Text size="2" weight="medium" mb="1">Nombre</Text>
                                            <TextField.Root
                                                type="text"
                                                placeholder="Tu nombre"
                                                value={registerName}
                                                onChange={(e) => setRegisterName(e.target.value)}
                                                required
                                                size="3"
                                            >
                                                <TextField.Slot>
                                                    <User className="h-4 w-4" />
                                                </TextField.Slot>
                                            </TextField.Root>
                                        </Box>

                                        <Box>
                                            <Text size="2" weight="medium" mb="1">Email</Text>
                                            <TextField.Root
                                                type="email"
                                                placeholder="tu@email.com"
                                                value={registerEmail}
                                                onChange={(e) => setRegisterEmail(e.target.value)}
                                                required
                                                size="3"
                                            >
                                                <TextField.Slot>
                                                    <Mail className="h-4 w-4" />
                                                </TextField.Slot>
                                            </TextField.Root>
                                        </Box>

                                        <Box>
                                            <Text size="2" weight="medium" mb="1">Contraseña</Text>
                                            <TextField.Root
                                                type="password"
                                                placeholder="Mínimo 6 caracteres"
                                                value={registerPassword}
                                                onChange={(e) => setRegisterPassword(e.target.value)}
                                                required
                                                minLength={6}
                                                size="3"
                                            >
                                                <TextField.Slot>
                                                    <Lock className="h-4 w-4" />
                                                </TextField.Slot>
                                            </TextField.Root>
                                        </Box>

                                        {error && (
                                            <Text size="2" color="red">{error}</Text>
                                        )}

                                        <Button type="submit" size="3" disabled={loading}>
                                            {loading ? (
                                                <Flex align="center" gap="2">
                                                    <Loader className="animate-spin h-4 w-4" />
                                                    Creando cuenta...
                                                </Flex>
                                            ) : (
                                                'Crear Cuenta'
                                            )}
                                        </Button>
                                    </Flex>
                                </form>
                            </Tabs.Content>
                        </Box>
                    </Tabs.Root>
                </Flex>
            </Card>
        </div>
    );
}