import { create } from "zustand";

export const useAppStore = create((set) => ({
  user: JSON.parse(localStorage.getItem("user")) || null,
  userData: null,
  users: null,
  loginTime: null,
  logoutTimer: null,

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

  setUsers: (users) => set((state) => ({ users })),
  setUserData: (userData) => set((state) => ({ userData })),
  setLoginTime: (loginTime) => set({ loginTime }),

  setLogoutTimer: (timer) => set({ logoutTimer: timer }),

  clearLogoutTimer: () => {
    const { logoutTimer } = get();
    if (logoutTimer) {
      clearTimeout(logoutTimer);
    }
    set({ logoutTimer: null });
  },

  logout: () => {
    const { clearLogoutTimer } = get();
    clearLogoutTimer();
    set({
      user: null,
      userData: null,
      loginTime: null,
      logoutTimer: null,
    });
  },
}));
