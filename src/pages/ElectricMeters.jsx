import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAppStore } from "../lib/zustand";
import { db } from "../firebase/config";
import { doc, getDoc } from "firebase/firestore";

const ElectricMeters = () => {
  const navigate = useNavigate();
  const userData = useAppStore((state) => state.userData);
  const managedStations = userData?.stations || [];

  const [stationsList, setStationsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    const loadStations = async () => {
      try {
        setLoading(true);

        // 🔍 ID привязанных станций (обычно Firestore UID)
        const managedIds = managedStations
          .map((s) => {
            if (typeof s === "object" && s !== null) {
              return String(s.id ?? s.uid ?? s.stationId ?? "");
            }
            return String(s);
          })
          .filter(Boolean);

        if (managedIds.length === 0) {
          setDebugInfo({
            message: "В userData.stations нет привязанных станций",
          });
          setLoading(false);
          return;
        }

        // Загружаем все станции из mainData
        const mainSnap = await getDoc(doc(db, "gasSettlements", "main"));
        const allStations = mainSnap.exists()
          ? mainSnap.data()?.mainData || []
          : [];

        // 🔥 ДИАГНОСТИКА: показываем поля первой станции
        const firstStationSample = allStations[0]
          ? {
              sampleId: allStations[0].id,
              sampleUid: allStations[0].uid,
              sampleStationId: allStations[0].stationId,
              sampleFirestoreId: allStations[0].firestoreId,
              sampleDocId: allStations[0].docId,
              allKeys: Object.keys(allStations[0]),
            }
          : null;

        console.log(
          "📋 Пример первой станции из mainData:",
          firstStationSample
        );

        // 🔥 Пробуем найти станцию по нескольким возможным полям
        const filtered = allStations.filter((s) => {
          const candidates = [
            String(s.id ?? ""),
            String(s.uid ?? ""),
            String(s.stationId ?? ""),
            String(s.firestoreId ?? ""),
            String(s.docId ?? ""),
          ];
          return managedIds.some((mid) => candidates.includes(mid));
        });

        console.log("✅ Найдено привязанных станций:", filtered.length);

        // Если не нашли — попробуем другой подход:
        // возможно привязанные станции лежат в ОТДЕЛЬНОЙ коллекции "stations"
        if (filtered.length === 0) {
          console.log(
            "⚠️ Совпадений в mainData нет. Пробую коллекцию stations..."
          );

          try {
            const { collection, query, where, getDocs } = await import(
              "firebase/firestore"
            );

            // Пробуем достать документы из коллекции "stations" по их UID
            const found = [];
            for (const uid of managedIds) {
              try {
                const stationDoc = await getDoc(doc(db, "stations", uid));
                if (stationDoc.exists()) {
                  const data = stationDoc.data();
                  found.push({
                    id: uid, // 🔥 используем UID как id
                    uid,
                    ...data,
                  });
                }
              } catch (e) {
                // пропускаем
              }
            }

            if (found.length > 0) {
              console.log("✅ Найдено в коллекции stations:", found.length);
              setStationsList(found);
              setDebugInfo({
                source: "stations collection",
                matchedStations: found.length,
                managedIdsCount: managedIds.length,
              });
              setLoading(false);
              return;
            }
          } catch (e) {
            console.error("Ошибка поиска в stations:", e);
          }
        }

        setStationsList(filtered);
        setDebugInfo({
          managedIdsCount: managedIds.length,
          totalStations: allStations.length,
          matchedStations: filtered.length,
          firstStationSample,
          managedIds,
        });
      } catch (err) {
        console.error("Ошибка загрузки станций:", err);
        setDebugInfo({ error: err.message });
      } finally {
        setLoading(false);
      }
    };

    loadStations();
  }, [managedStations]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          ⚡ Электр энергия ҳисоблагичлари
        </h1>
        <p className="text-gray-500 mt-1">
          Станцияни танланг — ҳисоблагичлар рўйхати очилади
        </p>
      </div>

      {/* 🔥 Диагностика */}
      {debugInfo && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
          <details>
            <summary className="cursor-pointer font-medium">
              🔍 Диагностика
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-all">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {stationsList.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            Сизга ҳеч қандай станция бириктирилмаган
          </h3>
          <p className="text-gray-500 text-sm mb-4">
            userData.stations = {JSON.stringify(managedStations)}
          </p>
          <p className="text-xs text-gray-400">
            Откройте консоль (F12) и посмотрите диагностику выше, чтобы увидеть
            какие поля есть у станций в mainData
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stationsList.map((station, index) => (
            <motion.div
              key={station.id || station.uid}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() =>
                navigate(
                  `/electric-meters/station/${station.id || station.uid}`
                )
              }
              className="bg-white rounded-2xl shadow-md p-5 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all border border-gray-100"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center text-white text-xl">
                  ⚡
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">
                    {station.name || `Станция #${station.id}`}
                  </h3>
                  <p className="text-sm text-gray-500 truncate">
                    {station.landmark || "—"}
                  </p>
                </div>
              </div>
              <div className="mt-4 text-sm text-blue-600 font-medium">
                Ҳисоблагичларни кўриш →
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ElectricMeters;
