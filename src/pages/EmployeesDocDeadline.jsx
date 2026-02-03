import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../lib/zustand";

const EmployeesDocDeadline = () => {
  const [stations, setStations] = useState([]);
  const [stats, setStats] = useState({});
  const [totalStats, setTotalStats] = useState({
    total: 0,
    expired: 0,
    less30: 0,
    less15: 0,
    less5: 0,
  });
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
          where("__name__", "in", userData.stations),
        );
      } else {
        // Если у пользователя нет прикрепленных станций, показываем пустой список
        setStations([]);
        setStats({});
        setTotalStats({
          total: 0,
          expired: 0,
          less30: 0,
          less15: 0,
          less5: 0,
        });
        setLoading(false);
        return;
      }

      const stationsSnap = await getDocs(stationsQuery);
      const docsSnap = await getDocs(collection(db, "documents"));

      const stationsData = stationsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const counts = {};
      const total = {
        total: 0,
        expired: 0,
        less30: 0,
        less15: 0,
        less5: 0,
      };

      docsSnap.forEach((doc) => {
        const data = doc.data();
        const stationId = data.stationId;

        // Показываем документы только для станций пользователя
        if (userData.stations.includes(stationId)) {
          const expiry = new Date(data.expiryDate);
          const now = new Date();
          const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

          if (!counts[stationId]) {
            counts[stationId] = {
              total: 0,
              expired: 0,
              less30: 0,
              less15: 0,
              less5: 0,
            };
          }

          counts[stationId].total++;
          total.total++;

          if (diffDays < 0) {
            counts[stationId].expired++;
            total.expired++;
          } else if (diffDays <= 5) {
            counts[stationId].less5++;
            total.less5++;
          } else if (diffDays <= 15) {
            counts[stationId].less15++;
            total.less15++;
          } else if (diffDays <= 30) {
            counts[stationId].less30++;
            total.less30++;
          }
        }
      });

      setStats(counts);
      setStations(stationsData);
      setTotalStats(total);
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
          Заправкалар бўйича хужжатлар
        </h1>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          Сизга бириктирилган заправка мавжуд эмас. Админга мурожаат этинг
        </div>
      </div>
    );
  }

  const showTotalCard = stations.length > 1;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">
        Заправкалар бўйича хужжатлар
      </h1>
      <a href="https://amzn.to/4kcc0fm">Перейти по ссылке</a>

      <div className="mb-4 text-gray-600">
        Фақат Сизга бириктирилган заправкалар хужжатлари кўрсатилмоқда
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Карточка "Жами" - показываем только если больше 1 станции */}
        {showTotalCard && (
          <Link
            to={`/user-all-docs/${userData.uid}`}
            className="border rounded-lg p-4 hover:shadow-md transition bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-lg text-blue-700">Жами</h2>
              <div
                className={`w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-semibold ${
                  totalStats.expired > 0
                    ? "bg-red-500"
                    : totalStats.less5 > 0
                      ? "bg-orange-500"
                      : totalStats.less15 > 0
                        ? "bg-yellow-500"
                        : "bg-green-500"
                }`}
              >
                {totalStats.total || 0}
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-green-600">
                30 кундан кам: {totalStats.less30 || 0}
              </p>
              <p className="text-yellow-500">
                15 кундан кам: {totalStats.less15 || 0}
              </p>
              <p className="text-orange-500">
                5 кундан кам: {totalStats.less5 || 0}
              </p>
              <p className="text-red-600 font-semibold">
                Муддати ўтган: {totalStats.expired || 0}
              </p>
            </div>
            {/* <div className="mt-3 text-xs text-blue-600 font-medium">
              Барча бириктирилган заправкалар хужжатлари →
            </div> */}
          </Link>
        )}

        {/* Карточки для каждой станции */}
        {stations.map((station) => {
          const s = stats[station.id] || {};

          return (
            <Link
              key={station.id}
              to={`/stationdocs/${station.id}`}
              className="border rounded-lg p-4 hover:shadow-md transition bg-white"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-medium text-lg">{station.stationName}</h2>
                <div
                  className={`w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-semibold ${
                    (s.expired || 0) > 0
                      ? "bg-red-500"
                      : (s.less5 || 0) > 0
                        ? "bg-orange-500"
                        : (s.less15 || 0) > 0
                          ? "bg-yellow-500"
                          : "bg-green-500"
                  }`}
                >
                  {s.total || 0}
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <p className="text-green-600">30 кундан кам: {s.less30 || 0}</p>
                <p className="text-yellow-500">
                  15 кундан кам: {s.less15 || 0}
                </p>
                <p className="text-orange-500">5 кундан кам: {s.less5 || 0}</p>
                <p className="text-red-600 font-semibold">
                  Муддати ўтган: {s.expired || 0}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {stations.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          Сизга бириктирилган заправкалар бўйича маълумот мавжуд эмас
        </div>
      )}
    </div>
  );
};

export default EmployeesDocDeadline;
