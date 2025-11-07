// hooks/AnalysisComponents.jsx
import React from "react";
import { motion } from "framer-motion";
import {
  formatNumber,
  formatCurrency,
  formatDate,
  getPeriodDisplayName,
} from "./useStationAnalytics";

// Карточка анализа
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
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${colorClasses[color]}`}
      onClick={onClick}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-2">{value}</div>
      <div className="text-sm text-gray-600 mb-1">{subtitle}</div>
      <div className="text-xs text-gray-500">{description}</div>
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
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Данные AutoPilotPro</h3>
        <div className="flex gap-2">
          <select
            value={filters.autopilotPeriod || "1day"}
            onChange={(e) =>
              onFiltersChange.setAutopilotPeriod?.(e.target.value)
            }
            className="px-3 py-2 border border-gray-300 rounded-lg">
            <option value="1day">За 1 день</option>
            <option value="7days">За 7 дней</option>
            <option value="1month">За месяц</option>
            <option value="6months">За полгода</option>
            <option value="1year">За год</option>
          </select>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Обновить
          </button>
        </div>
      </div>

      {analysisData.autopilotData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Нет данных за выбранный период
        </div>
      ) : (
        <div className="grid gap-4">
          {analysisData.autopilotData.map((station, index) => (
            <div
              key={station.stationId}
              className="p-4 bg-white rounded-lg border">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-semibold">{station.stationName}</h4>
                  <p className="text-sm text-gray-600">
                    Среднее значение:{" "}
                    {formatNumber(station.averageAutopilot.toFixed(2))} л
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">
                    {formatNumber(station.totalAutopilot)} л
                  </p>
                  <p className="text-sm text-gray-600">
                    {station.reportsCount} отчетов
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
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Сравнительный анализ</h3>
        <div className="flex gap-2">
          <select
            value={filters.comparisonType || "yesterday"}
            onChange={(e) =>
              onFiltersChange.setComparisonType?.(e.target.value)
            }
            className="px-3 py-2 border border-gray-300 rounded-lg">
            <option value="yesterday">С вчерашним днем</option>
            <option value="week">С прошлой неделей</option>
            <option value="month">С прошлым месяцем</option>
          </select>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Обновить
          </button>
        </div>
      </div>

      {analysisData.comparisonData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Нет данных для сравнения
        </div>
      ) : (
        <div className="grid gap-4">
          {analysisData.comparisonData.map((station, index) => (
            <div key={index} className="p-4 bg-white rounded-lg border">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold">{station.stationName}</h4>
                <span
                  className={`px-2 py-1 rounded ${
                    station.difference >= 0
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}>
                  {station.difference >= 0 ? "+" : ""}
                  {formatNumber(station.difference)} л
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p>Текущее: {formatNumber(station.currentValue)} л</p>
                  <p className="text-gray-600">
                    {formatDate(station.currentDate)}
                  </p>
                </div>
                <div>
                  <p>Предыдущее: {formatNumber(station.previousValue)} л</p>
                  <p className="text-gray-600">
                    {formatDate(station.previousDate)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderNegativeDifferenceDetails = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Отрицательная разница</h3>
        <div className="flex gap-2">
          <select
            value={filters.negativeDiffPeriod || "1day"}
            onChange={(e) =>
              onFiltersChange.setNegativeDiffPeriod?.(e.target.value)
            }
            className="px-3 py-2 border border-gray-300 rounded-lg">
            <option value="1day">За 1 день</option>
            <option value="7days">За 7 дней</option>
            <option value="1month">За месяц</option>
            <option value="6months">За полгода</option>
            <option value="1year">За год</option>
          </select>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            Обновить
          </button>
        </div>
      </div>

      {analysisData.negativeDifferenceData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Нет станций с отрицательной разницей
        </div>
      ) : (
        <div className="grid gap-4">
          {analysisData.negativeDifferenceData.map((station, index) => (
            <div
              key={station.stationId}
              className="p-4 bg-white rounded-lg border border-red-200">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold">{station.stationName}</h4>
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
                  {formatNumber(station.difference)} л
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p>AutoPilot: {formatNumber(station.autopilotReading)} л</p>
                  <p>Hose Total: {formatNumber(station.hoseTotalGas)} л</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-600">
                    {formatDate(station.reportDate)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMissingReportsDetails = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Отсутствующие отчеты</h3>
        <div className="flex gap-2">
          <select
            value={filters.missingReportsPeriod || "1day"}
            onChange={(e) =>
              onFiltersChange.setMissingReportsPeriod?.(e.target.value)
            }
            className="px-3 py-2 border border-gray-300 rounded-lg">
            <option value="1day">За 1 день</option>
            <option value="7days">За 7 дней</option>
            <option value="1month">За месяц</option>
            <option value="6months">За полгода</option>
            <option value="1year">За год</option>
          </select>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
            Обновить
          </button>
        </div>
      </div>

      {analysisData.missingReportsData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Все отчеты сданы вовремя{" "}
          {getPeriodDisplayName(filters.missingReportsPeriod)}
        </div>
      ) : (
        <div className="grid gap-4">
          {analysisData.missingReportsData.map((station, index) => (
            <div
              key={`${station.stationId}-${station.missingDate}`}
              className="p-4 bg-white rounded-lg border border-orange-200">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-semibold">{station.stationName}</h4>
                  <p className="text-sm text-gray-600">
                    Отчет отсутствует за {formatDate(station.missingDate)}
                  </p>
                </div>
                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm">
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
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Разница контрольных сумм</h3>
        <div className="flex gap-2">
          <select
            value={filters.controlDiffPeriod || "yesterday"}
            onChange={(e) =>
              onFiltersChange.setControlDiffPeriod?.(e.target.value)
            }
            className="px-3 py-2 border border-gray-300 rounded-lg">
            <option value="yesterday">Вчера</option>
            <option value="7days">7 дней</option>
            <option value="1month">Месяц</option>
            <option value="6months">Полгода</option>
            <option value="1year">Год</option>
          </select>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            Обновить
          </button>
        </div>
      </div>

      {analysisData.controlDifferenceData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Нет расхождений в контрольных суммах{" "}
          {getPeriodDisplayName(filters.controlDiffPeriod)}
        </div>
      ) : (
        <div className="grid gap-4">
          {analysisData.controlDifferenceData.map((report, index) => (
            <div
              key={index}
              className="p-4 bg-white rounded-lg border border-purple-200">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold">{report.stationName}</h4>
                <div className="text-right">
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">
                    {formatDate(report.reportDate)}
                  </span>
                  <div className="text-xs text-gray-500 mt-1">
                    Период: {getPeriodDisplayName(filters.controlDiffPeriod)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {report.problems.includes("cash_missing") && (
                  <div className="col-span-2 p-2 bg-red-50 rounded border border-red-200">
                    <p className="font-semibold text-red-800">
                      ⚠️ Отсутствует контрольная сумма наличных
                    </p>
                    <p>Факт: {formatCurrency(report.amounts.cash)}</p>
                    <p>
                      Контроль: {formatCurrency(report.controlAmounts.cash)}
                    </p>
                  </div>
                )}

                {report.problems.includes("cash_negative") && (
                  <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                    <p className="font-semibold">💵 Наличные</p>
                    <p>Факт: {formatCurrency(report.amounts.cash)}</p>
                    <p>
                      Контроль: {formatCurrency(report.controlAmounts.cash)}
                    </p>
                    <p className="text-red-600 font-semibold">
                      Разница: +{formatCurrency(report.differences.cash)}
                    </p>
                  </div>
                )}

                {report.problems.includes("humo_missing") && (
                  <div className="col-span-2 p-2 bg-red-50 rounded border border-red-200">
                    <p className="font-semibold text-red-800">
                      ⚠️ Отсутствует контрольная сумма HUMO
                    </p>
                    <p>Факт: {formatCurrency(report.amounts.humo)}</p>
                    <p>
                      Контроль: {formatCurrency(report.controlAmounts.humo)}
                    </p>
                  </div>
                )}

                {report.problems.includes("humo_negative") && (
                  <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                    <p className="font-semibold">💳 HUMO</p>
                    <p>Факт: {formatCurrency(report.amounts.humo)}</p>
                    <p>
                      Контроль: {formatCurrency(report.controlAmounts.humo)}
                    </p>
                    <p className="text-red-600 font-semibold">
                      Разница: +{formatCurrency(report.differences.humo)}
                    </p>
                  </div>
                )}

                {report.problems.includes("uzcard_missing") && (
                  <div className="col-span-2 p-2 bg-red-50 rounded border border-red-200">
                    <p className="font-semibold text-red-800">
                      ⚠️ Отсутствует контрольная сумма Uzcard
                    </p>
                    <p>Факт: {formatCurrency(report.amounts.uzcard)}</p>
                    <p>
                      Контроль: {formatCurrency(report.controlAmounts.uzcard)}
                    </p>
                  </div>
                )}

                {report.problems.includes("uzcard_negative") && (
                  <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                    <p className="font-semibold">💳 Uzcard</p>
                    <p>Факт: {formatCurrency(report.amounts.uzcard)}</p>
                    <p>
                      Контроль: {formatCurrency(report.controlAmounts.uzcard)}
                    </p>
                    <p className="text-red-600 font-semibold">
                      Разница: +{formatCurrency(report.differences.uzcard)}
                    </p>
                  </div>
                )}

                {report.problems.includes("electronic_missing") && (
                  <div className="col-span-2 p-2 bg-red-50 rounded border border-red-200">
                    <p className="font-semibold text-red-800">
                      ⚠️ Отсутствует контрольная сумма электронных платежей
                    </p>
                    <p>Факт: {formatCurrency(report.amounts.electronic)}</p>
                    <p>
                      Контроль:{" "}
                      {formatCurrency(report.controlAmounts.electronic)}
                    </p>
                  </div>
                )}

                {report.problems.includes("electronic_negative") && (
                  <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                    <p className="font-semibold">📱 Электронные</p>
                    <p>Факт: {formatCurrency(report.amounts.electronic)}</p>
                    <p>
                      Контроль:{" "}
                      {formatCurrency(report.controlAmounts.electronic)}
                    </p>
                    <p className="text-red-600 font-semibold">
                      Разница: +{formatCurrency(report.differences.electronic)}
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
    <div className="space-y-4">
      <h3 className="text-xl font-semibold mb-4">Просроченные документы</h3>

      {analysisData.expiredDocumentsData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Нет просроченных документов
        </div>
      ) : (
        <div className="grid gap-4">
          {analysisData.expiredDocumentsData.map((station, index) => (
            <div
              key={index}
              className="p-4 bg-white rounded-lg border border-yellow-200">
              <h4 className="font-semibold mb-3">{station.stationName}</h4>

              <div className="space-y-2">
                {station.documents.map((doc, docIndex) => (
                  <div
                    key={docIndex}
                    className="p-3 bg-red-50 rounded border border-red-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{doc.docType}</p>
                        <p className="text-sm">№ {doc.docNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-red-600 font-semibold">
                          Просрочено на {doc.daysOverdue} дней
                        </p>
                        <p className="text-sm text-gray-600">
                          Истек: {formatDate(doc.expiryDate)}
                        </p>
                      </div>
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
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-white rounded-2xl shadow-lg mb-6">
      {renderDetails()}
    </motion.div>
  );
};
