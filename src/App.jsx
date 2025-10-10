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
} from "./pages";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import MainLayouts from "./layouts/MainLayouts";
import ProtectedRoutes from "./components/ProtectedRoutes";
import { useAppStore } from "./lib/zustand";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase/config";

function App() {
  const setUser = useAppStore((state) => state.setUser);
  const user = useAppStore((state) => state.user);
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
          element: <Home />,
        },
        {
          path: "/stations",
          element: <Stations />,
        },
        {
          path: "/users",
          element: <Users />,
        },
        {
          path: "/ltds",
          element: <Ltds />,
        },
        {
          path: "/banks",
          element: <Banks />,
        },
        {
          path: "/compressors",
          element: <Compressors />,
        },
        {
          path: "/dispensers",
          element: <Dispensers />,
        },
        {
          path: "/osushka",
          element: <Osushka />,
        },
        {
          path: "/chillers",
          element: <Chillers />,
        },
        {
          path: "/typeofcompressors",
          element: <TypeOfCompressors />,
        },
        {
          path: "/typeofdispensers",
          element: <TypeOfDispensers />,
        },
        {
          path: "/typeofosushka",
          element: <TypeOfOsushka />,
        },
        {
          path: "/typeofchillers",
          element: <TypeOfChillers />,
        },
        {
          path: "/equipment-types",
          element: <EquipmentTypes />,
        },
        {
          path: "/regions",
          element: <Regions />,
        },
        {
          path: "/cities",
          element: <Cities />,
        },
        {
          path: "/employees",
          element: <Employees />,
        },
      ],
    },
    {
      path: "/login",
      errorElement: <ErrorPage />,
      element: user ? <Navigate to="/" /> : <Login />,
    },
  ]);

  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
  }, []);
  return <RouterProvider router={routes} />;
}

export default App;
