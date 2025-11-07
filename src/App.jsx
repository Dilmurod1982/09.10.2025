import React, { useEffect } from "react";
import {
  Home,
  Login,
  ErrorPage,
  Stations,
  Users,
  Ltds,
  Banks,
  Compressors,
  Dispensers,
  Osushka,
  Chillers,
  TypeOfCompressors,
  TypeOfDispensers,
  TypeOfOsushka,
  TypeOfChillers,
  EquipmentTypes,
  Regions,
  Cities,
  Employees,
  DocDeadline,
  DocPerpetual,
  DocByStation,
  DocDeadlineInf,
  DocByStationInf,
  StationDocs,
  DocumentTypePage,
  DocumentPageInf,
  StationDocsInf,
  Partners,
  PartnersList,
  HomeBooker,
  HomeOperator,
  GeneralDailyReport,
  DailyHoseReport,
  DailyReportPartners,
  EmployeesDocDeadline,
  EmployeesDocDeadlineInf,
  ControlPayments,
  Payments,
  ReportOnDebtsPartners,
  HomeChief,
  GasSettlements,
  ElektrSettlements,
  HomeTasischi,
} from "./pages";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import MainLayouts from "./layouts/MainLayouts";
import ProtectedRoutes from "./components/ProtectedRoutes";
import { useAppStore } from "./lib/zustand";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase/config";
import SessionWarning from "./components/SessionWarning";
import DocumentPage from "./pages/DocumentPage";
import { Toaster } from "react-hot-toast";

function App() {
  const setUser = useAppStore((state) => state.setUser);
  const user = useAppStore((state) => state.user);
  const userData = useAppStore((state) => state.userData);
  const loadUserData = useAppStore((state) => state.loadUserData);
  const checkExistingSession = useAppStore(
    (state) => state.checkExistingSession
  );

  // Проверяем сессию при загрузке приложения
  useEffect(() => {
    checkExistingSession();
  }, [checkExistingSession]);

  // Отслеживаем авторизацию Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // 🔹 Загружаем данные пользователя из Firestore при обновлении страницы
        const storedUserData = JSON.parse(localStorage.getItem("userData"));
        if (!storedUserData || storedUserData.email !== firebaseUser.email) {
          await loadUserData(firebaseUser);
        }
      } else {
        setUser(null);
        localStorage.removeItem("sessionStartTime");
        localStorage.removeItem("lastActivityTime");
        localStorage.removeItem("userData"); // Очищаем userData
      }
    });

    return () => unsubscribe();
  }, [setUser, loadUserData]);

  // 🔹 Функция проверки доступа по роли
  const hasAccess = (role, allowedRoles) => allowedRoles.includes(role);

  // 🔹 Основной layout для ролей
  const ProtectedLayout = ({ allowedRoles, element }) => {
    if (!user) return <Navigate to="/login" replace />;
    const userData = useAppStore((state) => state.userData);
    const role = userData?.role || "guest";

    if (!hasAccess(role, allowedRoles)) {
      // Перенаправляем в зависимости от роли
      if (role === "rahbar") return <Navigate to="/homechief" replace />;
      if (role === "buxgalter") return <Navigate to="/homebooker" replace />;
      if (role === "operator") return <Navigate to="/homeoperator" replace />;
      if (role === "tasischi") return <Navigate to="/hometasischi" replace />;
      return <Navigate to="/" replace />;
    }
    return element;
  };

  // ✅ Маршруты
  const routes = createBrowserRouter([
    {
      path: "/",
      errorElement: <ErrorPage />,
      element: (
        <ProtectedRoutes user={user}>
          <MainLayouts />
        </ProtectedRoutes>
      ),
      children: [
        // ==== 🔹 Главная страница для ADMIN ====
        {
          index: true,
          element: (
            <ProtectedLayout allowedRoles={["admin"]} element={<Home />} />
          ),
        },

        // ==== 🔹 Доступ только для ADMIN ====
        {
          path: "/stations",
          element: (
            <ProtectedLayout allowedRoles={["admin"]} element={<Stations />} />
          ),
        },
        {
          path: "/users",
          element: (
            <ProtectedLayout allowedRoles={["admin"]} element={<Users />} />
          ),
        },
        {
          path: "/ltds",
          element: (
            <ProtectedLayout allowedRoles={["admin"]} element={<Ltds />} />
          ),
        },
        {
          path: "/banks",
          element: (
            <ProtectedLayout allowedRoles={["admin"]} element={<Banks />} />
          ),
        },
        {
          path: "/compressors",
          element: (
            <ProtectedLayout
              allowedRoles={["admin"]}
              element={<Compressors />}
            />
          ),
        },
        {
          path: "/dispensers",
          element: (
            <ProtectedLayout
              allowedRoles={["admin"]}
              element={<Dispensers />}
            />
          ),
        },
        {
          path: "/osushka",
          element: (
            <ProtectedLayout allowedRoles={["admin"]} element={<Osushka />} />
          ),
        },
        {
          path: "/chillers",
          element: (
            <ProtectedLayout allowedRoles={["admin"]} element={<Chillers />} />
          ),
        },
        {
          path: "/typeofcompressors",
          element: (
            <ProtectedLayout
              allowedRoles={["admin"]}
              element={<TypeOfCompressors />}
            />
          ),
        },
        {
          path: "/typeofdispensers",
          element: (
            <ProtectedLayout
              allowedRoles={["admin"]}
              element={<TypeOfDispensers />}
            />
          ),
        },
        {
          path: "/typeofosushka",
          element: (
            <ProtectedLayout
              allowedRoles={["admin"]}
              element={<TypeOfOsushka />}
            />
          ),
        },
        {
          path: "/typeofchillers",
          element: (
            <ProtectedLayout
              allowedRoles={["admin"]}
              element={<TypeOfChillers />}
            />
          ),
        },
        {
          path: "/equipment-types",
          element: (
            <ProtectedLayout
              allowedRoles={["admin"]}
              element={<EquipmentTypes />}
            />
          ),
        },
        {
          path: "/regions",
          element: (
            <ProtectedLayout allowedRoles={["admin"]} element={<Regions />} />
          ),
        },
        {
          path: "/cities",
          element: (
            <ProtectedLayout allowedRoles={["admin"]} element={<Cities />} />
          ),
        },
        {
          path: "/employees",
          element: (
            <ProtectedLayout allowedRoles={["admin"]} element={<Employees />} />
          ),
        },
        {
          path: "/docdeadline",
          element: (
            <ProtectedLayout
              allowedRoles={["admin"]}
              element={<DocDeadline />}
            />
          ),
        },
        {
          path: "/docperpetual",
          element: (
            <ProtectedLayout
              allowedRoles={["admin"]}
              element={<DocPerpetual />}
            />
          ),
        },
        {
          path: "/partners",
          element: (
            <ProtectedLayout
              allowedRoles={["admin", "buxgalter"]}
              element={<Partners />}
            />
          ),
        },
        {
          path: "/partnerslist",
          element: (
            <ProtectedLayout
              allowedRoles={["admin", "buxgalter"]}
              element={<PartnersList />}
            />
          ),
        },
        {
          path: "/docbystation",
          element: (
            <ProtectedLayout
              allowedRoles={["admin"]}
              element={<DocByStation />}
            />
          ),
        },
        {
          path: "/docbystationinf",
          element: (
            <ProtectedLayout
              allowedRoles={["admin"]}
              element={<DocByStationInf />}
            />
          ),
        },
        {
          path: "/docdeadlineinf",
          element: (
            <ProtectedLayout
              allowedRoles={["admin"]}
              element={<DocDeadlineInf />}
            />
          ),
        },
        {
          path: "/stationdocs/:id",
          element: (
            <ProtectedLayout
              allowedRoles={["admin", "rahbar", "buxgalter"]}
              element={<StationDocs />}
            />
          ),
        },
        {
          path: "/stationdocsinf/:id",
          element: (
            <ProtectedLayout
              allowedRoles={["admin", "rahbar", "buxgalter"]}
              element={<StationDocsInf />}
            />
          ),
        },
        {
          path: "/doctypepage",
          element: (
            <ProtectedLayout
              allowedRoles={["admin"]}
              element={<DocumentTypePage />}
            />
          ),
        },
        {
          path: "/documents/:id",
          element: (
            <ProtectedLayout
              allowedRoles={["admin"]}
              element={<DocumentPage />}
            />
          ),
        },
        {
          path: "/documentsinf/:id",
          element: (
            <ProtectedLayout
              allowedRoles={["admin"]}
              element={<DocumentPageInf />}
            />
          ),
        },

        // ==== 🔹 Домашние страницы для BUCHGALTER и OPERATOR ====
        {
          path: "/homechief",
          element: (
            <ProtectedLayout
              allowedRoles={["rahbar"]}
              element={<HomeChief />}
            />
          ),
        },
        {
          path: "/homebooker",
          element: (
            <ProtectedLayout
              allowedRoles={["buxgalter"]}
              element={<HomeBooker />}
            />
          ),
        },
        {
          path: "/homeoperator",
          element: (
            <ProtectedLayout
              allowedRoles={["operator"]}
              element={<HomeOperator />}
            />
          ),
        },
        {
          path: "/hometasischi",
          element: (
            <ProtectedLayout
              allowedRoles={["tasischi"]}
              element={<HomeTasischi />}
            />
          ),
        },
        {
          path: "/controlpayments",
          element: (
            <ProtectedLayout
              allowedRoles={["buxgalter"]}
              element={<ControlPayments />}
            />
          ),
        },
        {
          path: "/payments",
          element: (
            <ProtectedLayout
              allowedRoles={["buxgalter", "admin"]}
              element={<Payments />}
            />
          ),
        },
        {
          path: "/reportondebtspartners",
          element: (
            <ProtectedLayout
              allowedRoles={["buxgalter", "operator", "admin", "rahbar"]}
              element={<ReportOnDebtsPartners />}
            />
          ),
        },
        {
          path: "/generaldailyreport",
          element: <GeneralDailyReport />,
        },
        {
          path: "/dailyhosereport",
          element: <DailyHoseReport />,
        },
        {
          path: "/dailyreportpartners",
          element: <DailyReportPartners />,
        },
        {
          path: "/employeesdocdeadline",
          element: <EmployeesDocDeadline />,
        },
        {
          path: "/employeesdocdeadlineinf",
          element: <EmployeesDocDeadlineInf />,
        },
        {
          path: "/gassettlements",
          element: <GasSettlements />,
        },
        {
          path: "/elektrsettlements",
          element: <ElektrSettlements />,
        },
      ],
    },

    // ==== 🔹 LOGIN ====
    {
      path: "/login",
      errorElement: <ErrorPage />,
      element: user ? (
        user.role === "admin" ? (
          <Navigate to="/" replace />
        ) : user.role === "buxgalter" ? (
          <Navigate to="/homebooker" replace />
        ) : user.role === "operator" ? (
          <Navigate to="/homeoperator" replace />
        ) : (
          <Navigate to="/" replace />
        )
      ) : (
        <Login />
      ),
    },
  ]);

  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <RouterProvider router={routes} />
      {user && <SessionWarning />}
    </>
  );
}

export default App;
