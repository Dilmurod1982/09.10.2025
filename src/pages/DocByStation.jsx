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
      // console.log("Загрузка данных...");

      const stationsSnap = await getDocs(collection(db, "stations"));
      const docsSnap = await getDocs(collection(db, "documents"));
      const typesSnap = await getDocs(collection(db, "document_types"));

      // console.log("Станции:", stationsSnap.docs.length);
      // console.log("Документы:", docsSnap.docs.length);
      // console.log("Типы документов:", typesSnap.docs.length);

      // Получаем все типы документов с expiration
      // КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: используем data.id (человеко-читаемый ID), а не doc.id (Firestore ID)
      const expirationTypes = new Set();
      const typesMap = {}; // для отладки

      typesSnap.forEach((doc) => {
        const data = doc.data();
        // console.log(`Тип документа ${doc.id}:`, data);

        // Используем data.id, который содержит человеко-читаемый ID (например, 'flow_device')
        const typeId = data.id;
        typesMap[typeId] = data.name;

        if (data.validity === "expiration") {
          expirationTypes.add(typeId);
          // console.log(`✅ Добавлен expiration тип: ${data.name} (${typeId})`);
        }
      });

      // console.log(
      //   "Типы с expiration:",
      //   Array.from(expirationTypes).map((id) => typesMap[id]),
      // );

      const stationsData = stationsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Группируем документы по станциям и типам, оставляя только последние
      const latestDocsByStation = {};

      // Сначала логируем все документы для отладки
      docsSnap.forEach((doc) => {
        const data = doc.data();
        // console.log(`Документ ${doc.id}:`, {
        //   stationId: data.stationId,
        //   docType: data.docType,
        //   expiryDate: data.expiryDate,
        //   isExpirationType: expirationTypes.has(data.docType),
        // });
      });

      docsSnap.forEach((doc) => {
        const data = doc.data();
        const stationId = data.stationId;
        const docType = data.docType;

        // Пропускаем документы не expiration типа
        if (!expirationTypes.has(docType)) {
          // console.log(`Пропущен документ (не expiration):`, {
          //   stationId,
          //   docType,
          //   typeName: typesMap[docType],
          // });
          return;
        }

        // Проверяем наличие expiryDate
        if (!data.expiryDate) {
          // console.log(`Пропущен документ (нет expiryDate):`, {
          //   stationId,
          //   docType,
          // });
          return;
        }

        const expiry = new Date(data.expiryDate);
        const now = new Date();
        const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

        // Инициализируем объект для станции, если его нет
        if (!latestDocsByStation[stationId]) {
          latestDocsByStation[stationId] = {};
        }

        // Если для этого типа документа еще нет записи, или текущий документ новее
        if (
          !latestDocsByStation[stationId][docType] ||
          expiry > latestDocsByStation[stationId][docType].expiry
        ) {
          // console.log(
          //   `✅ Добавлен/обновлен документ для станции ${stationId}, типа ${docType}:`,
          //   {
          //     expiry: data.expiryDate,
          //     diffDays,
          //   },
          // );

          latestDocsByStation[stationId][docType] = {
            expiry,
            diffDays,
          };
        }
      });

      // console.log("latestDocsByStation:", latestDocsByStation);

      // Подсчитываем статистику только по последним документам
      const counts = {};

      Object.entries(latestDocsByStation).forEach(([stationId, typeDocs]) => {
        if (!counts[stationId]) {
          counts[stationId] = {
            total: 0,
            expired: 0,
            less30: 0,
            less15: 0,
            less5: 0,
          };
        }

        // console.log(`Статистика для станции ${stationId}:`, typeDocs);

        // Подсчитываем статистику по каждому последнему документу
        Object.values(typeDocs).forEach((doc) => {
          counts[stationId].total++;

          if (doc.diffDays < 0) {
            counts[stationId].expired++;
          } else if (doc.diffDays <= 5) {
            counts[stationId].less5++;
          } else if (doc.diffDays <= 15) {
            counts[stationId].less15++;
          } else if (doc.diffDays <= 30) {
            counts[stationId].less30++;
          }
        });
      });

      // console.log("Итоговая статистика:", counts);
      setStats(counts);
      setStations(stationsData);
    } catch (error) {
      // console.error("Ошибка загрузки данных:", error);
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
      <h1 className="text-2xl font-semibold mb-6">
        Заправкалар бўйича ҳужжатлар статистикаси
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {stations.map((station) => {
          const s = stats[station.id] || {
            total: 0,
            expired: 0,
            less30: 0,
            less15: 0,
            less5: 0,
          };

          return (
            <Link
              key={station.id}
              to={`/stationdocs/${station.id}`}
              className="border rounded-lg p-4 hover:shadow-md transition bg-white"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-medium text-lg">{station.stationName}</h2>
                <div className="w-8 h-8 rounded-md bg-blue-500 flex items-center justify-center text-white text-xs font-semibold">
                  {s.total}
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <p className="text-green-600">30 кундан кам: {s.less30}</p>
                <p className="text-yellow-500">15 кундан кам: {s.less15}</p>
                <p className="text-orange-500">5 кундан кам: {s.less5}</p>
                <p className="text-red-600 font-semibold">
                  Муддати ўтиб кетган: {s.expired}
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
