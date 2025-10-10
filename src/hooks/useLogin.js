// hooks/useLogin.js
import { useState } from "react";
import { auth } from "../firebase/config";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useAppStore } from "../lib/zustand";
import { toast } from "react-toastify";

export function useLogin() {
  const [isPending, setIsPending] = useState(false);
  const setUser = useAppStore((state) => state.setUser);
  const setLoginTime = useAppStore((state) => state.setLoginTime);
  const setLogoutTimer = useAppStore((state) => state.setLogoutTimer);
  const clearLogoutTimer = useAppStore((state) => state.clearLogoutTimer);
  const logout = useAppStore((state) => state.logout);

  // Функция для установки таймера автоматического выхода
  const setupAutoLogout = () => {
    clearLogoutTimer(); // Очищаем предыдущий таймер

    const timer = setTimeout(async () => {
      try {
        await signOut(auth);
        logout();
        toast.info("Сеанс завершен due to inactivity");
      } catch (error) {
        console.error("Auto logout error:", error);
        logout();
      }
    }, 1 * 60 * 1000); // 5 минут в миллисекундах

    setLogoutTimer(timer);
    setLoginTime(new Date());
  };

  const signIn = async (email, password) => {
    setIsPending(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      setUser(user);
      setupAutoLogout(); // Устанавливаем таймер после успешного входа

      toast.success(`Welcome, ${user.displayName || user.email}`);
      setIsPending(false);
    } catch (error) {
      toast.error(error.message);
      setIsPending(false);
    }
  };

  return { isPending, signIn, setupAutoLogout };
}
