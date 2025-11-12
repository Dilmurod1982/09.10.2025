import { useState } from "react";
import { auth, db } from "../firebase/config";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAppStore } from "../lib/zustand";

export function useLogin() {
  const [isPending, setIsPending] = useState(false);
  const setUser = useAppStore((state) => state.setUser);
  const setUserData = useAppStore((state) => state.setUserData);
  const initializeSession = useAppStore((state) => state.initializeSession);

  const signIn = async (email, password) => {
    setIsPending(true);
    try {
      // 1. Аутентификация в Firebase Auth
      const result = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = result.user;

      // 2. Поиск пользователя в Firestore по email
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log("❌ Фойдаланувчи топилмади:", email);
        throw new Error("Фойдаланувчи маълумотлари тизимда топилмади");
      }

      // Берем первый найденный документ
      const userDoc = querySnapshot.docs[0];
      const userDataFromFirestore = userDoc.data();

      // 3. Проверяем совпадение UID (предупреждение, но продолжаем)
      if (userDataFromFirestore.uid !== firebaseUser.uid) {
        console.warn("⚠️ ID тўғри келмади, лекин кириш давом этилди");
      }

      // 4. Сохранение в Zustand
      setUser(firebaseUser);
      setUserData(userDataFromFirestore);
      initializeSession();

      setIsPending(false);

      // Возвращаем данные пользователя для показа тоста в компоненте
      return {
        success: true,
        user: userDataFromFirestore,
        // message: `Xush kelibsiz, ${
        //   userDataFromFirestore.firstName || userDataFromFirestore.name || ""
        // }`.trim(),
      };
    } catch (error) {
      console.error("❌ Login error:", error);

      let errorMessage = "Киришда хатолик";

      switch (error.code) {
        case "auth/invalid-email":
          errorMessage = "Email киритишда нотўғри формат";
          break;
        case "auth/user-not-found":
          errorMessage = "Фойдаланувчи топилмади";
          break;
        case "auth/wrong-password":
          errorMessage = "Нотўғри пароль";
          break;
        case "auth/too-many-requests":
          errorMessage = "Жуда кўп уруниш. Кейинроқ қайта уриниб кўринг";
          break;
        default:
          errorMessage = error.message || "Номаълум хатолик юз берди";
      }

      setIsPending(false);

      // Выход из системы в случае ошибки
      if (auth.currentUser) {
        await auth.signOut();
      }

      return { success: false, error: errorMessage };
    }
  };

  return { isPending, signIn };
}
