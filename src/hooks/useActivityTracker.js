import { useEffect } from "react";
import { useAppStore } from "../lib/zustand";

const useActivityTracker = () => {
  const updateActivity = useAppStore((state) => state.updateActivity);

  useEffect(() => {
    // События для отслеживания активности
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
      "keydown",
      "wheel",
      "resize",
      "focus",
    ];

    const handleActivity = () => {
      updateActivity();
    };

    // Добавляем обработчики событий
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Очистка
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [updateActivity]);

  return null;
};

export default useActivityTracker;
