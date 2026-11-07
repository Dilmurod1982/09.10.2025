import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "../lib/zustand";
import { db } from "../firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";
import AddElectricReadingModal from "../components/electric/AddElectricReadingModal";

const ElectricReadings = () => {
  const userData = useAppStore((state) => state.userData);
  const managedStations = userData?.stations || [];

  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeter, setSelectedMeter] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);

      // 🔍 Извлекаем UID привязанных станций
      const managedUids = managedStations
        .map((s) => {
          if (typeof s === "object" && s !== null) {
            return String(s.id ?? s.uid ?? s.stationId ?? "");
          }
          return String(s);
        })
        .filter(Boolean);

      console.log("🔍 managedUids из userData:", managedUids);

      if (managedUids.length === 0) {
        setDebugInfo({
          message: "У механика нет привязанных станций в userData.stations",
        });
        setMeters([]);
        setLoading(false);
        return;
      }

      // 🔥 ШАГ 1: получаем mainData (все станции)
      const mainSnap = await getDoc(doc(db, "gasSettlements", "main"));
      const allStations = mainSnap.exists()
        ? mainSnap.data()?.mainData || []
        : [];

      console.log("🔍 Всего станций в mainData:", allStations.length);

      // 🔥 ШАГ 2: преобразуем UID → числовые id (или другие поля)
      // Ищем поле у станции, значение которого совпадает с UID
      const resolvedStationIds = [];

      for (const station of allStations) {
        const candidates = [
          String(station.id ?? ""),
          String(station.uid ?? ""),
          String(station.stationId ?? ""),
          String(station.firestoreId ?? ""),
          String(station.docId ?? ""),
        ];

        // Если какой-то из UID механика совпадает с полем станции
        if (managedUids.some((uid) => candidates.includes(uid))) {
          resolvedStationIds.push(String(station.id));
        }
      }

      console.log(
        "✅ Преобразованные stationId из mainData:",
        resolvedStationIds
      );

      // 🔥 Если не нашли совпадения в mainData — пробуем коллекцию "stations"
      if (resolvedStationIds.length === 0) {
        console.log(
          "⚠️ UID не совпал с mainData, пробую коллекцию stations..."
        );

        for (const uid of managedUids) {
          try {
            const stationDoc = await getDoc(doc(db, "stations", uid));
            if (stationDoc.exists()) {
              const data = stationDoc.data();
              // В самом документе stations может быть поле gasStationId или id
              const stationId = String(data.gasStationId ?? data.id ?? uid);
              resolvedStationIds.push(stationId);
              console.log(
                `✅ Найден stations/${uid} → stationId: ${stationId}`
              );
            }
          } catch (e) {
            console.warn(`Не удалось загрузить stations/${uid}`, e.message);
          }
        }
      }

      if (resolvedStationIds.length === 0) {
        setDebugInfo({
          message:
            "Не удалось сопоставить UID станций с числовыми id в mainData. Проверь структуру данных.",
          managedUids,
          firstStation: allStations[0]
            ? {
                id: allStations[0].id,
                uid: allStations[0].uid,
                allKeys: Object.keys(allStations[0]),
              }
            : null,
        });
        setMeters([]);
        setLoading(false);
        return;
      }

      // 🔥 ШАГ 3: загружаем счётчики по найденным stationId
      const metersList = [];

      // Firestore "in" — до 10 элементов
      const chunks = [];
      for (let i = 0; i < resolvedStationIds.length; i += 10) {
        chunks.push(resolvedStationIds.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        const metersQ = query(
          collection(db, "electricMeters"),
          where("stationId", "in", chunk)
        );
        const metersSnap = await getDocs(metersQ);
        metersSnap.forEach((d) => {
          metersList.push({ id: d.id, ...d.data() });
        });
      }

      console.log("✅ Найдено счётчиков:", metersList.length);

      // 🔥 ШАГ 4: для каждого счётчика — последнее показание
      const withLastReading = await Promise.all(
        metersList.map(async (m) => {
          try {
            const readingsQ = query(
              collection(db, "electricReadings"),
              where("meterId", "==", m.id),
              orderBy("readingDate", "desc"),
              limit(1)
            );
            const rSnap = await getDocs(readingsQ);
            const lastReading = rSnap.empty
              ? null
              : { id: rSnap.docs[0].id, ...rSnap.docs[0].data() };
            return { ...m, lastReading };
          } catch (e) {
            return { ...m, lastReading: null };
          }
        })
      );

      setMeters(withLastReading);
      setDebugInfo({
        managedUidsCount: managedUids.length,
        resolvedStationIds,
        metersCount: withLastReading.length,
      });
    } catch (err) {
      console.error("Ошибка загрузки:", err);
      setDebugInfo({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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
          ⚡ Кунлик электр ҳисоблагич кўрсаткичлари
        </h1>
        <p className="text-gray-500 mt-1">
          Ҳисоблагични танлаб, янги кўрсаткич киритинг
        </p>
      </div>

      {/* 🔍 Диагностика */}
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

      {meters.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            Сизнинг станцияларингизда ҳисоблагичлар йўқ
          </h3>
          <p className="text-gray-500 text-sm mb-4">
            Агар сизда ҳисоблагичлар бўлиши керак бўлса — админ билан боғланинг
          </p>
          <div className="text-xs text-gray-400">
            userData.stations = {JSON.stringify(managedStations)}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {meters.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedMeter(m)}
              className="bg-white rounded-2xl shadow-md p-5 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all border border-gray-100"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center text-white text-xl">
                  ⚡
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">
                    {m.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Шартнома: {m.contractNumber || "—"}
                  </p>
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Ҳисоб рақами:</span>
                  <span className="font-mono">{m.consumerAccount || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Охирги кўрсаткич:</span>
                  <span className="font-mono text-blue-600">
                    {m.lastReading
                      ? new Date(m.lastReading.readingDate).toLocaleDateString(
                          "ru-RU"
                        )
                      : "—"}
                  </span>
                </div>
              </div>

              <div className="mt-3 text-sm text-blue-600 font-medium">
                Кўрсаткич киритиш →
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {selectedMeter && (
        <AddElectricReadingModal
          meter={selectedMeter}
          onClose={() => setSelectedMeter(null)}
          onSaved={() => {
            setSelectedMeter(null);
            loadData();
          }}
        />
      )}
    </div>
  );
};

export default ElectricReadings;
