import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { getStatusColor } from "../utils/dateUtils";

const Home = () => {
  const [stations, setStations] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [docTypes, setDocTypes] = useState([]); // 🔹 Типы документов
  const [stats, setStats] = useState({
    totalStations: 0,
    totalDocs: 0,
    expired: 0,
    less30: 0,
    less15: 0,
    less5: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // === Получаем все станции ===
        const stationsSnap = await getDocs(collection(db, "stations"));
        const stationsData = stationsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setStations(stationsData);

        // === Получаем все документы ===
        const docsSnap = await getDocs(collection(db, "documents"));
        const docsData = docsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDocuments(docsData);

        // === Получаем типы документов ===
        const typesSnap = await getDocs(collection(db, "document_types"));
        const typesData = typesSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDocTypes(typesData);

        // === Подсчёт статистики ===
        const now = new Date();
        let expired = 0,
          less5 = 0,
          less15 = 0,
          less30 = 0;

        docsData.forEach((d) => {
          if (!d.expiryDate) return;
          const expiry = new Date(d.expiryDate);
          const diff = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
          if (diff < 0) expired++;
          else if (diff <= 5) less5++;
          else if (diff <= 15) less15++;
          else if (diff <= 30) less30++;
        });

        setStats({
          totalStations: stationsData.length,
          totalDocs: docsData.length,
          expired,
          less30,
          less15,
          less5,
        });
      } catch (err) {
        console.error("Ошибка загрузки данных:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  if (loading) return <p className="text-center mt-20">Загрузка...</p>;

  // 🔹 Функция для получения имени типа документа
  const getDocTypeName = (typeId) => {
    const type = docTypes.find((t) => t.id === typeId);
    return type ? type.name : "—";
  };

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">
        Заправкалар бошқарув панели
      </h1>

      {/* === Карточки статистики === */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Заправкалар"
          value={stats.totalStations}
          color="bg-blue-500"
        />
        <StatCard
          title="Хужжатлар"
          value={stats.totalDocs}
          color="bg-gray-500"
        />
        <StatCard
          title="Муддати ўтди"
          value={stats.expired}
          color="bg-red-600"
        />
        <StatCard title="≤ 30 кун" value={stats.less30} color="bg-orange-500" />
        <StatCard title="≤ 15 кун" value={stats.less15} color="bg-yellow-500" />
        <StatCard title="≤ 5 кун" value={stats.less5} color="bg-amber-600" />
      </div>

      {/* === Последние документы === */}
      <div>
        <h2 className="text-xl font-semibold mb-3">
          Охирги кўшилган хужжатлар
        </h2>
        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <table className="table w-full">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th>#</th>
                <th>Тури</th>
                <th>Заправка</th>
                <th>Тугаш муддати</th>
                <th>Холати</th>
              </tr>
            </thead>
            <tbody>
              {documents
                .slice(-10)
                .reverse()
                .map((doc, idx) => {
                  const expiry = doc.expiryDate
                    ? new Date(doc.expiryDate)
                    : null;
                  const diff =
                    expiry && !isNaN(expiry)
                      ? Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24))
                      : null;
                  const color = getStatusColor(expiry);

                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td>{idx + 1}</td>
                      <td>{getDocTypeName(doc.docType)}</td>
                      <td>{doc.stationName || "—"}</td>
                      <td>{doc.expiryDate || "—"}</td>
                      <td className={`font-semibold ${color}`}>
                        {diff != null
                          ? diff < 0
                            ? "ўтиб кетди"
                            : `${diff} кун қолди`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// === Компонент карточки статистики ===
const StatCard = ({ title, value, color }) => (
  <div
    className={`rounded-xl shadow-lg p-4 text-white flex flex-col justify-center items-center ${color}`}>
    <span className="text-2xl font-bold">{value}</span>
    <span className="text-sm mt-1 opacity-90">{title}</span>
  </div>
);

export default Home;
