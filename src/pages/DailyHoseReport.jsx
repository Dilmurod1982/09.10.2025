import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase/config";
import AddHoseReportModal from "../components/AddHoseReportModal";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAppStore } from "../lib/zustand";

const DailyHoseReport = () => {
  const userData = useAppStore((state) => state.userData);
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [reports, setReports] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Генерация месяцев с 2025 года
  const months = (() => {
    const arr = [];
    const now = new Date();
    for (let y = 2025; y <= now.getFullYear(); y++) {
      for (let m = 0; m < 12; m++) {
        arr.push(`${y}-${String(m + 1).padStart(2, "0")}`);
      }
    }
    return arr.reverse();
  })();

  // Загружаем станции
  useEffect(() => {
    const fetchStations = async () => {
      if (!userData?.stations?.length) return;

      try {
        const snapshot = await getDocs(collection(db, "stations"));
        const matched = snapshot.docs
          .filter((doc) => userData.stations.includes(doc.id))
          .map((doc) => ({ id: doc.id, ...doc.data() }));

        setStations(matched);
      } catch (error) {
        console.error("Ошибка при загрузке станций:", error);
      }
    };

    fetchStations();
  }, [userData]);

  // Загружаем отчёты
  useEffect(() => {
    if (!selectedStation || !selectedMonth) {
      setReports([]);
      return;
    }

    const fetchReports = async () => {
      setLoading(true);
      try {
        const [year, month] = selectedMonth.split("-");
        const start = `${year}-${month}-01`;
        const end = `${year}-${month}-31`;

        const q = query(
          collection(db, "daily_hose_reports"),
          where("stationId", "==", selectedStation.id),
          where("date", ">=", start),
          where("date", "<=", end),
          orderBy("date", "asc")
        );

        const snapshot = await getDocs(q);
        setReports(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Ошибка при загрузке отчетов:", error);
        setReports([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [selectedStation, selectedMonth]);

  // Расчет итогов
  const totals = useMemo(() => {
    if (!reports.length) return null;

    const totalObj = {
      totalGas: 0,
      hoseTotals: {},
    };

    reports.forEach((report) => {
      totalObj.totalGas += report.totalgas || 0;

      report.hoses?.forEach((hose) => {
        if (!totalObj.hoseTotals[hose.hose]) {
          totalObj.hoseTotals[hose.hose] = {
            current: 0,
            diff: 0,
          };
        }
        totalObj.hoseTotals[hose.hose].current += hose.current || 0;
        totalObj.hoseTotals[hose.hose].diff += hose.diff || 0;
      });
    });

    return totalObj;
  }, [reports]);

  // Экспорт в Excel
  const exportToExcel = () => {
    if (!reports.length) return;

    const sheet = XLSX.utils.json_to_sheet(
      reports.map((r) => ({
        Дата: r.date,
        ...r.hoses.reduce((acc, h) => {
          acc[`${h.hose} показание`] = h.current;
          acc[`${h.hose} расход`] = h.diff;
          return acc;
        }, {}),
        Итого: r.totalgas,
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Отчёт");
    const blob = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([blob]),
      `Отчет_${selectedStation?.stationName || "Станция"}_${selectedMonth}.xlsx`
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Ежедневные отчеты по шлангам
          </h1>
          <p className="text-gray-600">
            Управление и мониторинг показаний шлангов на АГЗС
          </p>
        </div>

        {/* Панель управления */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Выбор станции */}
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Выберите станцию
              </label>
              <select
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none"
                value={selectedStation?.id || ""}
                onChange={(e) => {
                  setSelectedStation(
                    stations.find((s) => s.id === e.target.value) || null
                  );
                  setSelectedMonth("");
                }}>
                <option value="">Выберите станцию...</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.stationName || "Без названия"}
                  </option>
                ))}
              </select>
            </div>

            {/* Выбор месяца */}
            {selectedStation && (
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Выберите месяц
                </label>
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}>
                  <option value="">Выберите месяц...</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {new Date(m + "-01").toLocaleDateString("ru-RU", {
                        year: "numeric",
                        month: "long",
                      })}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Кнопки действий */}
            <div className="flex gap-3 lg:ml-auto">
              <button
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                onClick={() => setShowAddModal(true)}
                disabled={!selectedStation}>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Новый отчёт
              </button>

              <button
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                onClick={exportToExcel}
                disabled={!reports.length}>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Экспорт в Excel
              </button>
            </div>
          </div>
        </div>

        {/* Статус загрузки */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Таблица отчетов */}
        {!loading && selectedStation && selectedMonth && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {reports.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Дата
                      </th>
                      {reports[0]?.hoses?.map((hose) => (
                        <React.Fragment key={hose.hose}>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                            {hose.hose} (показание)
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                            {hose.hose} (цена)
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                            {hose.hose} (расход)
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                            {hose.hose} (сумма)
                          </th>
                        </React.Fragment>
                      ))}
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Итого м³
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Итого ₽
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reports.map((report) => (
                      <tr
                        key={report.id}
                        className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {new Date(report.date).toLocaleDateString("ru-RU")}
                        </td>
                        {report.hoses?.map((hose, index) => (
                          <React.Fragment key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {hose.current.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {hose.price?.toLocaleString("ru-RU", {
                                minimumFractionDigits: 2,
                              })}{" "}
                              ₽
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
                              +{hose.diff.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-semibold">
                              {hose.sum?.toLocaleString("ru-RU", {
                                minimumFractionDigits: 2,
                              })}{" "}
                              ₽
                            </td>
                          </React.Fragment>
                        ))}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                          {report.totalgas.toLocaleString()} м³
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                          {report.totalsum?.toLocaleString("ru-RU", {
                            minimumFractionDigits: 2,
                          })}{" "}
                          ₽
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Отчетов не найдено
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  За выбранный месяц отчетов по станции "
                  {selectedStation.stationName}" нет.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Сообщение о выборе параметров */}
        {!selectedStation && (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md mx-auto">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Выберите станцию
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Для просмотра отчетов выберите станцию из списка выше.
              </p>
            </div>
          </div>
        )}

        {selectedStation && !selectedMonth && (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md mx-auto">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Выберите месяц
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Выберите месяц для просмотра отчетов по станции "
                {selectedStation.stationName}".
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Модальное окно добавления */}
      {showAddModal && (
        <AddHoseReportModal
          station={selectedStation}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            // Обновляем данные
            setSelectedMonth(selectedMonth);
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
};

export default DailyHoseReport;
