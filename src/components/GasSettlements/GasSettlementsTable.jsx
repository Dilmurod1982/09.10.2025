import React from "react";
import { motion } from "framer-motion";

const GasSettlementsTable = ({
  data,
  onRowClick,
  invertBalanceColors = true,
}) => {
  const formatNumber = (num) => {
    return new Intl.NumberFormat("ru-RU").format(num);
  };

  const formatCurrency = (num) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "UZS",
      minimumFractionDigits: 0,
    }).format(num);
  };

  // Функция для определения цвета сальдо (инвертированная логика)
  const getBalanceColor = (balance) => {
    if (invertBalanceColors) {
      // Инвертированная логика: положительные = красный, отрицательные = зеленый
      return balance >= 0 ? "text-red-600" : "text-green-600";
    } else {
      // Обычная логика: положительные = зеленый, отрицательные = красный
      return balance >= 0 ? "text-green-600" : "text-red-600";
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-md p-8 text-center">
        <div className="text-gray-400 mb-2">
          <svg
            className="w-16 h-16 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-600 mb-1">
          Қўрсатиш учун маълумотлар топилмади
        </h3>
        <p className="text-gray-400">
          Бошқа даврни танланг ёки маълумот киритинг
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-x-auto bg-white rounded-2xl shadow-md"
    >
      <table className="w-full border-collapse text-sm">
        <thead className="bg-gradient-to-r from-blue-50 to-blue-100">
          <tr>
            <th className="p-4 text-left font-semibold text-gray-700 border-b">
              №
            </th>
            <th className="p-4 text-left font-semibold text-gray-700 border-b">
              ID
            </th>
            <th className="p-4 text-left font-semibold text-gray-700 border-b">
              Заправка номи
            </th>
            <th className="p-4 text-left font-semibold text-gray-700 border-b">
              Ой бошига сальдо
            </th>
            <th className="p-4 text-left font-semibold text-gray-700 border-b">
              Лимит (м³)
            </th>
            <th className="p-4 text-left font-semibold text-gray-700 border-b">
              Лимит суммаси (сўм)
            </th>
            <th className="p-4 text-left font-semibold text-gray-700 border-b">
              Жами газ (м³)
            </th>
            <th className="p-4 text-left font-semibold text-gray-700 border-b">
              Пилот газ (м³)
            </th>
            <th className="p-4 text-left font-semibold text-gray-700 border-b">
              Конф. хатоси (м³)
            </th>
            <th className="p-4 text-left font-semibold text-gray-700 border-b">
              Низкий перепад (м³)
            </th>
            <th className="p-4 text-left font-semibold text-gray-700 border-b">
              Акт газ (м³)
            </th>
            <th className="p-4 text-left font-semibold text-gray-700 border-b">
              Газ суммаси (сўм)
            </th>
            <th className="p-4 text-left font-semibold text-gray-700 border-b">
              Тўланди
            </th>
            <th className="p-4 text-left font-semibold text-gray-700 border-b">
              Ой охирига сальдо
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <motion.tr
              key={row.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.05 }}
              className={`border-t hover:bg-blue-50 transition-colors cursor-pointer ${
                index % 2 === 0 ? "bg-gray-50" : "bg-white"
              }`}
              onClick={() => onRowClick(row)}
            >
              <td className="p-4 font-medium">{row.displayId || index + 1}</td>
              <td className="p-4 font-mono text-gray-500">{row.stationId}</td>
              <td className="p-4 font-medium text-blue-600">
                {row.stationName}
              </td>
              {/* Сальдо начало с инвертированной цветовой логикой */}
              <td
                className={`p-4 font-mono font-bold ${getBalanceColor(row.startBalance)}`}
              >
                {formatCurrency(row.startBalance)}
              </td>
              <td className="p-4 font-mono">{formatNumber(row.limit)}</td>
              <td className="p-4 font-mono text-green-600">
                {formatCurrency(row.amountOfLimit)}
              </td>
              <td className="p-4 font-mono">{formatNumber(row.totalGas)}</td>
              <td className="p-4 font-mono">{formatNumber(row.gasByMeter)}</td>
              <td className="p-4 font-mono">{formatNumber(row.confError)}</td>
              <td className="p-4 font-mono">{formatNumber(row.lowPress)}</td>
              <td className="p-4 font-mono">{formatNumber(row.gasAct)}</td>
              <td className="p-4 font-mono text-blue-600 font-semibold">
                {formatCurrency(row.amountOfGas)}
              </td>
              <td className="p-4 font-mono text-purple-600 font-semibold">
                {formatCurrency(row.payment)}
              </td>
              {/* Сальдо конец с инвертированной цветовой логикой */}
              <td
                className={`p-4 font-mono font-bold ${getBalanceColor(row.endBalance)}`}
              >
                {formatCurrency(row.endBalance)}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>

      <div className="bg-gray-50 px-6 py-4 border-t flex justify-between items-center text-sm text-gray-600">
        <div>
          <span className="font-medium">Всего записей:</span> {data.length}
        </div>
        <div className="flex gap-4">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-600 rounded-full mr-2"></div>
            <span>Положительное сальдо (инвертированная логика)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-600 rounded-full mr-2"></div>
            <span>Отрицательное сальдо (инвертированная логика)</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default GasSettlementsTable;
