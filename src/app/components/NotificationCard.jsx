import { useEffect } from "react";
import { X } from "lucide-react";

export default function NotificationCard({ notification, onClose, duration = 5500 }) {
    if (!notification) return null;

    useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [onClose, duration]);

    return (
        <div className="
            border border-green-300 rounded-lg p-4 mb-4 bg-green-100 shadow-md
            flex items-start justify-between gap-4
        ">
            <div>
                <Button onClick={onSignOut} color="red" variant="soft" size="2">
                    <LogOut className="h-4 w-4" />
                    Cerrar Sesión
                </Button>
                <p className="text-base">{notification.message}</p>
            </div>

            <button
                onClick={onClose}
                className="text-yellow-100 hover:text-gray-700"
            >
                <X size={20} />
            </button>
        </div>
    );
}
