import { useState } from "react";
import { auth } from "../firebase/config";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useAppStore } from "../lib/zustand";
import { toast } from "react-toastify";

export function useLogin() {
  const [isPending, setIsPending] = useState(false);
  const setUser = useAppStore((state) => state.setUser);
  const initializeSession = useAppStore((state) => state.initializeSession);

  const signIn = async (email, password) => {
    setIsPending(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      setUser(user);
      initializeSession();

      toast.success(`Xush kelibsiz, ${user.displayName || user.email}`);
      setIsPending(false);
      return { success: true };
    } catch (error) {
      toast.error(error.message);
      setIsPending(false);
      return { success: false, error: error.message };
    }
  };

  return { isPending, signIn };
}
