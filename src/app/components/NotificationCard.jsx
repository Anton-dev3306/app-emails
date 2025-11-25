import { useEffect } from "react";
import { X } from "lucide-react";

export default function NotificationCard({ notification, onClose, duration = 4500 }) {
    if (!notification) return null;

    useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [onClose, duration]);

    return (
        <div className="
            border border-gray-300 rounded-lg p-4 mb-4 bg-white shadow-md
            flex items-start justify-between gap-4
        ">
            <div>
                <h3 className="font-bold text-lg mb-1">Notificación</h3>
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
