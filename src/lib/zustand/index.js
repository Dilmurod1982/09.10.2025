import { create } from "zustand";
import { auth } from "../../firebase/config";
import { signOut } from "firebase/auth";
import { toast } from "react-toastify";

export const useAppStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem("user")) || null,
  userData: null,
  users: null,
  loginTime: null,
  logoutTimer: null,
  lastActivity: Date.now(),

  setUser: (user) => {
    set(() => {
      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
      } else {
        localStorage.removeItem("user");
      }
      return { user };
    });
  },

  setUsers: (users) => set({ users }),
  setUserData: (userData) => set({ userData }),
  setLoginTime: (loginTime) => set({ loginTime }),
  setLastActivity: (time) => set({ lastActivity: time }),

  // Очистка таймера
  clearLogoutTimer: () => {
    const state = get();
    if (state.logoutTimer) {
      clearTimeout(state.logoutTimer);
      set({ logoutTimer: null });
    }
  },

  // Обновление активности
  updateActivity: () => {
    const now = Date.now();
    set({ lastActivity: now });
    localStorage.setItem("lastActivityTime", now.toString());

    // Перезапускаем таймер
    const state = get();
    state.setupAutoLogout();
  },

  // Настройка автоматического выхода
  setupAutoLogout: () => {
    const state = get();
    state.clearLogoutTimer();

    const SESSION_TIMEOUT = 2 * 60 * 1000; // 10 минут

    const timer = setTimeout(() => {
      state.performLogout("Сеанс завершен из-за неактивности");
    }, SESSION_TIMEOUT);

    set({ logoutTimer: timer });
  },

  // Функция выхода
  performLogout: async (message = null) => {
    try {
      await signOut(auth);
      if (message) {
        toast.info(message);
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Всегда очищаем состояние
      const state = get();
      state.clearLogoutTimer();
      set({
        user: null,
        userData: null,
        loginTime: null,
        lastActivity: null,
      });

      // Очищаем localStorage
      localStorage.removeItem("sessionStartTime");
      localStorage.removeItem("lastActivityTime");
    }
  },

  // Логаут (публичный метод)
  logout: () => {
    const state = get();
    state.performLogout();
  },

  // Проверка существующей сессии
  checkExistingSession: () => {
    const sessionStart = localStorage.getItem("sessionStartTime");
    const lastActivityTime = localStorage.getItem("lastActivityTime");

    if (sessionStart && lastActivityTime) {
      const currentTime = Date.now();
      const timeSinceLastActivity = currentTime - parseInt(lastActivityTime);
      const SESSION_TIMEOUT = 2 * 60 * 1000;

      if (timeSinceLastActivity > SESSION_TIMEOUT) {
        // Сессия истекла
        const state = get();
        state.performLogout();
        return false;
      } else {
        // Восстанавливаем сессию
        set({ lastActivity: parseInt(lastActivityTime) });
        const state = get();
        state.setupAutoLogout();
        return true;
      }
    }
    return false;
  },

  // Инициализация сессии при логине
  initializeSession: () => {
    const now = Date.now();
    localStorage.setItem("sessionStartTime", now.toString());
    localStorage.setItem("lastActivityTime", now.toString());
    set({ lastActivity: now });
    const state = get();
    state.setupAutoLogout();
  },
}));
