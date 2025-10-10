import React, { useEffect, useState } from "react";
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

  useEffect(() => {
    if (userData && user?.email && user?.password) {
      signIn(user.email, user.password);
    }
  }, [userData, user, signIn]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get("username");
    const password = formData.get("password");

    await signIn(email, password);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen w-full">
      <div className="hidden lg:block bg-[url('https://picsum.photos/1000/1300')] bg-cover bg-no-repeat bg-center"></div>
      <div className="bg-[url('https://picsum.photos/1000/1300')] bg-cover bg-no-repeat bg-center lg:bg-none grid place-items-center">
        <div className="grid gap-3 w-full place-items-center">
          <form onSubmit={handleSubmit} className="grid place-items-center">
            <label className="form-control w-full place-items-center">
              <div className="label w-full">
                <span className="label-text">Email</span>
              </div>
              <input
                type="email"
                name="username"
                placeholder="Emailingizni kiriting"
                className="input input-bordered w-full max-w-xs"
                required
              />
            </label>
            <label className="form-control w-full mb-5">
              <div className="label w-full">
                <span className="label-text">Parol</span>
              </div>
              <input
                type="password"
                name="password"
                placeholder="Parolingizni kiriting"
                className="input input-bordered w-full max-w-xs"
                required
              />
            </label>

            <Button variant="contained" type="submit" disabled={isPending}>
              {isPending ? <UpdateIcon className="animate-spin" /> : "Kirish"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
