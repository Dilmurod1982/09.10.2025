// hooks/AnalysisComponents.jsx
import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  formatNumber,
  formatCurrency,
  formatDate,
  getPeriodDisplayName,
} from "./useStationAnalytics";

// Карточка анализа (оставляем для других страниц)
export const AnalysisCard = ({
  title,
  value,
  subtitle,
  description,
  onClick,
  color = "blue",
  icon = "📊",
}) => {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 hover:bg-blue-100",
    green: "bg-green-50 border-green-200 hover:bg-green-100",
    red: "bg-red-50 border-red-200 hover:bg-red-100",
    orange: "bg-orange-50 border-orange-200 hover:bg-orange-100",
    purple: "bg-purple-50 border-purple-200 hover:bg-purple-100",
    yellow: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100",
    teal: "bg-teal-50 border-teal-200 hover:bg-teal-100",
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${colorClasses[color]}`}
      onClick={onClick}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <span className="text-xl">{icon}</span>
      </div>
      <div className="text-xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-xs text-gray-600 mb-1">{subtitle}</div>
      <div className="text-xs text-gray-500">{description}</div>
    </motion.div>
  );
};

// Компонент: Детали анализа расхода газа и платежей
export const GasAndPaymentsDetails = ({
  analysisData,
  filters = {},
  onFiltersChange = {},
  onRefresh,
}) => {
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    rangeType: "custom",
  });

  const handleDateRangeChange = (field, value) => {
    const newDateRange = { ...dateRange, [field]: value };
    setDateRange(newDateRange);

    if (field === "startDate" || field === "endDate") {
      onFiltersChange.setGasPaymentsDateRange?.(newDateRange);
    }
  };

  const handleQuickRangeSelect = (rangeType) => {
    const today = new Date();
    let startDate = new Date();

    switch (rangeType) {
      case "today":
        startDate = today;
        break;
      case "yesterday":
        startDate.setDate(today.getDate() - 1);
        break;
      case "week":
        startDate.setDate(today.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(today.getMonth() - 1);
        break;
      case "year":
        startDate.setFullYear(today.getFullYear() - 1);
        break;
      default:
        startDate = today;
    }

    const newDateRange = {
      startDate: startDate.toISOString().split("T")[0],
      endDate: today.toISOString().split("T")[0],
      rangeType: rangeType,
    };

    setDateRange(newDateRange);
    onFiltersChange.setGasPaymentsDateRange?.(newDateRange);
  };

  const renderGasAndPaymentsDetails = () => {
    const data = analysisData.gasAndPaymentsData;
    const isDateRangeData = data && data.summary;
    const summary = isDateRangeData ? data.summary : null;
    const stationsData = isDateRangeData ? data.stationsData : data;
    const dailyData = isDateRangeData ? data.dailyData : [];

    return (
      <div className="space-y-4">
        {/* Заголовок и фильтры */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-center">
            Расход газа и платежи
          </h3>

          {/* Быстрый выбор периода */}
          <div className="flex flex-col gap-2">
            <select
              value={dateRange.rangeType}
              onChange={(e) => handleQuickRangeSelect(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="custom">Выберите период</option>
              <option value="today">Сегодня</option>
              <option value="yesterday">Вчера</option>
              <option value="week">Неделя</option>
              <option value="month">Месяц</option>
              <option value="year">Год</option>
            </select>

            {/* Кастомный диапазон дат */}
            <div className="grid grid-cols-3 gap-2 items-center">
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) =>
                  handleDateRangeChange("startDate", e.target.value)
                }
                className="px-2 py-2 border border-gray-300 rounded-lg text-sm col-span-3"
              />
              <div className="col-span-3 text-center text-xs text-gray-500">
                по
              </div>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) =>
                  handleDateRangeChange("endDate", e.target.value)
                }
                className="px-2 py-2 border border-gray-300 rounded-lg text-sm col-span-3"
              />
            </div>

            <button
              onClick={onRefresh}
              className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm">
              Применить
            </button>
          </div>
        </div>

        {/* Общая сводка */}
        {summary && (
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm font-bold text-blue-600">
                {formatNumber(summary.totalGas)} м3
              </div>
              <div className="text-xs text-gray-600">Продано газа</div>
            </div>
            <div className="p-2 bg-green-50 rounded-lg border border-green-200">
              <div className="text-sm font-bold text-green-600">
                {formatCurrency(summary.totalPayments)}
              </div>
              <div className="text-xs text-gray-600">Поступления</div>
            </div>
            <div className="p-2 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-sm font-bold text-purple-600">
                {summary.reportsCount}
              </div>
              <div className="text-xs text-gray-600">Отчетов</div>
            </div>
            <div className="p-2 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-sm font-bold text-orange-600">
                {stationsData?.length || 0}
              </div>
              <div className="text-xs text-gray-600">Станций</div>
            </div>
          </div>
        )}

        {/* Распределение платежей */}
        {summary && (
          <div className="p-3 bg-white rounded-lg border">
            <h4 className="font-semibold mb-2 text-sm">
              Распределение платежей
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                <span>Наличные:</span>
                <span className="font-semibold">
                  {formatCurrency(summary.totalCash)}
                </span>
              </div>
              <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                <span>HUMO:</span>
                <span className="font-semibold">
                  {formatCurrency(summary.totalHumo)}
                </span>
              </div>
              <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                <span>Uzcard:</span>
                <span className="font-semibold">
                  {formatCurrency(summary.totalUzcard)}
                </span>
              </div>
              <div className="flex justify-between items-center p-2 bg-orange-50 rounded">
                <span>Электронные:</span>
                <span className="font-semibold">
                  {formatCurrency(summary.totalElectronic)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Данные по станциям */}
        <div>
          <h4 className="font-semibold mb-2 text-sm">Данные по станциям</h4>
          {!stationsData || stationsData.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">
              Нет данных за выбранный период
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {stationsData.slice(0, 5).map((station, index) => (
                <div
                  key={station.stationId}
                  className="p-2 bg-white rounded-lg border text-xs">
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-semibold flex-1 pr-2">
                      {station.stationName}
                    </h5>
                    <div className="text-right">
                      <div className="font-bold text-blue-600">
                        {formatNumber(station.totalGas)} м3
                      </div>
                      <div className="text-gray-600">
                        {formatCurrency(station.totalPayments)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div>Нал: {formatCurrency(station.totalCash)}</div>
                    <div>HUMO: {formatCurrency(station.totalHumo)}</div>
                    <div>Uzcard: {formatCurrency(station.totalUzcard)}</div>
                    <div>Эл: {formatCurrency(station.totalElectronic)}</div>
                  </div>
                </div>
              ))}
              {stationsData.length > 5 && (
                <div className="text-center text-xs text-gray-500 py-2">
                  + еще {stationsData.length - 5} станций
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 bg-white rounded-xl shadow-lg">
      {renderGasAndPaymentsDetails()}
    </motion.div>
  );
};

// Компонент деталей анализа
export const AnalysisDetails = ({
  selectedAnalysis,
  analysisData,
  filters = {},
  onFiltersChange = {},
  onRefresh,
}) => {
  if (!selectedAnalysis) return null;

  const renderAutopilotDetails = () => (
    <div className="space-y-3">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-center">
          Данные AutoPilotPro
        </h3>
        <div className="flex flex-col gap-2">
          <select
            value={filters.autopilotPeriod || "1day"}
            onChange={(e) =>
              onFiltersChange.setAutopilotPeriod?.(e.target.value)
            }
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="1day">За 1 день</option>
            <option value="7days">За 7 дней</option>
            <option value="1month">За месяц</option>
          </select>
          <button
            onClick={onRefresh}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            Обновить
          </button>
        </div>
      </div>

      {analysisData.autopilotData.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">
          Нет данных за выбранный период
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {analysisData.autopilotData.map((station, index) => (
            <div
              key={station.stationId}
              className="p-2 bg-white rounded-lg border">
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-2">
                  <h4 className="font-semibold text-sm">
                    {station.stationName}
                  </h4>
                  <p className="text-xs text-gray-600">
                    Среднее: {formatNumber(station.averageAutopilot.toFixed(1))}{" "}
                    м3
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">
                    {formatNumber(station.totalAutopilot)} м3
                  </p>
                  <p className="text-xs text-gray-600">
                    {station.reportsCount} отчет.
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderComparisonDetails = () => (
    <div className="space-y-3">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-center">
          Сравнительный анализ
        </h3>
        <div className="flex flex-col gap-2">
          <select
            value={filters.comparisonType || "yesterday"}
            onChange={(e) =>
              onFiltersChange.setComparisonType?.(e.target.value)
            }
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="yesterday">С вчерашним днем</option>
            <option value="week">С прошлой неделей</option>
          </select>
          <button
            onClick={onRefresh}
            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
            Обновить
          </button>
        </div>
      </div>

      {analysisData.comparisonData.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">
          Нет данных для сравнения
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {analysisData.comparisonData.slice(0, 10).map((station, index) => (
            <div key={index} className="p-2 bg-white rounded-lg border">
              <div className="flex justify-between items-start mb-1">
                <h4 className="font-semibold text-sm flex-1 pr-2">
                  {station.stationName}
                </h4>
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    station.difference >= 0
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}>
                  {station.difference >= 0 ? "+" : ""}
                  {formatNumber(station.difference)} м3
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div>
                  <div>Текущ: {formatNumber(station.currentValue)} м3</div>
                  <div className="text-gray-600 text-xs">
                    {formatDate(station.currentDate)}
                  </div>
                </div>
                <div>
                  <div>Пред: {formatNumber(station.previousValue)} м3</div>
                  <div className="text-gray-600 text-xs">
                    {formatDate(station.previousDate)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderNegativeDifferenceDetails = () => (
    <div className="space-y-3">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-center">
          Отрицательная разница
        </h3>
        <div className="flex flex-col gap-2">
          <select
            value={filters.negativeDiffPeriod || "1day"}
            onChange={(e) =>
              onFiltersChange.setNegativeDiffPeriod?.(e.target.value)
            }
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="1day">За 1 день</option>
            <option value="7days">За 7 дней</option>
          </select>
          <button
            onClick={onRefresh}
            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
            Обновить
          </button>
        </div>
      </div>

      {analysisData.negativeDifferenceData.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">
          Нет станций с отрицательной разницей
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {analysisData.negativeDifferenceData.map((station, index) => (
            <div
              key={station.stationId}
              className="p-2 bg-white rounded-lg border border-red-200">
              <div className="flex justify-between items-start mb-1">
                <h4 className="font-semibold text-sm flex-1 pr-2">
                  {station.stationName}
                </h4>
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                  {formatNumber(station.difference)} м3
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div>
                  AutoPilot: {formatNumber(station.autopilotReading)} м3
                </div>
                <div>Hose: {formatNumber(station.hoseTotalGas)} м3</div>
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {formatDate(station.reportDate)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMissingReportsDetails = () => (
    <div className="space-y-3">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-center">
          Отсутствующие отчеты
        </h3>
        <div className="flex flex-col gap-2">
          <select
            value={filters.missingReportsPeriod || "1day"}
            onChange={(e) =>
              onFiltersChange.setMissingReportsPeriod?.(e.target.value)
            }
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="1day">За 1 день</option>
            <option value="7days">За 7 дней</option>
          </select>
          <button
            onClick={onRefresh}
            className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm">
            Обновить
          </button>
        </div>
      </div>

      {analysisData.missingReportsData.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">
          Все отчеты сданы вовремя
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {analysisData.missingReportsData
            .slice(0, 10)
            .map((station, index) => (
              <div
                key={`${station.stationId}-${station.missingDate}`}
                className="p-2 bg-white rounded-lg border border-orange-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                    <h4 className="font-semibold text-sm">
                      {station.stationName}
                    </h4>
                    <p className="text-xs text-gray-600">
                      Отсутствует за {formatDate(station.missingDate)}
                    </p>
                  </div>
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                    Просрочка
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );

  const renderControlDifferenceDetails = () => (
    <div className="space-y-3">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-center">
          Разница контрольных сумм
        </h3>
        <div className="flex flex-col gap-2">
          <select
            value={filters.controlDiffPeriod || "yesterday"}
            onChange={(e) =>
              onFiltersChange.setControlDiffPeriod?.(e.target.value)
            }
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="yesterday">Вчера</option>
            <option value="7days">7 дней</option>
          </select>
          <button
            onClick={onRefresh}
            className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
            Обновить
          </button>
        </div>
      </div>

      {analysisData.controlDifferenceData.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">
          Нет расхождений
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {analysisData.controlDifferenceData
            .slice(0, 5)
            .map((report, index) => (
              <div
                key={index}
                className="p-2 bg-white rounded-lg border border-purple-200">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-sm flex-1 pr-2">
                    {report.stationName}
                  </h4>
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                    {formatDate(report.reportDate)}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  {report.problems.includes("cash_negative") && (
                    <div className="p-1 bg-yellow-50 rounded border border-yellow-200">
                      <p className="font-semibold">💵 Наличные</p>
                      <p>Факт: {formatCurrency(report.amounts.cash)}</p>
                      <p>
                        Контроль: {formatCurrency(report.controlAmounts.cash)}
                      </p>
                    </div>
                  )}

                  {report.problems.includes("humo_negative") && (
                    <div className="p-1 bg-yellow-50 rounded border border-yellow-200">
                      <p className="font-semibold">💳 HUMO</p>
                      <p>Факт: {formatCurrency(report.amounts.humo)}</p>
                      <p>
                        Контроль: {formatCurrency(report.controlAmounts.humo)}
                      </p>
                    </div>
                  )}

                  {report.problems.includes("uzcard_negative") && (
                    <div className="p-1 bg-yellow-50 rounded border border-yellow-200">
                      <p className="font-semibold">💳 Uzcard</p>
                      <p>Факт: {formatCurrency(report.amounts.uzcard)}</p>
                      <p>
                        Контроль: {formatCurrency(report.controlAmounts.uzcard)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );

  const renderExpiredDocumentsDetails = () => (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-center">
        Просроченные документы
      </h3>

      {analysisData.expiredDocumentsData.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">
          Нет просроченных документов
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {analysisData.expiredDocumentsData
            .slice(0, 5)
            .map((station, index) => (
              <div
                key={index}
                className="p-2 bg-white rounded-lg border border-yellow-200">
                <h4 className="font-semibold mb-2 text-sm">
                  {station.stationName}
                </h4>

                <div className="space-y-1">
                  {station.documents.slice(0, 3).map((doc, docIndex) => (
                    <div
                      key={docIndex}
                      className="p-1 bg-red-50 rounded border border-red-200 text-xs">
                      <div className="font-semibold">{doc.docType}</div>
                      <div>№ {doc.docNumber}</div>
                      <div className="text-red-600 font-semibold">
                        Просрочено на {doc.daysOverdue} дн.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );

  const renderGasAndPaymentsDetails = () => (
    <GasAndPaymentsDetails
      analysisData={analysisData}
      filters={filters}
      onFiltersChange={onFiltersChange}
      onRefresh={onRefresh}
    />
  );

  const renderDetails = () => {
    switch (selectedAnalysis.type) {
      case "autopilot":
        return renderAutopilotDetails();
      case "comparison":
        return renderComparisonDetails();
      case "negativeDifference":
        return renderNegativeDifferenceDetails();
      case "missingReports":
        return renderMissingReportsDetails();
      case "controlDifference":
        return renderControlDifferenceDetails();
      case "expiredDocuments":
        return renderExpiredDocumentsDetails();
      case "gasAndPayments":
        return renderGasAndPaymentsDetails();
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 bg-white rounded-xl shadow-lg">
      {renderDetails()}
    </motion.div>
  );
};
