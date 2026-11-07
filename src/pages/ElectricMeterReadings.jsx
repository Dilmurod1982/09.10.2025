import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { db } from "../firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import AddElectricReadingModal from "../components/electric/AddElectricReadingModal";

const ElectricMeterReadings = () => {
  const { meterId } = useParams();
  const navigate = useNavigate();

  const [meter, setMeter] = useState(null);
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);

      // Загружаем счётчик
      const meterDoc = await getDoc(doc(db, "electricMeters", meterId));
      if (meterDoc.exists()) {
        setMeter({ id: meterDoc.id, ...meterDoc.data() });
      } else {
        setMeter(null);
      }

      // Загружаем показания
      const q = query(
        collection(db, "electricReadings"),
        where("meterId", "==", meterId)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Сортируем по дате (свежие сверху)
      list.sort((a, b) =>
        (b.readingDate || "").localeCompare(a.readingDate || "")
      );

      setReadings(list);
    } catch (err) {
      console.error("Ошибка загрузки:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [meterId]);

  // Разница показаний для каждой записи
  const readingsWithDiff = useMemo(() => {
    // Сортируем по возрастанию для расчёта разницы
    const sorted = [...readings].sort((a, b) =>
      (a.readingDate || "").localeCompare(b.readingDate || "")
    );

    return sorted
      .map((r, idx) => {
        const prev = idx > 0 ? sorted[idx - 1] : null;
        const coefficient = Number(meter?.coefficient) || 0;

        const activeDiff = prev
          ? Math.max(0, (r.activeEnergy || 0) - (prev.activeEnergy || 0))
          : 0;
        const reactiveDiff = prev
          ? Math.max(0, (r.reactiveEnergy || 0) - (prev.reactiveEnergy || 0))
          : 0;
        const ecoDiff = prev ? Math.max(0, (r.eco || 0) - (prev.eco || 0)) : 0;

        return {
          ...r,
          activeDiff,
          reactiveDiff,
          ecoDiff,
          activeResult: activeDiff * coefficient,
          reactiveResult: reactiveDiff * coefficient,
          ecoResult: ecoDiff * coefficient,
        };
      })
      .reverse(); // свежие сверху
  }, [readings, meter]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const [y, m, d] = dateStr.split("-");
    return `${d}.${m}.${y}`;
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return "—";
    return Number(num).toLocaleString("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 5,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!meter) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow p-8 sm:p-12 text-center">
          <div className="text-5xl mb-4">🔌</div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            Ҳисоблагич топилмади
          </h3>
          <button
            onClick={() => navigate("/electric-readings")}
            className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ← Орқага
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Навигация назад */}
      <button
        onClick={() => navigate("/electric-readings")}
        className="text-sm text-blue-600 hover:text-blue-800 mb-3 inline-flex items-center gap-1"
      >
        ← Орқага
      </button>

      {/* Заголовок + кнопка добавления */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-800 leading-tight truncate">
            ⚡ {meter.name}
          </h1>
          <div className="text-xs sm:text-sm text-gray-500 mt-1 space-y-0.5">
            <div>Шартнома: {meter.contractNumber || "—"}</div>
            <div>Ҳисоб рақами: {meter.consumerAccount || "—"}</div>
            <div>
              Коэффициент:{" "}
              <span className="font-mono">
                {Number(meter.coefficient || 0).toFixed(5)}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto px-4 sm:px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-md transition-all text-sm font-medium flex items-center justify-center gap-2"
        >
          <span>+</span> Янги кўрсаткични киритиш
        </button>
      </div>

      {/* Список показаний */}
      {readingsWithDiff.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-8 sm:p-12 text-center">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="text-base sm:text-lg font-medium text-gray-700 mb-2">
            Ҳозирча кўрсаткичлар йўқ
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Биринчи кўрсаткични киритиш учун тугмани босинг
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            + Биринчи кўрсаткич
          </button>
        </div>
      ) : (
        <>
          {/* 📱 Мобильная версия — карточки */}
          <div className="sm:hidden space-y-2">
            {readingsWithDiff.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-xl shadow-md p-3 border border-gray-100"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm font-semibold text-gray-800">
                    📅 {formatDate(r.readingDate)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-blue-50 p-2 rounded-lg">
                    <div className="text-blue-600 mb-0.5 font-medium">
                      Актив
                    </div>
                    <div className="font-mono text-gray-800">
                      {formatNumber(r.activeEnergy)}
                    </div>
                    {r.activeDiff > 0 && (
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        +{formatNumber(r.activeDiff)} × коэф ={" "}
                        {formatNumber(r.activeResult)}
                      </div>
                    )}
                  </div>
                  <div className="bg-orange-50 p-2 rounded-lg">
                    <div className="text-orange-600 mb-0.5 font-medium">
                      Реактив
                    </div>
                    <div className="font-mono text-gray-800">
                      {formatNumber(r.reactiveEnergy)}
                    </div>
                    {r.reactiveDiff > 0 && (
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        +{formatNumber(r.reactiveDiff)} × коэф ={" "}
                        {formatNumber(r.reactiveResult)}
                      </div>
                    )}
                  </div>
                  <div className="bg-green-50 p-2 rounded-lg col-span-2">
                    <div className="text-green-600 mb-0.5 font-medium">ЭКО</div>
                    <div className="font-mono text-gray-800">
                      {formatNumber(r.eco)}
                    </div>
                    {r.ecoDiff > 0 && (
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        +{formatNumber(r.ecoDiff)} × коэф ={" "}
                        {formatNumber(r.ecoResult)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 💻 Планшет/десктоп — таблица */}
          <div className="hidden sm:block bg-white rounded-2xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left">Сана</th>
                    <th className="p-3 text-right">Актив</th>
                    <th className="p-3 text-right">Актив (фарқ)</th>
                    <th className="p-3 text-right">Актив (× коэф)</th>
                    <th className="p-3 text-right">Реактив</th>
                    <th className="p-3 text-right">Реактив (фарқ)</th>
                    <th className="p-3 text-right">Реактив (× коэф)</th>
                    <th className="p-3 text-right">ЭКО</th>
                    <th className="p-3 text-right">ЭКО (фарқ)</th>
                    <th className="p-3 text-right">ЭКО (× коэф)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {readingsWithDiff.map((r) => (
                    <tr key={r.id} className="hover:bg-blue-50">
                      <td className="p-3 font-medium">
                        {formatDate(r.readingDate)}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {formatNumber(r.activeEnergy)}
                      </td>
                      <td className="p-3 text-right font-mono text-gray-600">
                        {r.activeDiff > 0 ? formatNumber(r.activeDiff) : "—"}
                      </td>
                      <td className="p-3 text-right font-mono text-blue-600 font-semibold">
                        {r.activeDiff > 0 ? formatNumber(r.activeResult) : "—"}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {formatNumber(r.reactiveEnergy)}
                      </td>
                      <td className="p-3 text-right font-mono text-gray-600">
                        {r.reactiveDiff > 0
                          ? formatNumber(r.reactiveDiff)
                          : "—"}
                      </td>
                      <td className="p-3 text-right font-mono text-orange-600 font-semibold">
                        {r.reactiveDiff > 0
                          ? formatNumber(r.reactiveResult)
                          : "—"}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {formatNumber(r.eco)}
                      </td>
                      <td className="p-3 text-right font-mono text-gray-600">
                        {r.ecoDiff > 0 ? formatNumber(r.ecoDiff) : "—"}
                      </td>
                      <td className="p-3 text-right font-mono text-green-600 font-semibold">
                        {r.ecoDiff > 0 ? formatNumber(r.ecoResult) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showAddModal && (
        <AddElectricReadingModal
          meter={meter}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};

export default ElectricMeterReadings;
