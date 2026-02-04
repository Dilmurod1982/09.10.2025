import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { calculateStartBalance } from "../../utils/calculations";

const StationDetailsModal = ({
  open,
  onClose,
  stationData,
  stations,
  settlementsData,
}) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [tableData, setTableData] = useState([]);

  // Получаем основные данные станции
  const mainStationData = stationData?.station || {};
  const stationId = mainStationData.id;

  // Форматирование чисел
  const formatNumber = (num) => {
    return new Intl.NumberFormat("ru-RU").format(num || 0);
  };

  const formatCurrency = (num) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "UZS",
      minimumFractionDigits: 0,
    }).format(num || 0);
  };

  // Рассчитываем данные для таблицы
  useEffect(() => {
    if (!open || !settlementsData || !stationId) return;

    const filteredData = settlementsData.filter(
      (item) =>
        item.stationId &&
        item.stationId.toString() === stationId.toString() &&
        item.period &&
        item.period.startsWith(selectedYear.toString()),
    );

    // Группируем по месяцам
    const monthlyData = {};

    filteredData.forEach((item) => {
      if (!item.period) return;

      const month = parseInt(item.period.split("-")[1]);
      monthlyData[month] = item;
    });

    // Создаем массив для всех месяцев выбранного года
    const result = [];

    for (let month = 1; month <= 12; month++) {
      const periodData = monthlyData[month];

      // Рассчитываем стартовый баланс для начала месяца
      const startOfMonth = new Date(selectedYear, month - 1, 1);
      const startBalance = calculateStartBalance(
        [mainStationData],
        settlementsData,
        startOfMonth,
        stationId.toString(),
      );

      if (periodData) {
        // Если есть данные за этот месяц
        const endBalance =
          startBalance +
          (periodData.amountOfGas || 0) -
          (periodData.payment || 0);

        result.push({
          month,
          monthName: new Date(selectedYear, month - 1).toLocaleString("ru", {
            month: "long",
          }),
          startBalance,
          limit: periodData.limit || 0,
          totalGas: periodData.totalGas || 0,
          gasAct: periodData.gasAct || 0,
          amountOfGas: periodData.amountOfGas || 0,
          payment: periodData.payment || 0,
          endBalance,
        });
      } else {
        // Если данных нет
        result.push({
          month,
          monthName: new Date(selectedYear, month - 1).toLocaleString("ru", {
            month: "long",
          }),
          startBalance,
          limit: 0,
          totalGas: 0,
          gasAct: 0,
          amountOfGas: 0,
          payment: 0,
          endBalance: startBalance,
        });
      }
    }

    setTableData(result);
  }, [open, selectedYear, settlementsData, mainStationData, stationId]);

  if (!open || !stationData) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-xl w-11/12 max-w-7xl max-h-[90vh] overflow-hidden"
        >
          {/* Заголовок */}
          <div className="flex justify-between items-center p-6 border-b">
            <h3 className="text-xl font-semibold text-gray-800">
              Детальная информация по станции
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
            {/* Блок с информацией о станции */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 p-6 bg-blue-50 rounded-xl">
              <div className="space-y-1">
                <p className="text-sm text-gray-500">Название станции</p>
                <p className="font-semibold text-lg">
                  {mainStationData.name || "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-gray-500">Ориентир</p>
                <p className="font-semibold">
                  {mainStationData.landmark || "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-gray-500">Область</p>
                <p className="font-semibold">{mainStationData.region || "—"}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-gray-500">Адрес</p>
                <p className="font-semibold">
                  {mainStationData.address || "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-gray-500">Название банка</p>
                <p className="font-semibold">{mainStationData.bank || "—"}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-gray-500">Расчетный счет</p>
                <p className="font-mono font-semibold">
                  {mainStationData.account || "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-gray-500">МФО</p>
                <p className="font-mono font-semibold">
                  {mainStationData.mfo || "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-gray-500">ИНН</p>
                <p className="font-mono font-semibold">
                  {mainStationData.inn || "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-gray-500">ID станции</p>
                <p className="font-mono font-semibold text-blue-600">
                  {mainStationData.id || "—"}
                </p>
              </div>
            </div>

            {/* Выбор года */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Выберите год для отчета
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-48 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {[2023, 2024, 2025, 2026].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Таблица с данными */}
            <div className="overflow-x-auto bg-white rounded-xl shadow border">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="p-4 text-left font-semibold text-gray-700 border-b">
                      Год
                    </th>
                    <th className="p-4 text-left font-semibold text-gray-700 border-b">
                      Месяц
                    </th>
                    <th className="p-4 text-left font-semibold text-gray-700 border-b">
                      Сальдо на начало периода сум
                    </th>
                    <th className="p-4 text-left font-semibold text-gray-700 border-b">
                      Лимит м³
                    </th>
                    <th className="p-4 text-left font-semibold text-gray-700 border-b">
                      Потреблено м³
                    </th>
                    <th className="p-4 text-left font-semibold text-gray-700 border-b">
                      в.т.ч по акту м³
                    </th>
                    <th className="p-4 text-left font-semibold text-gray-700 border-b">
                      Начислено сум
                    </th>
                    <th className="p-4 text-left font-semibold text-gray-700 border-b">
                      Оплачено сум
                    </th>
                    <th className="p-4 text-left font-semibold text-gray-700 border-b">
                      Сальдо на конец месяца сум
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, index) => (
                    <tr
                      key={row.month}
                      className={`border-t ${index % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
                    >
                      <td className="p-4 font-medium">{selectedYear}</td>
                      <td className="p-4 font-medium">
                        {row.monthName.charAt(0).toUpperCase() +
                          row.monthName.slice(1)}
                      </td>
                      <td className="p-4 font-mono">
                        {formatCurrency(row.startBalance)}
                      </td>
                      <td className="p-4 font-mono">
                        {formatNumber(row.limit)}
                      </td>
                      <td className="p-4 font-mono">
                        {formatNumber(row.totalGas)}
                      </td>
                      <td className="p-4 font-mono">
                        {formatNumber(row.gasAct)}
                      </td>
                      <td className="p-4 font-mono text-blue-600 font-semibold">
                        {formatCurrency(row.amountOfGas)}
                      </td>
                      <td className="p-4 font-mono text-green-600 font-semibold">
                        {formatCurrency(row.payment)}
                      </td>
                      <td
                        className={`p-4 font-mono font-bold ${
                          row.endBalance >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {formatCurrency(row.endBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Сводная информация */}
            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">
                    Сумма начислений за {selectedYear} год:
                  </p>
                  <p className="font-bold text-lg text-blue-600">
                    {formatCurrency(
                      tableData.reduce((sum, row) => sum + row.amountOfGas, 0),
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">
                    Сумма оплат за {selectedYear} год:
                  </p>
                  <p className="font-bold text-lg text-green-600">
                    {formatCurrency(
                      tableData.reduce((sum, row) => sum + row.payment, 0),
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Итоговое сальдо:</p>
                  <p
                    className={`font-bold text-lg ${
                      tableData[tableData.length - 1]?.endBalance >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {formatCurrency(
                      tableData[tableData.length - 1]?.endBalance || 0,
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default StationDetailsModal;
