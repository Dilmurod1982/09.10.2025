import { Outlet } from "react-router-dom";
import { Navbar } from "../components";
import SessionWarning from "../components/SessionWarning";

function MainLayouts() {
  return (
    <>
      <Navbar />
      <main>
        <Outlet />
        <SessionWarning />
      </main>
    </>
  );
}

export default MainLayouts;
