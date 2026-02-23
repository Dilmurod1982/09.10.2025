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
import * as XLSX from "xlsx";

const GasSettlements = () => {
  const navigate = useNavigate();
  const { stations, settlementsData, loading } = useGasSettlements();

  // Получаем пользователя из localStorage или контекста
  const [currentUser, setCurrentUser] = useState(null);

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
  const [exporting, setExporting] = useState(false);
  // console.log(currentUser);
  // Получаем данные пользователя при загрузке
  useEffect(() => {
    try {
      const userStr = localStorage.getItem("userData");
      console.log(userStr);

      if (userStr) {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
      }
    } catch (error) {
      console.error("Error parsing user data:", error);
    }
  }, []);

  // Функция экспорта в Excel
  const exportToExcel = async (data, filters, stations) => {
    try {
      setExporting(true);

      // Создаем рабочую книгу
      const workbook = XLSX.utils.book_new();
      const filterInfo = [
        ["Маълумот:"],
        ["Йил:", filters.year],
        [
          "Ой:",
          new Date(2023, filters.month - 1).toLocaleString("ru", {
            month: "long",
          }),
        ],
        [
          "Заправка:",
          filters.stationId === "all"
            ? "Жами заправкалар"
            : stations.find(
                (s) => s.id.toString() === filters.stationId.toString(),
              )?.name || "Номаълум",
        ],
        ["Ёзувлар сони:", data.length],
        ["Экспорта санаси:", new Date().toLocaleString("ru-RU")],
      ];
      // Подготовка данных для экспорта
      const exportData = data.map((row, index) => ({
        "№": index + 1,
        "Заправка номи": row.stationName,
        Манзили: row.landmark,
        "Ой бошига сальдо": row.startBalance,
        "Лимит (м³)": row.limit,
        "Лимита суммаси (сўм)": row.amountOfLimit,
        "Жами газ (м³)": row.totalGas,
        "Пилот бўйича (м³)": row.gasByMeter,
        "Конф. хатоси (м³)": row.confError,
        "Низкий перепад (м³)": row.lowPress,
        "Акт бўйича (м³)": row.gasAct,
        "Газ суммаси (сўм)": row.amountOfGas,
        Оплачено: row.payment,
        "Ой охирига сальдо": row.endBalance,
      }));

      // Добавляем итоговую строку
      const totals = {
        "№": "ИТОГО",
        "Заправка номи": "",
        "Ой бошига сальдо": data.reduce(
          (sum, row) => sum + row.startBalance,
          0,
        ),
        "Лимит (м³)": data.reduce((sum, row) => sum + row.limit, 0),
        "Лимита суммаси (сўм)": data.reduce(
          (sum, row) => sum + row.amountOfLimit,
          0,
        ),
        "Жами газ (м³)": data.reduce((sum, row) => sum + row.totalGas, 0),
        "Пилот бўйича (м³)": data.reduce((sum, row) => sum + row.gasByMeter, 0),
        "Конф. хатоси (м³)": data.reduce((sum, row) => sum + row.confError, 0),
        "Низкий перепад (м³)": data.reduce((sum, row) => sum + row.lowPress, 0),
        "Акт бўйича (м³)": data.reduce((sum, row) => sum + row.gasAct, 0),
        "Газ суммаси (сўм)": data.reduce(
          (sum, row) => sum + row.amountOfGas,
          0,
        ),
        Оплачено: data.reduce((sum, row) => sum + row.payment, 0),
        "Ой охирига сальдо": data.reduce((sum, row) => sum + row.endBalance, 0),
      };

      exportData.push(totals);

      // Создаем лист
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Добавляем информацию о фильтрах

      // Добавляем информацию о фильтрах ниже данных
      const wsData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      wsData.push([]); // Пустая строка
      filterInfo.forEach((row) => wsData.push(row));

      // Обновляем лист с добавленной информацией
      XLSX.utils.sheet_add_json(worksheet, wsData, { skipHeader: true });

      // Добавляем лист в книгу
      XLSX.utils.book_append_sheet(workbook, worksheet, "Учет газа");

      // Генерируем имя файла
      const fileName = `gas_settlements_${filters.year}-${filters.month.toString().padStart(2, "0")}_${new Date().getTime()}.xlsx`;

      // Сохраняем файл
      XLSX.writeFile(workbook, fileName);

      return true;
    } catch (error) {
      console.error("Экспортда хатолик:", error);
      throw error;
    } finally {
      setExporting(false);
    }
  };

  // Для отладки
  useEffect(() => {
    // console.log("=== GAS SETTLEMENTS DEBUG ===");
    // console.log("Filters:", filters);
    // console.log("Stations count:", stations.length);
    // console.log("Settlements data count:", settlementsData.length);
    // console.log("Loading:", loading);

    if (settlementsData.length > 0) {
      // console.log("Sample settlements data:", settlementsData[0]);
      // console.log("Sample period:", settlementsData[0]?.period);
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
    // console.log("Calculating table data...");

    // Форматируем выбранный период
    const selectedPeriod = `${filters.year}-${filters.month.toString().padStart(2, "0")}`;
    // console.log("Selected period for filtering:", selectedPeriod);

    // Фильтруем данные
    const filteredData = settlementsData.filter((item) => {
      if (!item.period) {
        // console.log("Item has no period:", item);
        return false;
      }

      // console.log(
      //   `Checking item: period=${item.period}, stationId=${item.stationId}`,
      // );

      // Проверяем период
      const periodMatches = item.period === selectedPeriod;

      // Проверяем станцию
      const stationMatches =
        filters.stationId === "all" ||
        item.stationId.toString() === filters.stationId.toString();

      // console.log(
      //   `Matches: period=${periodMatches}, station=${stationMatches}`,
      // );

      return periodMatches && stationMatches;
    });

    // console.log("Filtered data count:", filteredData.length);
    // console.log("Filtered data:", filteredData);

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

    // console.log("Stations map:", stationsMap);

    const calculatedData = [];

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
          id: parseInt(stationId), // Используем ID станции как основной ID
          stationId: station.id,
          stationName: station.name || "Неизвестно",
          landmark: station.landmark || "Немаълум",
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

    // Сортируем по ID станции (числовое сравнение)
    calculatedData.sort((a, b) => {
      // Сначала пытаемся сортировать по числовому ID
      const idA = parseInt(a.id) || 0;
      const idB = parseInt(b.id) || 0;

      // Если ID одинаковые или оба равны 0, сортируем по имени
      if (idA === idB) {
        return a.stationName.localeCompare(b.stationName);
      }

      return idA - idB;
    });

    // Обновляем индексы для отображения (1, 2, 3...)
    calculatedData.forEach((item, idx) => {
      item.displayId = idx + 1; // Добавляем отдельное поле для отображения
    });

    // console.log("Calculated table data (sorted by ID):", calculatedData);
    setTableData(calculatedData);
  };

  // Обработчик клика по строке таблицы
  const handleRowClick = (row) => {
    // console.log("Row clicked:", row);

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
    // console.log(`Filter change: ${name} = ${value}`);
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Функция экспорта в Excel
  const handleExportExcel = async () => {
    if (tableData.length === 0) {
      alert("Экспорт учун маълумот йўқ!");
      return;
    }

    try {
      await exportToExcel(tableData, filters, stations);
      // alert(`Данные успешно экспортированы в Excel!`);
    } catch (error) {
      console.error("Ошибка при экспорте:", error);
      alert("Excel га экспортда хатолик: " + error.message);
    }
  };

  // Проверяем, является ли пользователь админом
  const isAdmin = currentUser?.role === "admin";

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
          Худудгаз билан ҳисоб-китоблар (Газ ҳисоботи)
        </h2>

        {/* Кнопка "Киритилган маълумотлар рўйхати" только для админа */}
        {isAdmin && (
          <motion.button
            onClick={() => navigate("/gas-settlements/list")}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl shadow-md hover:bg-blue-700 transition-colors"
          >
            📋 Киритилган маълумотлар рўйхати
          </motion.button>
        )}
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Йил
            </label>
            <select
              value={filters.year}
              onChange={(e) => handleFilterChange("year", e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {[2026].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ой
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
              <option value="all">Барча заправкалар</option>
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
              disabled={exporting || tableData.length === 0}
              className={`w-full px-4 py-3 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 ${
                exporting || tableData.length === 0
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700"
              } text-white`}
            >
              {exporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  <span>Экспорт...</span>
                </>
              ) : (
                <>
                  <span>📊</span>
                  <span>Excel</span>
                </>
              )}
            </motion.button>
          </div>
        </div>

        {/* Кнопки действий - только для админа */}
        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setOpenModal(true)}
              className="bg-blue-600 text-white px-4 py-3 rounded-xl shadow-md hover:bg-blue-700 transition-colors"
            >
              ⛽ Заправка қўшиш
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/price-of-gas")}
              className="bg-purple-600 text-white px-4 py-3 rounded-xl shadow-md hover:bg-purple-700 transition-colors"
            >
              💰 Газ нархлари
            </motion.button>

            <div className="text-right text-sm text-gray-500 mt-2">
              <p>Жами заправкалар: {stations.length}</p>
              <p>Давр учун маълумот: {tableData.length}</p>
              <p className="text-xs text-gray-400">
                Давр: {filters.year}-{filters.month.toString().padStart(2, "0")}
              </p>
            </div>
          </div>
        )}

        {/* Если пользователь не админ, показываем только информацию о количестве */}
        {!isAdmin && (
          <div className="pt-4 border-t">
            <div className="text-right text-sm text-gray-500">
              <p>Жами заправкалар: {stations.length}</p>
              <p>Давр учун маълумот: {tableData.length}</p>
              <p className="text-xs text-gray-400">
                Давр: {filters.year}-{filters.month.toString().padStart(2, "0")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Таблица */}
      <GasSettlementsTable
        data={tableData}
        onRowClick={handleRowClick}
        invertBalanceColors={true}
      />

      {/* Модальное окно добавления заправки - только для админа */}
      <AnimatePresence>
        {openModal && isAdmin && (
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
