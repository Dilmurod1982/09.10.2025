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

// ✅ Новый универсальный компонент
import DocumentPage from "./pages/DocumentPage";

function App() {
  const setUser = useAppStore((state) => state.setUser);
  const user = useAppStore((state) => state.user);
  const checkExistingSession = useAppStore(
    (state) => state.checkExistingSession
  );

  // Проверяем сессию при загрузке приложения
  useEffect(() => {
    checkExistingSession();
  }, [checkExistingSession]);

  // Отслеживаем авторизацию Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        setUser(null);
        // Очищаем localStorage при выходе
        localStorage.removeItem("sessionStartTime");
        localStorage.removeItem("lastActivityTime");
      }
    });

    return () => unsubscribe();
  }, [setUser]);

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
        { index: true, element: <Home /> },
        { path: "/stations", element: <Stations /> },
        { path: "/users", element: <Users /> },
        { path: "/ltds", element: <Ltds /> },
        { path: "/banks", element: <Banks /> },
        { path: "/compressors", element: <Compressors /> },
        { path: "/dispensers", element: <Dispensers /> },
        { path: "/osushka", element: <Osushka /> },
        { path: "/chillers", element: <Chillers /> },
        { path: "/typeofcompressors", element: <TypeOfCompressors /> },
        { path: "/typeofdispensers", element: <TypeOfDispensers /> },
        { path: "/typeofosushka", element: <TypeOfOsushka /> },
        { path: "/typeofchillers", element: <TypeOfChillers /> },
        { path: "/equipment-types", element: <EquipmentTypes /> },
        { path: "/regions", element: <Regions /> },
        { path: "/cities", element: <Cities /> },
        { path: "/employees", element: <Employees /> },
        { path: "/docdeadline", element: <DocDeadline /> },
        { path: "/docperpetual", element: <DocPerpetual /> },

        // ✅ Универсальный маршрут для всех типов документов
        {
          path: "/documents/:id",
          element: <DocumentPage />,
        },

        { path: "/docbystation", element: <DocByStation /> },
        { path: "/docbystationinf", element: <DocByStationInf /> },
        { path: "/docdeadlineinf", element: <DocDeadlineInf /> },
        { path: "/stationdocs/:id", element: <StationDocs /> },
        { path: "/doctypepage", element: <DocumentTypePage /> },
      ],
    },
    {
      path: "/login",
      errorElement: <ErrorPage />,
      element: user ? <Navigate to="/" replace /> : <Login />,
    },
  ]);

  return (
    <>
      <RouterProvider router={routes} />
      {user && <SessionWarning />}
    </>
  );
}

export default App;
