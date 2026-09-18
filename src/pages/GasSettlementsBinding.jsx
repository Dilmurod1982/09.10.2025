import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { toast } from "react-toastify";

const GasSettlementsBinding = () => {
  const [stations, setStations] = useState([]);
  const [mainData, setMainData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  // ---------- ЗАГРУЗКА ----------
  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      // 1. Станции
      const stationsSnap = await getDocs(collection(db, "stations"));
      const stationsArr = stationsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setStations(stationsArr);

      // 2. gasSettlements/main
      const mainRef = doc(db, "gasSettlements", "main");
      const mainSnap = await getDoc(mainRef);
      if (mainSnap.exists()) {
        const data = mainSnap.data();
        setMainData(data.mainData || []);
      } else {
        toast.error("gasSettlements/main топилмади");
      }
    } catch (e) {
      console.error(e);
      toast.error("Маълумотларни юклашда хатолик");
    } finally {
      setLoading(false);
    }
  };

  // ---------- ВЫЧИСЛЕНИЕ ЗАНЯТЫХ ----------
  const attachedMap = useMemo(() => {
    const map = {};
    mainData.forEach((item) => {
      if (item.stationId) {
        map[item.id] = item.stationId; // ключ — id объекта
      }
    });
    return map;
  }, [mainData]);

  // ---------- СОХРАНЕНИЕ ПО ID ОБЪЕКТА ----------
  const handleAttach = async (station, selectedId) => {
    if (!selectedId) return;
    setSavingId(station.id);

    try {
      // ⭐ Ищем СТРОГО по id (а не по landmark)
      const mainIndex = mainData.findIndex(
        (m) => String(m.id) === String(selectedId)
      );
      if (mainIndex === -1) {
        toast.error("Танланган объект топилмади");
        return;
      }

      const mainItem = mainData[mainIndex];

      // 1. Обновляем gasSettlements/main -> mainData[mainIndex]
      const updatedMainData = [...mainData];
      updatedMainData[mainIndex] = {
        ...mainItem,
        stationId: station.id,
        stationName: station.stationName,
      };

      await updateDoc(doc(db, "gasSettlements", "main"), {
        mainData: updatedMainData,
        updatedAt: new Date(),
      });

      // 2. Обновляем stations/{station.id}
      await updateDoc(doc(db, "stations", station.id), {
        gasSettlementMainId: mainItem.id,
        gasSettlementLandmark: mainItem.landmark,
        updatedAt: new Date(),
      });

      // 3. Локальный state
      setMainData(updatedMainData);
      setStations((prev) =>
        prev.map((s) =>
          s.id === station.id
            ? {
                ...s,
                gasSettlementMainId: mainItem.id,
                gasSettlementLandmark: mainItem.landmark,
              }
            : s
        )
      );

      toast.success("Муваффақиятли боғланди");
    } catch (e) {
      console.error(e);
      toast.error("Сақлашда хатолик");
    } finally {
      setSavingId(null);
    }
  };

  // ---------- ОТКРЕПЛЕНИЕ ----------
  const handleDetach = async (station) => {
    setSavingId(station.id);
    try {
      const updatedMainData = mainData.map((item) =>
        item.stationId === station.id
          ? { ...item, stationId: null, stationName: null }
          : item
      );

      await updateDoc(doc(db, "gasSettlements", "main"), {
        mainData: updatedMainData,
        updatedAt: new Date(),
      });

      await updateDoc(doc(db, "stations", station.id), {
        gasSettlementMainId: null,
        gasSettlementLandmark: null,
        updatedAt: new Date(),
      });

      setMainData(updatedMainData);
      setStations((prev) =>
        prev.map((s) =>
          s.id === station.id
            ? {
                ...s,
                gasSettlementMainId: null,
                gasSettlementLandmark: null,
              }
            : s
        )
      );

      toast.success("Боғланиш ўчирилди");
    } catch (e) {
      console.error(e);
      toast.error("Ўчиришда хатолик");
    } finally {
      setSavingId(null);
    }
  };

  // ---------- ФИЛЬТРАЦИЯ OPTIONS ----------
  const getAvailableOptions = (station) => {
    return mainData.filter((item) => {
      // Показываем текущий привязанный объект (по id)
      if (String(item.stationId) === String(station.id)) return true;
      // Скрываем привязанные к другим
      if (item.stationId) return false;
      // Свободные — показываем
      return true;
    });
  };

  // ---------- УНИКАЛЬНЫЙ VALUE ДЛЯ SELECT ----------
  // Мы используем mainItem.id (например "1", "2"). Он уникален.
  // Если у вас по какой-то причине id повторяются — используем `${id}_${idx}`
  const getOptionValue = (item, idx) => {
    // Если id есть — используем его
    if (item.id !== undefined && item.id !== null) {
      return String(item.id);
    }
    // Fallback: составной ключ
    return `${item.landmark}_${idx}`;
  };

  // ---------- ОПРЕДЕЛЕНИЕ ВЫБРАННОГО VALUE ДЛЯ SELECT ----------
  // Станция привязана к mainItem с id = station.gasSettlementMainId
  // Значит, в select должно быть выбрано option со значением этого id
  const getSelectedValue = (station) => {
    if (!station.gasSettlementMainId) return "";
    // Ищем объект в mainData по его id
    const mainItem = mainData.find(
      (m) => String(m.id) === String(station.gasSettlementMainId)
    );
    if (!mainItem) return "";
    return String(mainItem.id);
  };

  // ---------- РЕНДЕР ----------
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">
        ⚡ Газ ҳисоби объектларини боғлаш
      </h2>

      <div className="bg-white rounded-2xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                <th className="px-4 py-3 text-left font-semibold">
                  Станция номи
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  Ташкилот (МЧЖ)
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  Станция рақами
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  Боғланган объект (landmark)
                </th>
                <th className="px-4 py-3 text-left font-semibold">Ҳаракат</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stations.map((station) => {
                const options = getAvailableOptions(station);
                const isSaving = savingId === station.id;
                const selectedValue = getSelectedValue(station);

                return (
                  <tr
                    key={station.id}
                    className="hover:bg-purple-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {station.stationName || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {station.organizationName || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {station.stationNumber || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={selectedValue}
                        onChange={(e) => handleAttach(station, e.target.value)}
                        disabled={isSaving}
                        className="w-full min-w-[220px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                      >
                        <option value="">— Танланмаган —</option>
                        {options.map((item, idx) => (
                          <option
                            key={getOptionValue(item, idx)}
                            value={getOptionValue(item, idx)}
                          >
                            {item.landmark}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {station.gasSettlementLandmark && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDetach(station)}
                          disabled={isSaving}
                          className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-400"
                        >
                          {isSaving ? "..." : "Узиш"}
                        </motion.button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {stations.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            Станциялар топилмади
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="font-semibold">Жами станциялар:</p>
          <p className="text-2xl text-purple-600">{stations.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="font-semibold">Боғланган:</p>
          <p className="text-2xl text-green-600">
            {stations.filter((s) => s.gasSettlementMainId).length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="font-semibold">Боғланмаган:</p>
          <p className="text-2xl text-orange-600">
            {stations.filter((s) => !s.gasSettlementMainId).length}
          </p>
        </div>
      </div>
    </div>
  );
};

export default GasSettlementsBinding;
