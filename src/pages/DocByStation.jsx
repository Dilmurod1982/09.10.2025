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

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="h-20 w-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-10 px-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 text-center mb-10">
          Документы по станциям
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {stations.map((station) => {
            const s = stats[station.id];
            if (!s) return null;

            // если все равно нули — не показываем
            if (s.expired + s.less5 + s.less15 + s.less30 === 0) return null;

            return (
              <Link
                key={station.id}
                to={`/stationdocs/${station.id}`}
                className="group">
                <div className="bg-white rounded-2xl shadow-md hover:shadow-2xl p-6 transition-transform transform hover:-translate-y-2 border border-gray-200 hover:border-blue-300 duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {station.stationName}
                    </h3>
                  </div>

                  <div className="space-y-2 text-sm">
                    {s.less30 > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Меньше 30 дней:</span>
                        <span>{s.less30}</span>
                      </div>
                    )}
                    {s.less15 > 0 && (
                      <div className="flex justify-between text-orange-500">
                        <span>Меньше 15 дней:</span>
                        <span>{s.less15}</span>
                      </div>
                    )}
                    {s.less5 > 0 && (
                      <div className="flex justify-between text-yellow-500 font-medium">
                        <span>Меньше 5 дней:</span>
                        <span>{s.less5}</span>
                      </div>
                    )}
                    {s.expired > 0 && (
                      <div className="flex justify-between text-red-600 font-semibold">
                        <span>Просрочено:</span>
                        <span>{s.expired}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DocByStation;
