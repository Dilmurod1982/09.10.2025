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
  JobTitle,
  HomeElectronics,
  MeterReadings,
  HomeControlBooker,
  PaymentMethods,
  Seal,
  UserAllDocuments,
  PriceOfGasPage,
  HomeHududgazMetrolog,
  DocumentPage, // Импортируем DocumentPage
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
import { Toaster } from "react-hot-toast";
import GasSettlementsDataList from "./components/GasSettlements/GasSettlementsDataList";

function App() {
  const setUser = useAppStore((state) => state.setUser);
  const user = useAppStore((state) => state.user);
  const userData = useAppStore((state) => state.userData);
  const loadUserData = useAppStore((state) => state.loadUserData);
  const checkExistingSession = useAppStore(
    (state) => state.checkExistingSession,
  );

  useEffect(() => {
    checkExistingSession();
  }, [checkExistingSession]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        const storedUserData = JSON.parse(localStorage.getItem("userData"));
        if (!storedUserData || storedUserData.email !== firebaseUser.email) {
          await loadUserData(firebaseUser);
        }
      } else {
        setUser(null);
        localStorage.removeItem("sessionStartTime");
        localStorage.removeItem("lastActivityTime");
        localStorage.removeItem("userData");
      }
    });

    return () => unsubscribe();
  }, [setUser, loadUserData]);

  const hasAccess = (role, allowedRoles) => allowedRoles.includes(role);

  const ProtectedLayout = ({ allowedRoles, element }) => {
    if (!user) return <Navigate to="/login" replace />;
    const userData = useAppStore((state) => state.userData);
    const role = userData?.role || "guest";

    if (!hasAccess(role, allowedRoles)) {
      if (role === "rahbar") return <Navigate to="/homechief" replace />;
      if (role === "nazoratbux")
        return <Navigate to="/homecontrolbooker" replace />;
      if (role === "buxgalter") return <Navigate to="/homebooker" replace />;
      if (role === "operator") return <Navigate to="/homeoperator" replace />;
      if (role === "tasischi") return <Navigate to="/hometasischi" replace />;
      if (role === "electrengineer")
        return <Navigate to="/homeelectronics" replace />;
      if (role === "metrolog-hududgaz")
        return <Navigate to="/homehududgazmetrolog" replace />;
      return <Navigate to="/" replace />;
    }
    return element;
  };

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
        {
          index: true,
          element: (
            <ProtectedLayout allowedRoles={["admin"]} element={<Home />} />
          ),
        },
        {
          path: "/stations",
          element: (
            <ProtectedLayout allowedRoles={["admin"]} element={<Stations />} />
          ),
        },
        {
          path: "/jobtitle",
          element: (
            <ProtectedLayout allowedRoles={["admin"]} element={<JobTitle />} />
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
              allowedRoles={["admin", "nazoratbux"]}
              element={<Compressors />}
            />
          ),
        },
        {
          path: "/dispensers",
          element: (
            <ProtectedLayout
              allowedRoles={["admin", "nazoratbux"]}
              element={<Dispensers />}
            />
          ),
        },
        {
          path: "/osushka",
          element: (
            <ProtectedLayout
              allowedRoles={["admin", "nazoratbux"]}
              element={<Osushka />}
            />
          ),
        },
        {
          path: "/chillers",
          element: (
            <ProtectedLayout
              allowedRoles={["admin", "nazoratbux"]}
              element={<Chillers />}
            />
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
              allowedRoles={["admin", "metrolog-hududgaz"]}
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
          path: "/homecontrolbooker",
          element: (
            <ProtectedLayout
              allowedRoles={["nazoratbux"]}
              element={<HomeControlBooker />}
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
          path: "/paymentmethods",
          element: (
            <ProtectedLayout
              allowedRoles={["admin"]}
              element={<PaymentMethods />}
            />
          ),
        },
        {
          path: "/seal",
          element: (
            <ProtectedLayout
              allowedRoles={["electrengineer", "admin", "nazoratbux"]}
              element={<Seal />}
            />
          ),
        },
        {
          path: "/docbystation",
          element: (
            <ProtectedLayout
              allowedRoles={["admin", "metrolog-hududgaz"]}
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
        // 🔹 ВАЖНО: Добавляем доступ для metrolog-hududgaz к странице документов
        {
          path: "/documents/:id",
          element: (
            <ProtectedLayout
              allowedRoles={["admin", "metrolog-hududgaz"]}
              element={<DocumentPage />}
            />
          ),
        },
        {
          path: "/stationdocs/:id",
          element: (
            <ProtectedLayout
              allowedRoles={[
                "admin",
                "rahbar",
                "buxgalter",
                "nazoratbux",
                "metrolog-hududgaz",
              ]}
              element={<StationDocs />}
            />
          ),
        },
        {
          path: "/stationdocsinf/:id",
          element: (
            <ProtectedLayout
              allowedRoles={["admin", "rahbar", "buxgalter", "nazoratbux"]}
              element={<StationDocsInf />}
            />
          ),
        },
        {
          path: "/user-all-docs/:userId",
          element: (
            <ProtectedLayout
              allowedRoles={["admin", "rahbar", "buxgalter", "nazoratbux"]}
              element={<UserAllDocuments />}
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
          path: "/documentsinf/:id",
          element: (
            <ProtectedLayout
              allowedRoles={["admin"]}
              element={<DocumentPageInf />}
            />
          ),
        },
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
              allowedRoles={["buxgalter", "nazoratbux"]}
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
          path: "/homeelectronics",
          element: (
            <ProtectedLayout
              allowedRoles={["electrengineer"]}
              element={<HomeElectronics />}
            />
          ),
        },
        {
          path: "/meterreadings",
          element: (
            <ProtectedLayout
              allowedRoles={["electrengineer", "admin", "nazoratbux"]}
              element={<MeterReadings />}
            />
          ),
        },
        {
          path: "/reportondebtspartners",
          element: (
            <ProtectedLayout
              allowedRoles={[
                "buxgalter",
                "operator",
                "admin",
                "rahbar",
                "nazoratbux",
              ]}
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
          path: "/elektrsettlements",
          element: <ElektrSettlements />,
        },
        {
          path: "/gassettlements",
          element: <GasSettlements />,
        },
        {
          path: "/gas-settlements/list",
          element: <GasSettlementsDataList />,
        },
        {
          path: "/price-of-gas",
          element: <PriceOfGasPage />,
        },
        {
          path: "/homehududgazmetrolog",
          element: (
            <ProtectedLayout
              allowedRoles={["metrolog-hududgaz"]}
              element={<HomeHududgazMetrolog />}
            />
          ),
        },
      ],
    },
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
        ) : user.role === "metrolog-hududgaz" ? (
          <Navigate to="/homehududgazmetrolog" replace />
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
