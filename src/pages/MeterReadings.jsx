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
import { useAppStore } from "../lib/zustand"; // Импортируем хранилище
import * as XLSX from "xlsx"; // Импортируем библиотеку для Excel

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

  // Получаем данные пользователя из хранилища
  const userData = useAppStore((state) => state.userData);
  const role = userData?.role;
  const isAdmin = role === "electrengineer";

  // Загрузка станций
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

  // Загрузка событий обнуления
  const loadResetEvents = async () => {
    try {
      setLoading(true);
      let q = query(
        collection(db, "meterResetEvents"),
        orderBy("resetDate", "desc")
      );

      // Применяем фильтры
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
      toast.error("Ошибка при загрузке данных");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResetEvents();
  }, [filters]);

  const handleDelete = async (id) => {
    // Проверяем права доступа
    if (!isAdmin) {
      toast.error("У вас нет прав для удаления");
      return;
    }

    if (
      !window.confirm("Вы уверены, что хотите удалить это событие обнуления?")
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, "meterResetEvents", id));
      toast.success("Событие обнуления удалено");
      loadResetEvents();
    } catch (error) {
      console.error("Ошибка удаления:", error);
      toast.error("Ошибка при удалении");
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
      // Сбрасываем зависимые фильтры
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

  // Функция для экспорта в Excel
  const exportToExcel = () => {
    if (resetEvents.length === 0) {
      toast.error("Нет данных для экспорта");
      return;
    }

    try {
      // Подготавливаем данные для экспорта
      const excelData = resetEvents.map((event, index) => ({
        "№": index + 1,
        "Дата обнуления": event.resetDate,
        Станция: event.stationName,
        Шланг: event.hose,
        "Показание с отчета": event.lastReadingFromReport || "Нет данных",
        "Показание перед обнулением": event.lastReadingBeforeReset,
        "Новое показание": event.newReadingAfterReset,
        Разница:
          event.lastReadingBeforeReset - (event.lastReadingFromReport || 0),
        Примечание: event.note || "",
      }));

      // Создаем новую книгу
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Настраиваем ширину колонок
      const colWidths = [
        { wch: 5 }, // №
        { wch: 12 }, // Дата обнуления
        { wch: 20 }, // Станция
        { wch: 8 }, // Шланг
        { wch: 18 }, // Показание с отчета
        { wch: 22 }, // Показание перед обнулением
        { wch: 15 }, // Новое показание
        { wch: 10 }, // Разница
        { wch: 25 }, // Примечание
      ];
      ws["!cols"] = colWidths;

      // Добавляем лист в книгу
      XLSX.utils.book_append_sheet(wb, ws, "Обнуления счетчиков");

      // Генерируем имя файла с текущей датой
      const date = new Date().toISOString().split("T")[0];
      const fileName = `Обнуления_счетчиков_${date}.xlsx`;

      // Сохраняем файл
      XLSX.writeFile(wb, fileName);
      toast.success("Данные успешно экспортированы в Excel");
    } catch (error) {
      console.error("Ошибка при экспорте в Excel:", error);
      toast.error("Ошибка при экспорте данных");
    }
  };

  // Генерация годов и месяцев для фильтров
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Обнуления счетчиков
          </h1>
          <p className="text-gray-600 mt-2">
            Учет обнулений показаний счетчиков шлангов
          </p>

          {/* <div className="mt-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Роль: {role}
            </span>
          </div> */}
        </div>

        {/* Фильтры */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Станция */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Станция
              </label>
              <select
                value={filters.stationId}
                onChange={(e) =>
                  handleFilterChange("stationId", e.target.value)
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="">Все станции</option>
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
                Год
              </label>
              <select
                value={filters.year}
                onChange={(e) => handleFilterChange("year", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="">Все годы</option>
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
                Месяц
              </label>
              <select
                value={filters.month}
                onChange={(e) => handleFilterChange("month", e.target.value)}
                disabled={!filters.year}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100">
                <option value="">Все месяцы</option>
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
                Конкретная дата
              </label>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => handleFilterChange("date", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Кнопки */}
            <div className="flex items-end space-x-2">
              <button
                onClick={clearFilters}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                Сбросить
              </button>

              {/* Кнопка Excel */}
              <button
                onClick={exportToExcel}
                disabled={resetEvents.length === 0}
                className="px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="currentColor"
                  viewBox="0 0 16 16">
                  <path d="M5.884 6.68a.5.5 0 0 0-.772.63L8 11.154l2.888-3.844a.5.5 0 0 0-.772-.63L8 9.846l-2.116-2.166z" />
                  <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z" />
                </svg>
                Excel
              </button>

              {/* Кнопка добавления - только для admin */}
              {isAdmin && (
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
                  + Добавить обнуление
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Информация о количестве записей */}
        <div className="mb-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Найдено записей:{" "}
            <span className="font-semibold">{resetEvents.length}</span>
          </div>
          {/* {resetEvents.length > 0 && (
            <button
              onClick={exportToExcel}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center">
              <svg
                className="w-4 h-4 mr-1"
                fill="currentColor"
                viewBox="0 0 16 16">
                <path d="M5.884 6.68a.5.5 0 0 0-.772.63L8 11.154l2.888-3.844a.5.5 0 0 0-.772-.63L8 9.846l-2.116-2.166z" />
                <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z" />
              </svg>
              Скачать Excel
            </button>
          )} */}
        </div>

        {/* Таблица */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      №
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Дата
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Станция
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Шланг
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Показание с отчета
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Показание перед обнулением
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Новое показание
                    </th>

                    {/* Столбец действий показываем только для admin */}
                    {isAdmin && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Действия
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {resetEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {event.number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {event.resetDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {event.stationName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {event.hose}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {event.lastReadingFromReport?.toLocaleString() ||
                          "Нет данных"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {event.lastReadingBeforeReset.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {event.newReadingAfterReset.toLocaleString()}
                      </td>

                      {/* Кнопка удаления - только для admin */}
                      {isAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleDelete(event.id)}
                            className="text-red-600 hover:text-red-900 transition-colors duration-200">
                            Удалить
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
                    Нет данных для отображения
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно добавления - только для admin */}
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
