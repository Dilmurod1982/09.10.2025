import React, { useEffect, useState, useRef } from "react";
import { UpdateIcon, EyeOpenIcon, EyeClosedIcon } from "@radix-ui/react-icons";
import { useAppStore } from "../lib/zustand";
import Button from "@mui/material/Button";
import { useLogin } from "../hooks/useLogin";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";

function Login() {
  const { isPending, signIn } = useLogin();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [isHovered, setIsHovered] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showPassword, setShowPassword] = useState(false);
  const formRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const handleInputChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleMouseMove = (e) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Проверяем автозаполнение после загрузки
  useEffect(() => {
    const checkAutofill = () => {
      setTimeout(() => {
        if (emailRef.current) {
          const emailValue = emailRef.current.value;
          if (emailValue) {
            setFormData((prev) => ({ ...prev, email: emailValue }));
          }
        }
        if (passwordRef.current) {
          const passwordValue = passwordRef.current.value;
          if (passwordValue) {
            setFormData((prev) => ({ ...prev, password: passwordValue }));
          }
        }
      }, 100);
    };

    checkAutofill();
    window.addEventListener("load", checkAutofill);

    return () => {
      window.removeEventListener("load", checkAutofill);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = formData.email.trim();
    const password = formData.password;

    // Валидация полей
    if (!email || !password) {
      toast.error("Илтимос, барча қаторларни тўлдиринг");
      return;
    }

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
      // Показываем тост при успешном входе
      toast.success(result.message);
    } else {
      // Показываем ошибку
      toast.error(result.error);
    }
  };

  return (
    <div
      className="min-h-screen w-full relative overflow-hidden bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600"
      onMouseMove={handleMouseMove}>
      {/* Toast контейнер */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        style={{ zIndex: 9999 }}
      />

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
                <h2 className="text-3xl font-bold mb-4">Хуш келибсиз!</h2>
                <p className="text-white/80 text-lg">
                  Тизимга кириш учун маълумотларингизни киритинг
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
                      МЕТАН
                    </h1>
                  </div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-2">
                    Тизимга кириш
                  </h2>
                  <p className="text-gray-600">
                    Давом этиш учун қаторларни тўлдиринг
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Поле Email */}
                  <div className="relative">
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <input
                        ref={emailRef}
                        id="email"
                        type="email"
                        name="username"
                        value={formData.email}
                        onChange={handleInputChange("email")}
                        className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-xl transition-all duration-300 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-200 shadow-sm"
                        placeholder="email@example.com"
                        autoComplete="username email"
                        required
                      />
                    </div>
                  </div>

                  {/* Поле Password с иконкой глаза */}
                  <div className="relative">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-gray-700 mb-2">
                      Парол
                    </label>
                    <div className="relative">
                      <input
                        ref={passwordRef}
                        id="password"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange("password")}
                        className="w-full px-4 py-3 pr-12 bg-white border-2 border-gray-300 rounded-xl transition-all duration-300 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-200 shadow-sm"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors duration-200 focus:outline-none"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }>
                        {showPassword ? (
                          <EyeClosedIcon className="w-5 h-5" />
                        ) : (
                          <EyeOpenIcon className="w-5 h-5" />
                        )}
                      </button>
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
                        <span>Кирилмоқда...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <span>Кириш</span>
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

      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(180deg);
          }
        }
        @keyframes shine {
          0% {
            transform: translateX(-100%) skewX(-12deg);
          }
          100% {
            transform: translateX(200%) skewX(-12deg);
          }
        }
        @keyframes tilt {
          0%,
          100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(0.5deg);
          }
          75% {
            transform: rotate(-0.5deg);
          }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-1500 {
          animation-delay: 1.5s;
        }
        .animate-shine {
          animation: shine 1.5s ease-in-out;
        }
        .animate-tilt {
          animation: tilt 10s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default Login;
