import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useGasSettlements } from "../hooks/useGasSettlements";
import {
  calculateStartBalance,
  calculateEndBalance,
} from "../utils/calculations";
import GasSettlementsTable from "../components/GasSettlements/GasSettlementsTable";
import AddNewDataGasStation from "../components/GasSettlements/AddNewDataGasStation";
import StationDetailsModal from "../components/GasSettlements/StationDetailsModal";

const GasSettlements = () => {
  const navigate = useNavigate();
  const { stations, settlementsData, loading } = useGasSettlements();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [filters, setFilters] = useState({
    year: currentYear,
    month: currentMonth,
    stationId: "all",
  });

  const [openModal, setOpenModal] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  const [stationDetailsModal, setStationDetailsModal] = useState(false);
  const [tableData, setTableData] = useState([]);

  // Для отладки
  useEffect(() => {
    console.log("=== GAS SETTLEMENTS DEBUG ===");
    console.log("Filters:", filters);
    console.log("Stations count:", stations.length);
    console.log("Settlements data count:", settlementsData.length);
    console.log("Loading:", loading);

    if (settlementsData.length > 0) {
      console.log("Sample settlements data:", settlementsData[0]);
      console.log("Sample period:", settlementsData[0]?.period);
    }
  }, [filters, stations, settlementsData, loading]);

  // Основной эффект для расчета данных
  useEffect(() => {
    if (stations.length > 0 && settlementsData.length > 0) {
      calculateTableData();
    } else {
      setTableData([]);
    }
  }, [filters, stations, settlementsData]);

  const calculateTableData = () => {
    console.log("Calculating table data...");

    // Форматируем выбранный период
    const selectedPeriod = `${filters.year}-${filters.month.toString().padStart(2, "0")}`;
    console.log("Selected period for filtering:", selectedPeriod);

    // Фильтруем данные
    const filteredData = settlementsData.filter((item) => {
      if (!item.period) {
        console.log("Item has no period:", item);
        return false;
      }

      console.log(
        `Checking item: period=${item.period}, stationId=${item.stationId}`,
      );

      // Проверяем период
      const periodMatches = item.period === selectedPeriod;

      // Проверяем станцию
      const stationMatches =
        filters.stationId === "all" ||
        item.stationId.toString() === filters.stationId.toString();

      console.log(
        `Matches: period=${periodMatches}, station=${stationMatches}`,
      );

      return periodMatches && stationMatches;
    });

    console.log("Filtered data count:", filteredData.length);
    console.log("Filtered data:", filteredData);

    if (filteredData.length === 0) {
      setTableData([]);
      return;
    }

    // Создаем карту для группировки данных по станциям
    const stationsMap = {};

    // Если выбрана конкретная станция
    if (filters.stationId !== "all") {
      const stationId = filters.stationId.toString();
      const station = stations.find((s) => s.id.toString() === stationId);

      if (station) {
        const stationData = filteredData.filter(
          (item) => item.stationId.toString() === stationId,
        );

        stationsMap[stationId] = {
          station,
          data: stationData,
        };
      }
    } else {
      // Для всех станций
      filteredData.forEach((dataItem) => {
        const stationId = dataItem.stationId.toString();

        if (!stationsMap[stationId]) {
          const station = stations.find((s) => s.id.toString() === stationId);
          stationsMap[stationId] = {
            station,
            data: [],
          };
        }

        stationsMap[stationId].data.push(dataItem);
      });
    }

    console.log("Stations map:", stationsMap);

    const calculatedData = [];
    let index = 1;

    // Проходим по всем станциям в карте
    Object.keys(stationsMap).forEach((stationId) => {
      const { station, data } = stationsMap[stationId];

      if (!station) return;

      // Для каждой записи данных этой станции
      data.forEach((dataItem) => {
        const selectedDate = new Date(filters.year, filters.month - 1, 1);

        // Рассчитываем стартовый баланс
        const startBalance = calculateStartBalance(
          [station],
          settlementsData,
          selectedDate,
          stationId,
        );

        // Рассчитываем конечный баланс
        const endBalance = calculateEndBalance(
          startBalance,
          dataItem.amountOfGas || 0,
          dataItem.amountOfLimit || 0,
          dataItem.payment || 0,
        );

        calculatedData.push({
          id: index++,
          stationName: station.name || "Неизвестно",
          stationId: station.id, // Добавляем ID станции
          startBalance,
          limit: dataItem.limit || 0,
          amountOfLimit: dataItem.amountOfLimit || 0,
          totalGas: dataItem.totalGas || 0,
          gasByMeter: dataItem.gasByMeter || 0,
          confError: dataItem.confError || 0,
          lowPress: dataItem.lowPress || 0,
          gasAct: dataItem.gasAct || 0,
          amountOfGas: dataItem.amountOfGas || 0,
          payment: dataItem.payment || 0,
          endBalance,
        });
      });
    });

    // Сортируем по имени станции
    calculatedData.sort((a, b) => a.stationName.localeCompare(b.stationName));

    // Обновляем индексы
    calculatedData.forEach((item, idx) => {
      item.id = idx + 1;
    });

    console.log("Calculated table data:", calculatedData);
    setTableData(calculatedData);
  };

  // Обработчик клика по строке таблицы
  const handleRowClick = (row) => {
    console.log("Row clicked:", row);

    // Находим полные данные станции
    const station = stations.find(
      (s) =>
        s.name === row.stationName ||
        s.id.toString() === row.stationId?.toString(),
    );

    if (station) {
      setSelectedStation({
        station,
        rowData: row,
      });
      setStationDetailsModal(true);
    } else {
      console.warn("Station not found for row:", row);
    }
  };

  const handleFilterChange = (name, value) => {
    console.log(`Filter change: ${name} = ${value}`);
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleExportExcel = () => {
    // Реализация экспорта в Excel
    console.log("Export to Excel:", tableData);
    alert("Экспорт в Excel (реализуйте эту функцию)");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-semibold text-gray-800">
          Учет с газоснабжающей организацией
        </h2>
        <motion.button
          onClick={() => navigate("/gas-settlements/list")}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl shadow-md hover:bg-blue-700 transition-colors"
        >
          📋 Список введенных данных
        </motion.button>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Год
            </label>
            <select
              value={filters.year}
              onChange={(e) => handleFilterChange("year", e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {[2023, 2024, 2025, 2026].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Месяц
            </label>
            <select
              value={filters.month}
              onChange={(e) => handleFilterChange("month", e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {new Date(2023, month - 1).toLocaleString("ru", {
                    month: "long",
                  })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Заправка
            </label>
            <select
              value={filters.stationId}
              onChange={(e) => handleFilterChange("stationId", e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Все заправки</option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleExportExcel}
              className="w-full bg-green-600 text-white px-4 py-3 rounded-xl shadow-md hover:bg-green-700 transition-colors"
            >
              📊 Excel
            </motion.button>
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setOpenModal(true)}
            className="bg-blue-600 text-white px-4 py-3 rounded-xl shadow-md hover:bg-blue-700 transition-colors"
          >
            ⛽ Добавить Заправку
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/price-of-gas")}
            className="bg-purple-600 text-white px-4 py-3 rounded-xl shadow-md hover:bg-purple-700 transition-colors"
          >
            💰 Цены на газ
          </motion.button>

          <div className="text-right text-sm text-gray-500 mt-2">
            <p>Всего заправок: {stations.length}</p>
            <p>Данных за период: {tableData.length}</p>
            <p className="text-xs text-gray-400">
              Период: {filters.year}-{filters.month.toString().padStart(2, "0")}
            </p>
          </div>
        </div>
      </div>

      {/* Таблица */}
      <GasSettlementsTable data={tableData} onRowClick={handleRowClick} />

      {/* Модальное окно добавления заправки */}
      <AnimatePresence>
        {openModal && (
          <AddNewDataGasStation
            open={openModal}
            onClose={() => setOpenModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Модальное окно деталей станции */}
      <AnimatePresence>
        {stationDetailsModal && (
          <StationDetailsModal
            open={stationDetailsModal}
            onClose={() => setStationDetailsModal(false)}
            stationData={selectedStation}
            stations={stations}
            settlementsData={settlementsData}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default GasSettlements;
