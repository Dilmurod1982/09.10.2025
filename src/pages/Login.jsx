// components/Login.js
import React, { useEffect, useState, useRef } from "react";
import { UpdateIcon } from "@radix-ui/react-icons";
import { useAppStore } from "../lib/zustand";
import Button from "@mui/material/Button";
import { useLogin } from "../hooks/useLogin";

function Login() {
  const setUser = useAppStore((state) => state.setUser);
  const setUserData = useAppStore((state) => state.setUserData);
  const user = useAppStore((state) => state.user);
  const userData = useAppStore((state) => state.userData);
  const { isPending, signIn } = useLogin();

  const [isFocused, setIsFocused] = useState({ email: false, password: false });
  const [isHovered, setIsHovered] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const formRef = useRef(null);

  // Убрать этот useEffect если он не нужен
  // useEffect(() => {
  //   if (userData && user?.email && user?.password) {
  //     signIn(user.email, user.password);
  //   }
  // }, [userData, user, signIn]);

  const handleFocus = (field) => () => {
    setIsFocused((prev) => ({ ...prev, [field]: true }));
  };

  const handleBlur = (field) => () => {
    setIsFocused((prev) => ({ ...prev, [field]: false }));
  };

  const handleMouseMove = (e) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get("username");
    const password = formData.get("password");

    // Анимация нажатия
    if (formRef.current) {
      formRef.current.classList.add("scale-95");
      setTimeout(() => {
        if (formRef.current) {
          formRef.current.classList.remove("scale-95");
        }
      }, 150);
    }

    const result = await signIn(email, password);

    if (result.success) {
      // Сессия автоматически запустится через хук useSessionTimeout
      // Редирект произойдет автоматически через Router
    }
  };

  return (
    <div
      className="min-h-screen w-full relative overflow-hidden bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600"
      onMouseMove={handleMouseMove}>
      {/* Анимированный фон с градиентом */}
      <div
        className="absolute inset-0 opacity-30 transition-transform duration-100 ease-out"
        style={{
          background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.3) 0%, transparent 50%)`,
        }}
      />

      {/* Плавающие формы */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-20 h-20 bg-white/10 rounded-full animate-float"></div>
        <div className="absolute top-1/3 right-1/4 w-16 h-16 bg-white/5 rounded-full animate-float animation-delay-1000"></div>
        <div className="absolute bottom-1/4 left-1/3 w-24 h-24 bg-white/15 rounded-full animate-float animation-delay-2000"></div>
        <div className="absolute top-1/2 right-1/3 w-12 h-12 bg-white/8 rounded-full animate-float animation-delay-1500"></div>
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 min-h-screen">
        {/* Левая часть - Hero Section */}
        <div className="hidden lg:flex items-center justify-center p-8">
          <div className="relative w-full max-w-md">
            <div className="absolute -inset-4 bg-gradient-to-r from-purple-400 to-pink-400 rounded-2xl blur-lg opacity-75 animate-pulse"></div>
            <div className="relative bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 shadow-2xl">
              <div className="text-center text-white">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <span className="text-2xl">🚀</span>
                </div>
                <h2 className="text-3xl font-bold mb-4">Xush kelibsiz</h2>
                <p className="text-white/80 text-lg">
                  Hisobingizga kirish uchun ma'lumotlaringizni kiriting
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Правая часть - Форма */}
        <div className="flex items-center justify-center p-4 lg:p-8">
          <div className="w-full max-w-md">
            <div
              ref={formRef}
              className="relative transition-all duration-300 ease-out">
              {/* Свечение вокруг формы */}
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>

              <div className="relative bg-white/95 backdrop-blur-lg rounded-xl p-8 lg:p-10 border border-white/20 shadow-2xl">
                {/* Заголовок */}
                <div className="text-center mb-8">
                  <div className="flex items-center justify-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse"></div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      METAN
                    </h1>
                  </div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-2">
                    Hisobga kirish
                  </h2>
                  <p className="text-gray-600">
                    Davom etish uchun hisobingizga kiring
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Поле Email */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        name="username"
                        placeholder=" "
                        className={`w-full px-4 py-3 bg-white border-2 rounded-xl transition-all duration-300 focus:outline-none focus:ring-4 ${
                          isFocused.email
                            ? "border-purple-500 ring-purple-200 shadow-lg"
                            : "border-gray-300 focus:border-purple-500"
                        }`}
                        onFocus={handleFocus("email")}
                        onBlur={handleBlur("email")}
                        required
                      />
                      <span
                        className={`absolute left-4 transition-all duration-300 pointer-events-none ${
                          isFocused.email
                            ? "top-0 -translate-y-1/2 bg-white px-2 text-xs text-purple-600"
                            : "top-1/2 -translate-y-1/2 text-gray-400"
                        }`}>
                        Emailingizni kiriting
                      </span>
                    </div>
                  </div>

                  {/* Поле Password */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Parol
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        name="password"
                        placeholder=" "
                        className={`w-full px-4 py-3 bg-white border-2 rounded-xl transition-all duration-300 focus:outline-none focus:ring-4 ${
                          isFocused.password
                            ? "border-purple-500 ring-purple-200 shadow-lg"
                            : "border-gray-300 focus:border-purple-500"
                        }`}
                        onFocus={handleFocus("password")}
                        onBlur={handleBlur("password")}
                        required
                      />
                      <span
                        className={`absolute left-4 transition-all duration-300 pointer-events-none ${
                          isFocused.password
                            ? "top-0 -translate-y-1/2 bg-white px-2 text-xs text-purple-600"
                            : "top-1/2 -translate-y-1/2 text-gray-400"
                        }`}>
                        Parolingizni kiriting
                      </span>
                    </div>
                  </div>

                  {/* Кнопка входа */}
                  <Button
                    variant="contained"
                    type="submit"
                    disabled={isPending}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    className={`w-full py-3 rounded-xl font-semibold text-white transition-all duration-500 transform ${
                      isPending
                        ? "bg-gray-400"
                        : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    } ${
                      isHovered && !isPending
                        ? "scale-105 shadow-2xl"
                        : "scale-100 shadow-lg"
                    } relative overflow-hidden`}
                    sx={{
                      textTransform: "none",
                      fontSize: "16px",
                      background: isPending
                        ? "#9CA3AF"
                        : "linear-gradient(45deg, #8B5CF6, #EC4899)",
                      "&:hover": {
                        background: isPending
                          ? "#9CA3AF"
                          : "linear-gradient(45deg, #7C3AED, #DB2777)",
                      },
                    }}>
                    {isPending ? (
                      <div className="flex items-center justify-center space-x-2">
                        <UpdateIcon className="animate-spin w-5 h-5" />
                        <span>Kirilmoqda...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <span>Kirish</span>
                        <div
                          className={`transition-transform duration-300 ${
                            isHovered ? "translate-x-1" : "translate-x-0"
                          }`}>
                          →
                        </div>
                      </div>
                    )}

                    {/* Эффект блеска */}
                    <div
                      className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 transform translate-x-[-100%] ${
                        isHovered && !isPending ? "animate-shine" : ""
                      }`}></div>
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
