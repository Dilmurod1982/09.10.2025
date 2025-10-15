import { create } from "zustand";
import { auth, db } from "../../firebase/config";
import { signOut } from "firebase/auth";
import { toast } from "react-toastify";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

export const useAppStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem("user")) || null,
  userData: null,
  users: null,
  loginTime: null,
  logoutTimer: null,
  lastActivity: Date.now(),
  documents: [],
  setDocuments: (documents) => set({ documents }),

  // === Пользователи ===
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

  clearLogoutTimer: () => {
    const state = get();
    if (state.logoutTimer) {
      clearTimeout(state.logoutTimer);
      set({ logoutTimer: null });
    }
  },

  updateActivity: () => {
    const now = Date.now();
    set({ lastActivity: now });
    localStorage.setItem("lastActivityTime", now.toString());
    const state = get();
    state.setupAutoLogout();
  },

  setupAutoLogout: () => {
    const state = get();
    state.clearLogoutTimer();
    const SESSION_TIMEOUT = 10 * 60 * 1000; // 🔹 10 минут
    const timer = setTimeout(() => {
      state.performLogout("Сеанс завершен из-за неактивности");
    }, SESSION_TIMEOUT);
    set({ logoutTimer: timer });
  },

  performLogout: async (message = null) => {
    try {
      await signOut(auth);
      if (message) toast.info(message);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      const state = get();
      state.clearLogoutTimer();
      set({
        user: null,
        userData: null,
        loginTime: null,
        lastActivity: null,
      });
      localStorage.removeItem("sessionStartTime");
      localStorage.removeItem("lastActivityTime");
    }
  },

  logout: () => {
    const state = get();
    state.performLogout();
  },

  checkExistingSession: () => {
    const sessionStart = localStorage.getItem("sessionStartTime");
    const lastActivityTime = localStorage.getItem("lastActivityTime");

    if (sessionStart && lastActivityTime) {
      const currentTime = Date.now();
      const timeSinceLastActivity = currentTime - parseInt(lastActivityTime);
      const SESSION_TIMEOUT = 10 * 60 * 1000;

      if (timeSinceLastActivity > SESSION_TIMEOUT) {
        const state = get();
        state.performLogout();
        return false;
      } else {
        set({ lastActivity: parseInt(lastActivityTime) });
        const state = get();
        state.setupAutoLogout();
        return true;
      }
    }
    return false;
  },

  initializeSession: () => {
    const now = Date.now();
    localStorage.setItem("sessionStartTime", now.toString());
    localStorage.setItem("lastActivityTime", now.toString());
    set({ lastActivity: now });
    const state = get();
    state.setupAutoLogout();
  },
  refreshDocuments: async () => {
    try {
      const q = query(
        collection(db, "documents"),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const documentsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      set({ documents: documentsData });
    } catch (error) {
      console.error("Error refreshing documents:", error);
    }
  },
}));
