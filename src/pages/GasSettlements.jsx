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
  const { stations, settlementsData, loading, reloadStations } =
    useGasSettlements();

  // Получаем пользователя из localStorage
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

  // Получаем данные пользователя при загрузке
  useEffect(() => {
    try {
      const userStr = localStorage.getItem("userData");
      if (userStr) {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
      }
    } catch (error) {
      // console.error("Error parsing user data:", error);
    }
  }, []);

  // Функция экспорта в Excel
  const exportToExcel = async (data, filters, stations) => {
    try {
      setExporting(true);

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
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const wsData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      wsData.push([]);
      filterInfo.forEach((row) => wsData.push(row));
      const newWorksheet = XLSX.utils.aoa_to_sheet(wsData);

      XLSX.utils.book_append_sheet(workbook, newWorksheet, "Учет газа");
      const fileName = `gas_settlements_${filters.year}-${filters.month.toString().padStart(2, "0")}_${new Date().getTime()}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      return true;
    } catch (error) {
      // console.error("Экспортда хатолик:", error);
      throw error;
    } finally {
      setExporting(false);
    }
  };

  // ОСНОВНОЙ ЭФФЕКТ - ИСПРАВЛЕННЫЙ
  useEffect(() => {
    calculateTableData();
  }, [filters, stations, settlementsData]);

  const calculateTableData = () => {
    // console.log("=== CALCULATING TABLE DATA ===");
    // console.log("Stations count:", stations.length);
    // console.log("Settlements data count:", settlementsData.length);

    // Форматируем выбранный период
    const selectedPeriod = `${filters.year}-${filters.month.toString().padStart(2, "0")}`;
    // console.log("Selected period:", selectedPeriod);

    // Фильтруем settlements данные по выбранному периоду
    const periodData = settlementsData.filter((item) => {
      if (!item.period) return false;
      return item.period === selectedPeriod;
    });

    // console.log("Period data count:", periodData.length);

    // Создаем Map для быстрого доступа к данным по stationId
    const dataByStation = {};
    periodData.forEach((item) => {
      const stationId = item.stationId.toString();
      dataByStation[stationId] = item;
    });

    // console.log(
    //   "Stations with data in this period:",
    //   Object.keys(dataByStation),
    // );

    // Определяем, какие станции показывать
    let stationsToShow = [];

    if (filters.stationId !== "all") {
      // Показываем только выбранную станцию
      const selectedStation = stations.find(
        (s) => s.id.toString() === filters.stationId.toString(),
      );
      if (selectedStation) {
        stationsToShow = [selectedStation];
      }
    } else {
      // Показываем ВСЕ станции
      stationsToShow = [...stations];
    }

    // console.log("Stations to show:", stationsToShow.length);
    // console.log(
    //   "Station IDs to show:",
    //   stationsToShow.map((s) => s.id),
    // );

    const calculatedData = [];

    // Проходим по всем станциям, которые нужно показать
    stationsToShow.forEach((station) => {
      const stationId = station.id.toString();

      // Получаем данные для этой станции за выбранный период (если есть)
      const dataItem = dataByStation[stationId];

      const selectedDate = new Date(filters.year, filters.month - 1, 1);

      // Рассчитываем стартовый баланс
      const startBalance = calculateStartBalance(
        [station],
        settlementsData,
        selectedDate,
        stationId,
      );

      // Если есть данные за период - используем их, иначе нули
      const limit = dataItem?.limit || 0;
      const amountOfLimit = dataItem?.amountOfLimit || 0;
      const totalGas = dataItem?.totalGas || 0;
      const gasByMeter = dataItem?.gasByMeter || 0;
      const confError = dataItem?.confError || 0;
      const lowPress = dataItem?.lowPress || 0;
      const gasAct = dataItem?.gasAct || 0;
      const amountOfGas = dataItem?.amountOfGas || 0;
      const payment = dataItem?.payment || 0;

      // Рассчитываем конечный баланс
      const endBalance = calculateEndBalance(
        startBalance,
        amountOfGas,
        amountOfLimit,
        payment,
      );

      calculatedData.push({
        id: parseInt(stationId),
        stationId: station.id,
        stationName: station.name || "Неизвестно",
        landmark: station.landmark || "Немаълум",
        startBalance,
        limit,
        amountOfLimit,
        totalGas,
        gasByMeter,
        confError,
        lowPress,
        gasAct,
        amountOfGas,
        payment,
        endBalance,
        hasData: !!dataItem, // Флаг, есть ли данные
      });
    });

    // Сортируем по ID станции
    calculatedData.sort((a, b) => {
      const idA = parseInt(a.id) || 0;
      const idB = parseInt(b.id) || 0;
      if (idA === idB) {
        return a.stationName.localeCompare(b.stationName);
      }
      return idA - idB;
    });

    // Обновляем индексы для отображения
    calculatedData.forEach((item, idx) => {
      item.displayId = idx + 1;
    });

    // console.log("Final table data count:", calculatedData.length);
    // console.log(
    //   "Station IDs in table:",
    //   calculatedData.map((d) => d.id),
    // );
    // console.log(
    //   "Stations WITHOUT data:",
    //   calculatedData
    //     .filter((d) => !d.hasData)
    //     .map((d) => ({ id: d.id, name: d.stationName })),
    // );

    setTableData(calculatedData);
  };

  const handleRowClick = (row) => {
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
    }
  };

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleExportExcel = async () => {
    if (tableData.length === 0) {
      alert("Экспорт учун маълумот йўқ!");
      return;
    }

    try {
      await exportToExcel(tableData, filters, stations);
    } catch (error) {
      // console.error("Ошибка при экспорте:", error);
      alert("Excel га экспортда хатолик: " + error.message);
    }
  };

  const handleStationAdded = async () => {
    // console.log("Station added, reloading stations...");
    await reloadStations();
  };

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
              {[2024, 2025, 2026, 2027].map((year) => (
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

      {/* Модальное окно добавления заправки */}
      <AnimatePresence>
        {openModal && isAdmin && (
          <AddNewDataGasStation
            open={openModal}
            onClose={() => setOpenModal(false)}
            onStationAdded={handleStationAdded}
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
