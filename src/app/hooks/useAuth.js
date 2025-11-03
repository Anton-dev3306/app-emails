// hooks/useAuth.js
import { useState, useEffect } from 'react';

const API_URL = 'http://localhost/tu-backend-php'; // Cambia esto a tu URL

export function useAuth() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Cargar usuario desde localStorage al iniciar
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        try {
            const response = await fetch(`${API_URL}/login.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Error al iniciar sesión');
            }

            // Guardar usuario en estado y localStorage
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));

            return { success: true, user: data.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const register = async (name, email, password, avatarUrl = null) => {
        try {
            const response = await fetch(`${API_URL}/create.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, avatar_url: avatarUrl })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Error al crear cuenta');
            }

            // Auto-login después del registro
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));

            return { success: true, user: data.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const updateAccount = async (id, updates) => {
        try {
            const response = await fetch(`${API_URL}/update.php`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...updates })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Error al actualizar cuenta');
            }

            // Actualizar usuario en estado y localStorage
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));

            return { success: true, user: data.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const deleteAccount = async (id) => {
        try {
            const response = await fetch(`${API_URL}/delete.php`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Error al eliminar cuenta');
            }

            // Logout después de eliminar
            logout();

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
    };

    return {
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        updateAccount,
        deleteAccount,
        logout
    };
}