import React, { useState, useEffect } from "react";
import { useAppStore } from "../lib/zustand";

const SessionWarning = () => {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const updateActivity = useAppStore((state) => state.updateActivity);
  const performLogout = useAppStore((state) => state.performLogout);

  useEffect(() => {
    const checkTimeout = () => {
      const lastActivityTime = localStorage.getItem("lastActivityTime");
      if (lastActivityTime) {
        const currentTime = Date.now();
        const timeSinceLastActivity = currentTime - parseInt(lastActivityTime);
        const warningTime = 9 * 60 * 1000; // Предупреждение за 1 минуту до выхода

        if (
          timeSinceLastActivity > warningTime &&
          timeSinceLastActivity < 10 * 60 * 1000
        ) {
          setShowWarning(true);
          const timeLeft = Math.ceil(
            (10 * 60 * 1000 - timeSinceLastActivity) / 1000
          );
          setCountdown(timeLeft);
        } else {
          setShowWarning(false);
        }
      }
    };

    const interval = setInterval(checkTimeout, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleStayLoggedIn = () => {
    updateActivity();
    setShowWarning(false);
  };

  const handleLogout = () => {
    performLogout();
    setShowWarning(false);
  };

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Сессия скоро завершится
        </h3>
        <p className="text-gray-600 mb-4">
          Ваша сессия будет автоматически завершена через {countdown} секунд
          из-за неактивности.
        </p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
            Выйти
          </button>
          <button
            onClick={handleStayLoggedIn}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
            Остаться в системе
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionWarning;
