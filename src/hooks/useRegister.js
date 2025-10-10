import { toast } from "react-toastify";
import { auth } from "../firebase/config";
import { useAppStore } from "../lib/zustand";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";

function useRegister() {
  const [isPending, setIsPending] = useState(false);
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);

  const registerEmailAndPassword = async (email, password, displayName) => {
    try {
      const register = createUserWithEmailAndPassword(auth, email, password);
      const user = (await register).user;
      await updateProfile(auth.currentUser, { displayName });
      setUser(user);
      toast.success("Welcome");
    } catch (error) {
      const errorMessage = error.message;
      toast.error(errorMessage);
    }
  };
}
