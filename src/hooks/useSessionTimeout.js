import { useState, useEffect, useCallback, useRef } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { useAppStore } from "../lib/zustand";

const useSessionTimeout = () => {
  const setUser = useAppStore((state) => state.setUser);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const timeoutRef = useRef(null);

  // 10 минут в миллисекундах
  const SESSION_TIMEOUT = 10 * 60 * 1000;

  // Функция выхода
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      setUser(null);
      localStorage.removeItem("sessionStartTime");
      localStorage.removeItem("lastActivityTime");
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  }, [setUser]);

  // Функция обновления времени активности
  const updateActivity = useCallback(() => {
    const now = Date.now();
    setLastActivity(now);
    localStorage.setItem("lastActivityTime", now.toString());
  }, []);

  // Функция проверки сессии при загрузке
  const checkExistingSession = useCallback(() => {
    const sessionStart = localStorage.getItem("sessionStartTime");
    const lastActivityTime = localStorage.getItem("lastActivityTime");

    if (sessionStart && lastActivityTime) {
      const currentTime = Date.now();
      const timeSinceLastActivity = currentTime - parseInt(lastActivityTime);

      if (timeSinceLastActivity > SESSION_TIMEOUT) {
        // Сессия истекла
        logout();
        return false;
      } else {
        // Сессия активна, обновляем таймер
        setLastActivity(parseInt(lastActivityTime));
        return true;
      }
    }
    return false;
  }, [SESSION_TIMEOUT, logout]);

  // Инициализация сессии при логине
  const startSession = useCallback(() => {
    const now = Date.now();
    localStorage.setItem("sessionStartTime", now.toString());
    localStorage.setItem("lastActivityTime", now.toString());
    setLastActivity(now);
  }, []);

  // Основной таймер неактивности
  useEffect(() => {
    const setupTimeout = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        logout();
      }, SESSION_TIMEOUT);
    };

    setupTimeout();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [lastActivity, SESSION_TIMEOUT, logout]);

  // Отслеживание событий активности
  useEffect(() => {
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
      "keydown",
    ];

    const handleActivity = () => {
      updateActivity();
    };

    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [updateActivity]);

  return {
    updateActivity,
    logout,
    startSession,
    checkExistingSession,
  };
};

export default useSessionTimeout;
