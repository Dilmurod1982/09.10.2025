import { useState, useEffect } from "react";

export const useDeviceInfo = () => {
  const [deviceInfo, setDeviceInfo] = useState({
    computerName: "Unknown",
    macAddress: "Unknown",
    userAgent: "",
    platform: "",
    deviceId: "",
  });

  useEffect(() => {
    // Получаем информацию из браузера
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;

    // Генерируем уникальный ID для устройства (сохраняется в localStorage)
    let deviceId = localStorage.getItem("deviceId");
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("deviceId", deviceId);
    }

    // Имя компьютера (пользователь может ввести в настройках)
    let computerName = localStorage.getItem("computerName");
    if (!computerName) {
      computerName = prompt(
        "Введите имя вашего компьютера для отслеживания изменений:",
        "My Computer",
      );
      if (computerName) {
        localStorage.setItem("computerName", computerName);
      } else {
        computerName = "Unknown";
      }
    }

    setDeviceInfo({
      computerName,
      macAddress: deviceId, // Используем deviceId вместо MAC адреса
      userAgent,
      platform,
      deviceId,
    });
  }, []);

  return deviceInfo;
};
