import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAppStore } from "../lib/zustand";
import useActivityTracker from "../hooks/useActivityTracker";

function ProtectedRoutes({ children, user }) {
  const checkExistingSession = useAppStore(
    (state) => state.checkExistingSession
  );
  const updateActivity = useAppStore((state) => state.updateActivity);

  // Подключаем отслеживание активности
  useActivityTracker();

  useEffect(() => {
    if (user) {
      // Проверяем существующую сессию при загрузке
      checkExistingSession();

      // Обновляем активность при монтировании
      updateActivity();
    }
  }, [user, checkExistingSession, updateActivity]);

  if (user) {
    return children;
  } else {
    return <Navigate to="/login" replace />;
  }
}

export default ProtectedRoutes;
