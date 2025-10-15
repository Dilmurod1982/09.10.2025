import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";

const DocByStation = () => {
  const [stations, setStations] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStationsAndDocs();
  }, []);

  const fetchStationsAndDocs = async () => {
    try {
      const stationsSnap = await getDocs(collection(db, "stations"));
      const docsSnap = await getDocs(collection(db, "documents"));

      const stationsData = stationsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const counts = {};

      docsSnap.forEach((doc) => {
        const data = doc.data();
        const stationId = data.stationId;
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

        if (diffDays < 0) counts[stationId].expired++;
        else if (diffDays <= 5) counts[stationId].less5++;
        else if (diffDays <= 15) counts[stationId].less15++;
        else if (diffDays <= 30) counts[stationId].less30++;
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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Документы по станциям</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {stations.map((station) => {
          const s = stats[station.id];
          if (!s) return null;

          // если все равно нули — не показываем
          if (s.expired + s.less5 + s.less15 + s.less30 === 0) return null;

          return (
            <Link
              key={station.id}
              to={`/stationdocs/${station.id}`}
              className="border rounded-lg p-4 hover:shadow-md transition bg-white">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-medium text-lg">{station.stationName}</h2>
                <div className="w-8 h-8 rounded-md bg-blue-500 flex items-center justify-center text-white text-xs font-semibold">
                  {s.total || 0}
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <p className="text-green-600">
                  Меньше 30 дней: {s.less30 || 0}
                </p>
                <p className="text-yellow-500">
                  Меньше 15 дней: {s.less15 || 0}
                </p>
                <p className="text-orange-500">Меньше 5 дней: {s.less5 || 0}</p>
                <p className="text-red-600 font-semibold">
                  Просрочено: {s.expired || 0}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default DocByStation;
