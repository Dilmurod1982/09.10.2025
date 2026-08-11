import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../lib/zustand";

const DocByStation = () => {
  const [stations, setStations] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  const userData = useAppStore((state) => state.userData);
  const role = userData?.role;

  // Определяем, какие типы документов показывать для metrolog-hududgaz
  const getFilteredDocumentTypes = (typesSet) => {
    if (role === "metrolog-hududgaz") {
      // Только эти 3 типа для метролога
      const allowedTypes = [
        "Газ ҳисоблаш тугунини сертификати (ИК)",
        "Газ ҳисоблагич сертификати (Автопилот)",
        "Торайтирувчи мослама сертификати (Шайба)",
      ];

      // Фильтруем типы документов
      const filteredSet = new Set();
      const typesArray = Array.from(typesSet);
      typesArray.forEach((typeId) => {
        // Проверяем, соответствует ли тип документа разрешенным названиям
        // Предполагаем, что typeId содержит название или мы можем сопоставить
        if (
          allowedTypes.includes(typeId) ||
          allowedTypes.some((name) => typeId.includes(name))
        ) {
          filteredSet.add(typeId);
        }
      });

      return filteredSet;
    }
    return typesSet;
  };

  useEffect(() => {
    fetchStationsAndDocs();
  }, [role]);

  const fetchStationsAndDocs = async () => {
    try {
      const stationsSnap = await getDocs(collection(db, "stations"));
      const docsSnap = await getDocs(collection(db, "documents"));
      const typesSnap = await getDocs(collection(db, "document_types"));

      // Получаем все типы документов с expiration
      const expirationTypes = new Set();
      const typesMap = {};
      const typesNameMap = {}; // Маппинг ID -> название

      typesSnap.forEach((doc) => {
        const data = doc.data();
        const typeId = data.id;
        const typeName = data.name;

        typesMap[typeId] = typeName;
        typesNameMap[typeName] = typeId;

        if (data.validity === "expiration") {
          expirationTypes.add(typeId);
        }
      });

      // Применяем фильтрацию для metrolog-hududgaz
      let filteredExpirationTypes = expirationTypes;

      if (role === "metrolog-hududgaz") {
        const allowedNames = [
          "Газ ҳисоблаш тугунини сертификати (ИК)",
          "Газ ҳисоблагич сертификати (Автопилот)",
          "Торайтирувчи мослама сертификати (Шайба)",
        ];

        // Получаем ID разрешенных типов по их названиям
        const allowedIds = allowedNames
          .map((name) => typesNameMap[name])
          .filter((id) => id !== undefined);

        filteredExpirationTypes = new Set(
          Array.from(expirationTypes).filter((id) => allowedIds.includes(id)),
        );
      }

      const stationsData = stationsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Группируем документы по станциям и типам, оставляя только последние
      const latestDocsByStation = {};

      docsSnap.forEach((doc) => {
        const data = doc.data();
        const stationId = data.stationId;
        const docType = data.docType;

        // Пропускаем документы не expiration типа
        if (!filteredExpirationTypes.has(docType)) {
          return;
        }

        // Проверяем наличие expiryDate
        if (!data.expiryDate) {
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
          latestDocsByStation[stationId][docType] = {
            expiry,
            diffDays,
          };
        }
      });

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
      <h1 className="text-2xl font-semibold mb-6">
        Заправкалар бўйича ҳужжатлар статистикаси
      </h1>

      {/* Информационное сообщение для метролога */}
      {role === "metrolog-hududgaz" && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
          <span className="font-medium">ℹ️ </span>
          Фақат газ ускуналари бўйича ҳужжатлар кўрсатилмоқда. Қуйидаги ҳужжат
          турлари кўрсатилади:
          <ul className="list-disc list-inside mt-1 ml-2">
            <li>Газ ҳисоблаш тугунини сертификати (ИК)</li>
            <li>Газ ҳисоблагич сертификати (Автопилот)</li>
            <li>Торайтирувчи мослама сертификати (Шайба)</li>
          </ul>
        </div>
      )}

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
