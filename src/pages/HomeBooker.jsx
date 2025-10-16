import React from "react";
import { useAppStore } from "../lib/zustand";

function HomeBooker() {
  const userData = useAppStore((state) => state.userData);
  return <div></div>;
}

export default HomeBooker;
