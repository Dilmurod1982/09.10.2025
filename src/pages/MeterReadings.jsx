import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import AddMeterResetModal from "../components/AddMeterResetModal";
import { useAppStore } from "../lib/zustand";
import * as XLSX from "xlsx";

const MeterReadings = () => {
  const [resetEvents, setResetEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [stations, setStations] = useState([]);
  const [filters, setFilters] = useState({
    stationId: "",
    year: "",
    month: "",
    date: "",
  });

  const userData = useAppStore((state) => state.userData);
  const role = userData?.role;
  const isAdmin = role === "electrengineer";

  useEffect(() => {
    const loadStations = async () => {
      try {
        const stationsSnapshot = await getDocs(collection(db, "stations"));
        const stationsData = stationsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setStations(stationsData);
      } catch (error) {
        console.error("Ошибка загрузки станций:", error);
      }
    };

    loadStations();
  }, []);

  const loadResetEvents = async () => {
    try {
      setLoading(true);
      let q = query(
        collection(db, "meterResetEvents"),
        orderBy("resetDate", "desc")
      );

      if (filters.stationId) {
        q = query(q, where("stationId", "==", filters.stationId));
      }

      if (filters.year) {
        const startDate = `${filters.year}-01-01`;
        const endDate = `${filters.year}-12-31`;
        q = query(
          q,
          where("resetDate", ">=", startDate),
          where("resetDate", "<=", endDate)
        );
      }

      if (filters.month && filters.year) {
        const startDate = `${filters.year}-${filters.month.padStart(
          2,
          "0"
        )}-01`;
        const endDate = `${filters.year}-${filters.month.padStart(2, "0")}-31`;
        q = query(
          q,
          where("resetDate", ">=", startDate),
          where("resetDate", "<=", endDate)
        );
      }

      if (filters.date) {
        q = query(q, where("resetDate", "==", filters.date));
      }

      const snapshot = await getDocs(q);
      const eventsData = snapshot.docs.map((doc, index) => ({
        id: doc.id,
        number: index + 1,
        ...doc.data(),
      }));

      setResetEvents(eventsData);
    } catch (error) {
      console.error("Ошибка загрузки событий обнуления:", error);
      toast.error("Маълумотларни юклашда хато");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResetEvents();
  }, [filters]);

  const handleDelete = async (id) => {
    if (!isAdmin) {
      toast.error("Сизда ўчириш учун рухсат йўқ");
      return;
    }

    if (!window.confirm("Сиз ростдан хам бу ўлчов нольлашни ўчирмоқчимисиз?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "meterResetEvents", id));
      toast.success("Улчов нольлаш ўчирилди");
      loadResetEvents();
    } catch (error) {
      console.error("Удаление ошибка:", error);
      toast.error("Ўчиришда хатолик");
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "year" && { month: "", date: "" }),
      ...(field === "month" && { date: "" }),
    }));
  };

  const clearFilters = () => {
    setFilters({
      stationId: "",
      year: "",
      month: "",
      date: "",
    });
  };

  const exportToExcel = () => {
    if (resetEvents.length === 0) {
      toast.error("Экспорт қилиш учун маълумот йўқ");
      return;
    }

    try {
      const excelData = resetEvents.map((event, index) => ({
        "№": index + 1,
        "Нолланган сана": event.resetDate,
        "Заправка номи": event.stationName,
        "Шланг раками": event.hose,
        "Хисоботдаги курсаткич":
          event.lastReadingFromReport?.toLocaleString() || "Маълумот йўқ",
        "Ноллашдан олдинги курсаткич":
          event.lastReadingBeforeReset.toLocaleString(),
        "Ноллангандан кейинги курсаткич":
          event.newReadingAfterReset.toLocaleString(),
        Фарқ: event.lastReadingBeforeReset - (event.lastReadingFromReport || 0),
        Изоҳ: event.note || "",
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      const colWidths = [
        { wch: 5 },
        { wch: 12 },
        { wch: 25 },
        { wch: 10 },
        { wch: 18 },
        { wch: 22 },
        { wch: 20 },
        { wch: 10 },
        { wch: 25 },
      ];
      ws["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, "Улчовлар нольлаш");

      const date = new Date().toISOString().split("T")[0];
      const fileName = `Улчовлар_нольлаш_${date}.xlsx`;

      XLSX.writeFile(wb, fileName);
      toast.success("Excelга муваффақиятли экспорт қилинди");
    } catch (error) {
      console.error("Excelга экспорт хатолик:", error);
      toast.error("Маълумотларни экспорт қилишда хатолик");
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
  const months = [
    { value: "01", label: "Январь" },
    { value: "02", label: "Февраль" },
    { value: "03", label: "Март" },
    { value: "04", label: "Апрель" },
    { value: "05", label: "Май" },
    { value: "06", label: "Июнь" },
    { value: "07", label: "Июль" },
    { value: "08", label: "Август" },
    { value: "09", label: "Сентябрь" },
    { value: "10", label: "Октябрь" },
    { value: "11", label: "Ноябрь" },
    { value: "12", label: "Декабрь" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Колонка курсаткичларини ноллаш
          </h1>
          <p className="text-gray-600 mt-2">
            Шланг ўлчов кўрсаткичларини ноллашларни ҳисоби
          </p>
        </div>

        {/* Фильтры и кнопки - улучшенная версия */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Фильтры */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Станция */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Заправка номи
                </label>
                <select
                  value={filters.stationId}
                  onChange={(e) =>
                    handleFilterChange("stationId", e.target.value)
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">Барча заправкалар</option>
                  {stations.map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.stationName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Год */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Йил
                </label>
                <select
                  value={filters.year}
                  onChange={(e) => handleFilterChange("year", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">Барча йил</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              {/* Месяц */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ой
                </label>
                <select
                  value={filters.month}
                  onChange={(e) => handleFilterChange("month", e.target.value)}
                  disabled={!filters.year}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100"
                >
                  <option value="">Барча ой</option>
                  {months.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Дата */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Сана
                </label>
                <input
                  type="date"
                  value={filters.date}
                  onChange={(e) => handleFilterChange("date", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Кнопки - вертикальное расположение на мобильных */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:w-48">
              <button
                onClick={clearFilters}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 text-sm font-medium"
              >
                Фильтрларни тозалаш
              </button>

              <button
                onClick={exportToExcel}
                disabled={resetEvents.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M5.884 6.68a.5.5 0 0 0-.772.63L8 11.154l2.888-3.844a.5.5 0 0 0-.772-.63L8 9.846l-2.116-2.166z" />
                  <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z" />
                </svg>
                Excelга юклаб олиш
              </button>

              {isAdmin && (
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                  </svg>
                  Ноллашни қўшиш
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Информация о количестве записей */}
        <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="text-sm text-gray-600">
            Топилган ёзувлар:{" "}
            <span className="font-semibold">{resetEvents.length}</span>
          </div>
          <div className="text-xs text-gray-500">
            Ўлчовлар санаси: {resetEvents.length}
          </div>
        </div>

        {/* Таблица */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      №
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Сана
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Заправка номи
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Шланг
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Хисоботдаги курсаткич
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ноллашдан олдинги курсаткич
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ноллангандан кейинги курсаткич
                    </th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ҳаракатлар
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {resetEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {event.number}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {event.resetDate}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {event.stationName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {event.hose}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {event.lastReadingFromReport?.toLocaleString() ||
                          "Маълумот йўқ"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {event.lastReadingBeforeReset.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {event.newReadingAfterReset.toLocaleString()}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleDelete(event.id)}
                            className="text-red-600 hover:text-red-900 transition-colors duration-200"
                          >
                            Ўчириш
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {resetEvents.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-gray-500">
                    Кўрсатиш учун маълумотлар йўқ
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <AddMeterResetModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSaved={loadResetEvents}
          stations={stations}
        />
      )}
    </div>
  );
};

export default MeterReadings;
