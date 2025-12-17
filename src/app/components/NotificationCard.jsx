import {X} from "lucide-react";

export default function NotificationCard({ notification, onClose}) {
    if (!notification) return null;


    return (
        <div className="
            border border-green-300 rounded-lg p-4 mb-4 bg-green-100 shadow-md
            flex items-start justify-between gap-4
        ">
            <div>

                <p className="text-base">
                    <button
                        onClick={onClose}
                        className=" justify-self-end p-1
               bg-gray-200 hover:bg-gray-300 rounded-full text-red-500"
                    >
                        <X size={20} />
                    </button>
                    {notification.message}</p>
            </div>
        </div>
    );
}
