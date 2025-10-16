import { useState } from "react";
import { auth, db } from "../firebase/config";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useAppStore } from "../lib/zustand";
import { toast } from "react-toastify";
import { ToastBar } from "react-hot-toast";

export function useLogin() {
  const [isPending, setIsPending] = useState(false);
  const setUser = useAppStore((state) => state.setUser);
  const setUserData = useAppStore((state) => state.setUserData);
  const loadUserData = useAppStore((state) => state.loadUserData); // 🔹 Добавьте это
  const initializeSession = useAppStore((state) => state.initializeSession);

  const signIn = async (email, password) => {
    setIsPending(true);
    try {
      // console.log("🔐 Начало аутентификации:", email);

      // 1. Аутентификация в Firebase Auth
      const result = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = result.user;

      // console.log("✅ Firebase Auth успешно");
      // console.log("🔑 Firebase UID:", firebaseUser.uid);
      // console.log("📧 Firebase Email:", firebaseUser.email);

      // 2. Поиск пользователя в Firestore по email (так как UID не совпадают)
      // console.log("🔍 Поиск пользователя в Firestore по email:", email);

      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);

      // console.log("📊 Найдено документов:", querySnapshot.size);

      if (querySnapshot.empty) {
        console.log("❌ Пользователь не найден в Firestore по email:", email);
        throw new Error("Данные пользователя не найдены в системе");
      }

      // Берем первый найденный документ
      const userDoc = querySnapshot.docs[0];
      const userDataFromFirestore = userDoc.data();

      // console.log("✅ Пользователь найден в Firestore:");
      // console.log("📄 Firestore UID:", userDataFromFirestore.uid);
      // console.log("👤 Firestore Role:", userDataFromFirestore.role);
      // console.log("📋 Все данные:", userDataFromFirestore);

      // 3. Проверяем совпадение UID
      if (userDataFromFirestore.uid !== firebaseUser.uid) {
        // console.warn("⚠️ UID не совпадают:");
        // console.warn("Firebase UID:", firebaseUser.uid);
        // console.warn("Firestore UID:", userDataFromFirestore.uid);
        // Но продолжаем, так как пользователь найден по email
        // console.log("🔄 Продолжаем вход, так как пользователь найден по email");
      }

      // 4. Сохранение в Zustand
      setUser(firebaseUser);
      setUserData(userDataFromFirestore); // Сохраняем в стейт и localStorage
      initializeSession();

      toast.done(
        `Xush kelibsiz, janob ${
          userDataFromFirestore.firstName || userDataFromFirestore.firstName
        }`
      );
      setIsPending(false);
      return { success: true, user: userDataFromFirestore };
    } catch (error) {
      console.error("❌ Login error:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);

      let errorMessage = "Ошибка входа";

      switch (error.code) {
        case "auth/invalid-email":
          errorMessage = "Неверный формат email";
          break;
        case "auth/user-not-found":
          errorMessage = "Пользователь не найден";
          break;
        case "auth/wrong-password":
          errorMessage = "Неверный пароль";
          break;
        case "auth/too-many-requests":
          errorMessage = "Слишком много попыток. Попробуйте позже";
          break;
        default:
          errorMessage = error.message || "Произошла неизвестная ошибка";
      }

      toast.error(errorMessage);
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
