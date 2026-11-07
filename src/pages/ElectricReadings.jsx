import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAppStore } from "../lib/zustand";
import { db } from "../firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

const ElectricReadings = () => {
  const navigate = useNavigate();
  const userData = useAppStore((state) => state.userData);
  const managedStations = userData?.stations || [];

  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);

      const managedUids = managedStations
        .map((s) => {
          if (typeof s === "object" && s !== null) {
            return String(s.id ?? s.uid ?? s.stationId ?? "");
          }
          return String(s);
        })
        .filter(Boolean);

      if (managedUids.length === 0) {
        setMeters([]);
        setLoading(false);
        return;
      }

      const mainSnap = await getDoc(doc(db, "gasSettlements", "main"));
      const allStations = mainSnap.exists()
        ? mainSnap.data()?.mainData || []
        : [];

      const resolvedStationIds = [];
      for (const station of allStations) {
        const candidates = [
          String(station.id ?? ""),
          String(station.uid ?? ""),
          String(station.stationId ?? ""),
          String(station.firestoreId ?? ""),
          String(station.docId ?? ""),
        ];
        if (managedUids.some((uid) => candidates.includes(uid))) {
          resolvedStationIds.push(String(station.id));
        }
      }

      if (resolvedStationIds.length === 0) {
        for (const uid of managedUids) {
          try {
            const stationDoc = await getDoc(doc(db, "stations", uid));
            if (stationDoc.exists()) {
              const data = stationDoc.data();
              const stationId = String(data.gasStationId ?? data.id ?? uid);
              resolvedStationIds.push(stationId);
            }
          } catch (e) {
            /* пропускаем */
          }
        }
      }

      if (resolvedStationIds.length === 0) {
        setMeters([]);
        setLoading(false);
        return;
      }

      const metersList = [];
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

      const withLastReading = await Promise.all(
        metersList.map(async (m) => {
          try {
            const readingsQ = query(
              collection(db, "electricReadings"),
              where("meterId", "==", m.id)
            );
            const rSnap = await getDocs(readingsQ);

            let lastReading = null;
            if (!rSnap.empty) {
              const readings = rSnap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              }));
              readings.sort((a, b) =>
                (b.readingDate || "").localeCompare(a.readingDate || "")
              );
              lastReading = readings[0];
            }
            return { ...m, lastReading, readingsCount: rSnap.size };
          } catch (e) {
            return { ...m, lastReading: null, readingsCount: 0 };
          }
        })
      );

      setMeters(withLastReading);
    } catch (err) {
      console.error("Ошибка загрузки:", err);
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">
          ⚡ Кунлик электр ҳисоблагич кўрсаткичлари
        </h1>
        <p className="text-sm sm:text-base text-gray-500 mt-1">
          Ҳисоблагични танланг — кўрсаткичлар рўйхати очилади
        </p>
      </div>

      {meters.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-6 sm:p-12 text-center">
          <div className="text-5xl sm:text-6xl mb-4">📭</div>
          <h3 className="text-base sm:text-lg font-medium text-gray-700">
            Сизнинг станцияларингизда ҳисоблагичлар йўқ
          </h3>
          <p className="text-sm text-gray-500 mt-2">
            Агар сизда ҳисоблагичлар бўлиши керак бўлса — админ билан боғланинг
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {meters.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => navigate(`/electric-readings/${m.id}`)}
              className="bg-white rounded-2xl shadow-md p-4 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all border border-gray-100 active:scale-95"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center text-white text-lg sm:text-xl flex-shrink-0">
                  ⚡
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate text-sm sm:text-base">
                    {m.name}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">
                    Шартнома: {m.contractNumber || "—"}
                  </p>
                </div>
              </div>

              <div className="space-y-1 text-xs sm:text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500 flex-shrink-0">
                    Ҳисоб рақами:
                  </span>
                  <span className="font-mono truncate text-right">
                    {m.consumerAccount || "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500 flex-shrink-0">
                    Охирги кўрсаткич:
                  </span>
                  <span className="font-mono text-blue-600 truncate text-right">
                    {m.lastReading
                      ? new Date(
                          m.lastReading.readingDate + "T00:00:00"
                        ).toLocaleDateString("ru-RU")
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500 flex-shrink-0">
                    Кўрсаткичлар:
                  </span>
                  <span className="font-mono text-gray-700">
                    {m.readingsCount || 0}
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-blue-600 font-medium">
                Кўрсаткичлар рўйхати →
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ElectricReadings;
