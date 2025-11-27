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

                <p className="text-base">
                    <button
                        onClick={onClose}
                        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center
               bg-gray-200 hover:bg-gray-300 rounded-full text-gray-700"
                    >
                        <X size={20} />
                    </button>
                    {notification.message}</p>
            </div>

            <button
                onClick={onClose}
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center
               bg-gray-200 hover:bg-gray-300 rounded-full text-gray-700"
            >
                <X size={20} />
            </button>
        </div>
    );
}
