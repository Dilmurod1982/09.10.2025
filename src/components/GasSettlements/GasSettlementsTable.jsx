import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

const GasSettlementsTable = ({
  data,
  onRowClick,
  invertBalanceColors = true,
}) => {
  const tableContainerRef = useRef(null);
  const bottomScrollRef = useRef(null);

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
      return balance >= 0 ? "text-red-600" : "text-green-600";
    } else {
      return balance >= 0 ? "text-green-600" : "text-red-600";
    }
  };

  // Управление скроллом - только нижний скролл управляет верхним
  useEffect(() => {
    const tableContainer = tableContainerRef.current;
    const bottomScroll = bottomScrollRef.current;

    if (!tableContainer || !bottomScroll) return;

    // Функция для синхронизации скролла снизу вверх
    const handleBottomScroll = () => {
      if (tableContainer) {
        tableContainer.scrollLeft = bottomScroll.scrollLeft;
      }
    };

    // Добавляем слушатель только на нижний скролл
    bottomScroll.addEventListener("scroll", handleBottomScroll);

    // Устанавливаем начальную ширину нижнего скролла
    const updateScrollWidth = () => {
      if (tableContainer && bottomScroll) {
        bottomScroll.style.width = `${tableContainer.clientWidth}px`;
      }
    };

    updateScrollWidth();
    window.addEventListener("resize", updateScrollWidth);

    return () => {
      bottomScroll.removeEventListener("scroll", handleBottomScroll);
      window.removeEventListener("resize", updateScrollWidth);
    };
  }, [data]); // Добавляем data в зависимости, чтобы обновлять при изменении таблицы

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
      className="bg-white rounded-2xl shadow-md"
    >
      {/* Контейнер с таблицей - скролл бар скрыт */}
      <div
        ref={tableContainerRef}
        className="overflow-x-auto scrollbar-hide"
        style={{
          maxWidth: "100%",
          overflowX: "auto",
          scrollbarWidth: "none" /* Firefox */,
          msOverflowStyle: "none" /* IE and Edge */,
        }}
      >
        {/* Скрываем скроллбар в Webkit браузерах */}
        <style jsx>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        <table
          className="border-collapse text-sm"
          style={{ minWidth: "max-content" }}
        >
          <thead className="bg-gradient-to-r from-blue-50 to-blue-100">
            <tr>
              <th className="p-4 text-left font-semibold text-gray-700 border-b whitespace-nowrap">
                №
              </th>
              <th className="p-4 text-left font-semibold text-gray-700 border-b whitespace-nowrap">
                Заправка номи
              </th>
              <th className="p-4 text-left font-semibold text-gray-700 border-b whitespace-nowrap">
                Манзили
              </th>
              <th className="p-4 text-left font-semibold text-gray-700 border-b whitespace-nowrap">
                Ой бошига сальдо
              </th>
              <th className="p-4 text-left font-semibold text-gray-700 border-b whitespace-nowrap">
                Лимит (м³)
              </th>
              <th className="p-4 text-left font-semibold text-gray-700 border-b whitespace-nowrap">
                Лимит суммаси (сўм)
              </th>
              <th className="p-4 text-left font-semibold text-gray-700 border-b whitespace-nowrap">
                Жами газ (м³)
              </th>
              <th className="p-4 text-left font-semibold text-gray-700 border-b whitespace-nowrap">
                Пилот газ (м³)
              </th>
              <th className="p-4 text-left font-semibold text-gray-700 border-b whitespace-nowrap">
                Конф. хатоси (м³)
              </th>
              <th className="p-4 text-left font-semibold text-gray-700 border-b whitespace-nowrap">
                Низкий перепад (м³)
              </th>
              <th className="p-4 text-left font-semibold text-gray-700 border-b whitespace-nowrap">
                Акт газ (м³)
              </th>
              <th className="p-4 text-left font-semibold text-gray-700 border-b whitespace-nowrap">
                Газ суммаси (сўм)
              </th>
              <th className="p-4 text-left font-semibold text-gray-700 border-b whitespace-nowrap">
                Тўланди
              </th>
              <th className="p-4 text-left font-semibold text-gray-700 border-b whitespace-nowrap">
                Ой охирига сальдо
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <motion.tr
                key={row.id || index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className={`border-t hover:bg-blue-50 transition-colors cursor-pointer ${
                  index % 2 === 0 ? "bg-gray-50" : "bg-white"
                }`}
                onClick={() => onRowClick(row)}
              >
                <td className="p-4 font-medium whitespace-nowrap">
                  {row.displayId || index + 1}
                </td>
                <td className="p-4 font-medium text-blue-600 whitespace-nowrap">
                  {row.stationName}
                </td>
                <td className="p-4 font-medium text-red-600 whitespace-nowrap">
                  {row.landmark}
                </td>
                <td
                  className={`p-4 font-mono font-bold whitespace-nowrap ${getBalanceColor(row.startBalance)}`}
                >
                  {formatCurrency(row.startBalance)}
                </td>
                <td className="p-4 font-mono whitespace-nowrap">
                  {formatNumber(row.limit)}
                </td>
                <td className="p-4 font-mono text-green-600 whitespace-nowrap">
                  {formatCurrency(row.amountOfLimit)}
                </td>
                <td className="p-4 font-mono whitespace-nowrap">
                  {formatNumber(row.totalGas)}
                </td>
                <td className="p-4 font-mono whitespace-nowrap">
                  {formatNumber(row.gasByMeter)}
                </td>
                <td className="p-4 font-mono whitespace-nowrap">
                  {formatNumber(row.confError)}
                </td>
                <td className="p-4 font-mono whitespace-nowrap">
                  {formatNumber(row.lowPress)}
                </td>
                <td className="p-4 font-mono whitespace-nowrap">
                  {formatNumber(row.gasAct)}
                </td>
                <td className="p-4 font-mono text-blue-600 font-semibold whitespace-nowrap">
                  {formatCurrency(row.amountOfGas)}
                </td>
                <td className="p-4 font-mono text-purple-600 font-semibold whitespace-nowrap">
                  {formatCurrency(row.payment)}
                </td>
                <td
                  className={`p-4 font-mono font-bold whitespace-nowrap ${getBalanceColor(row.endBalance)}`}
                >
                  {formatCurrency(row.endBalance)}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Нижний горизонтальный скролл - ВИДИМЫЙ */}
      <div
        ref={bottomScrollRef}
        className="overflow-x-auto bg-gray-50 border-t border-gray-200"
        style={{
          maxWidth: "100%",
          overflowX: "auto",
        }}
      >
        <div
          style={{
            width: tableContainerRef.current?.scrollWidth || "100%",
            height: "16px",
          }}
        />
      </div>

      <div className="bg-gray-50 px-6 py-4 border-t flex flex-wrap justify-between items-center text-sm text-gray-600">
        <div>
          <span className="font-medium">Жами ёзувлар:</span> {data.length}
        </div>
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-600 rounded-full mr-2"></div>
            <span className="whitespace-nowrap">Мусбат сальдо (дебет)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-600 rounded-full mr-2"></div>
            <span className="whitespace-nowrap">Манфий сальдо (кредит)</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default GasSettlementsTable;
