import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../lib/zustand";

const EmployeesDocDeadlineInf = () => {
  const [stations, setStations] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const userData = useAppStore((state) => state.userData);

  useEffect(() => {
    if (userData) {
      fetchStationsAndDocs();
    }
  }, [userData]);

  const fetchStationsAndDocs = async () => {
    try {
      // Получаем только станции, прикрепленные к пользователю
      let stationsQuery;
      if (userData.stations && userData.stations.length > 0) {
        stationsQuery = query(
          collection(db, "stations"),
          where("__name__", "in", userData.stations)
        );
      } else {
        // Если у пользователя нет прикрепленных станций, показываем пустой список
        setStations([]);
        setStats({});
        setLoading(false);
        return;
      }

      const stationsSnap = await getDocs(stationsQuery);

      // Получаем бессрочные документы (где expiryDate не установлен или очень далеко в будущем)
      const docsSnap = await getDocs(collection(db, "documents"));

      const stationsData = stationsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const counts = {};

      docsSnap.forEach((doc) => {
        const data = doc.data();
        const stationId = data.stationId;

        // Показываем документы только для станций пользователя
        if (userData.stations.includes(stationId)) {
          // Проверяем, является ли документ бессрочным
          // Бессрочные документы обычно имеют очень далекую дату expiryDate или не имеют ее
          const expiry = data.expiryDate ? new Date(data.expiryDate) : null;

          // Считаем документ бессрочным если:
          // 1. Нет expiryDate
          // 2. expiryDate очень далеко в будущем (например, больше 10 лет)
          // 3. Или используем другое поле для определения бессрочности
          const isPerpetual =
            !expiry ||
            (expiry && expiry > new Date("2100-01-01")) ||
            data.isPerpetual === true;

          if (isPerpetual) {
            if (!counts[stationId]) {
              counts[stationId] = {
                total: 0,
                perpetual: 0,
              };
            }

            counts[stationId].total++;
            counts[stationId].perpetual++;
          }
        }
      });

      setStats(counts);
      setStations(stationsData);
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-20 w-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600 text-lg">
          Фойдаланувчи рўйхатдан ўтмаган
        </div>
      </div>
    );
  }

  if (!userData.stations || userData.stations.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">
          Заправкалар бўйича муддатсиз хужжатлар
        </h1>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          Сизга бириктирилган заправкалар мавжуд. Админга мурожаат этинг
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">
        Заправкалар бўйича муддатсиз хужжатлар
      </h1>

      <div className="mb-4 text-gray-600">
        Фақат Сизга бириктирилган заправкалар хужжатлари кўрсатилмоқда
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {stations.map((station) => {
          const s = stats[station.id] || {};

          return (
            <Link
              key={station.id}
              to={`/stationdocsinf/${station.id}`}
              className="border rounded-lg p-4 hover:shadow-md transition bg-white">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-medium text-lg">{station.stationName}</h2>
                <div className="w-8 h-8 rounded-md bg-green-500 flex items-center justify-center text-white text-xs font-semibold">
                  {s.total || 0}
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <p className="text-green-600 font-semibold">
                  Муддатсиз хужжатлар: {s.perpetual || 0}
                </p>
                <p className="text-gray-500 text-xs">
                  Жами заправка бўйича хужжатлар
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {stations.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          Сизга бириктирилган заправкалар бўйича хужжатлар мавжуд эмас
        </div>
      )}
    </div>
  );
};

export default EmployeesDocDeadlineInf;
