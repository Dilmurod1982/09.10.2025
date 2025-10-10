import { Outlet } from "react-router-dom";
import { Navbar } from "../components";

function MainLayouts() {
  return (
    <>
      <Navbar />
      <main>
        <Outlet />
      </main>
    </>
  );
}

export default MainLayouts;
