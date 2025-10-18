import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../firebase/config";
import toast from "react-hot-toast";

const AddHoseReportModal = ({ station, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [lastReport, setLastReport] = useState(null);
  const [date, setDate] = useState("");
  const [dateDisabled, setDateDisabled] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalSum, setTotalSum] = useState(0); // Новое состояние для общей суммы

  // Получаем количество шлангов
  const hosesCount = useMemo(() => {
    const d = Array.isArray(station?.dispensers)
      ? station.dispensers.length
      : 0;
    return d * 2;
  }, [station?.dispensers]);

  // Создаем имена шлангов
  const hoseNames = useMemo(() => {
    return Array.from({ length: hosesCount }, (_, i) => `Шланг-${i + 1}`);
  }, [hosesCount]);

  // Функция для добавления дней к дате
  const addDays = useCallback((dateString, days) => {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  }, []);

  // Функция для расчета разницы, суммы и тотала
  const calculateRowDiff = useCallback((row) => {
    const prev = Number(row.prev) || 0;
    const current = row.current === "" ? 0 : Number(row.current);
    const price = Number(row.price) || 0;
    const diff = current >= prev ? current - prev : 0;
    const sum = diff * price;

    return {
      ...row,
      diff: isNaN(diff) ? 0 : diff,
      sum: isNaN(sum) ? 0 : sum,
    };
  }, []);

  // Функция для расчета общего тотала и общей суммы
  const calculateTotals = useCallback((rows) => {
    const totals = rows.reduce(
      (acc, row) => {
        const diff = Number(row.diff) || 0;
        const sum = Number(row.sum) || 0;
        return {
          totalGas: acc.totalGas + (diff > 0 ? diff : 0),
          totalSum: acc.totalSum + sum,
        };
      },
      { totalGas: 0, totalSum: 0 }
    );
    return totals;
  }, []);

  // Загружаем последний отчет
  useEffect(() => {
    if (!station?.id) return;

    const fetchLastReport = async () => {
      try {
        const q = query(
          collection(db, "daily_hose_reports"),
          where("stationId", "==", station.id),
          orderBy("date", "desc"),
          limit(1)
        );

        const snap = await getDocs(q);

        if (!snap.empty) {
          const lastDoc = snap.docs[0];
          const lastData = lastDoc.data();
          setLastReport(lastData);

          // Устанавливаем дату +1 день от последнего отчета
          const nextDate = addDays(lastData.date, 1);
          setDate(nextDate);
          setDateDisabled(true);

          // Заполняем предыдущие значения и цены
          const prevHoses = Array.isArray(lastData.hoses) ? lastData.hoses : [];
          const initialRows = hoseNames.map((name) => {
            const prevHose = prevHoses.find((h) => h.hose === name);
            const baseRow = {
              hose: name,
              prev: prevHose ? Number(prevHose.current) : 0,
              current: "",
              price: prevHose ? Number(prevHose.price) || 0 : 0, // Берем цену из предыдущего отчета или 0
              diff: 0,
              sum: 0,
              prevDisabled: true,
            };
            return calculateRowDiff(baseRow);
          });

          setRows(initialRows);
          const totals = calculateTotals(initialRows);
          setTotal(totals.totalGas);
          setTotalSum(totals.totalSum);
        } else {
          // Нет предыдущих отчетов
          setLastReport(null);
          setDateDisabled(false);
          setDate(new Date().toISOString().split("T")[0]);

          const initialRows = hoseNames.map((name) => {
            const baseRow = {
              hose: name,
              prev: 0,
              current: "",
              price: 0, // По умолчанию 0
              diff: 0,
              sum: 0,
              prevDisabled: false,
            };
            return calculateRowDiff(baseRow);
          });

          setRows(initialRows);
          const totals = calculateTotals(initialRows);
          setTotal(totals.totalGas);
          setTotalSum(totals.totalSum);
        }
      } catch (error) {
        console.error("Ошибка при загрузке предыдущего отчета:", error);
        toast.error("Ошибка при загрузке предыдущего отчета");

        const initialRows = hoseNames.map((name) => {
          const baseRow = {
            hose: name,
            prev: 0,
            current: "",
            price: 0,
            diff: 0,
            sum: 0,
            prevDisabled: false,
          };
          return calculateRowDiff(baseRow);
        });

        setRows(initialRows);
        const totals = calculateTotals(initialRows);
        setTotal(totals.totalGas);
        setTotalSum(totals.totalSum);
      }
    };

    fetchLastReport();
  }, [station?.id, hoseNames, addDays, calculateRowDiff, calculateTotals]);

  // Обработчик изменения текущего показания
  const handleCurrentChange = useCallback(
    (index, value) => {
      const cleanedValue = value === "" ? "" : value.replace(/[^0-9]/g, "");

      setRows((prev) => {
        const newRows = [...prev];
        const updatedRow = {
          ...newRows[index],
          current: cleanedValue,
        };

        // Сразу рассчитываем разницу и сумму для этой строки
        const rowWithDiff = calculateRowDiff(updatedRow);
        newRows[index] = rowWithDiff;

        // Пересчитываем общие тоталы
        const newTotals = calculateTotals(newRows);
        setTotal(newTotals.totalGas);
        setTotalSum(newTotals.totalSum);

        return newRows;
      });
    },
    [calculateRowDiff, calculateTotals]
  );

  // Обработчик изменения предыдущего показания
  const handlePrevChange = useCallback(
    (index, value) => {
      const cleanedValue = value === "" ? "" : value.replace(/[^0-9]/g, "");

      setRows((prev) => {
        const newRows = [...prev];
        const updatedRow = {
          ...newRows[index],
          prev: cleanedValue === "" ? 0 : Number(cleanedValue),
        };

        // Сразу рассчитываем разницу и сумму для этой строки
        const rowWithDiff = calculateRowDiff(updatedRow);
        newRows[index] = rowWithDiff;

        // Пересчитываем общие тоталы
        const newTotals = calculateTotals(newRows);
        setTotal(newTotals.totalGas);
        setTotalSum(newTotals.totalSum);

        return newRows;
      });
    },
    [calculateRowDiff, calculateTotals]
  );

  // Обработчик изменения цены
  const handlePriceChange = useCallback(
    (index, value) => {
      const cleanedValue =
        value === "" ? "" : value.replace(/[^0-9.,]/g, "").replace(",", ".");

      setRows((prev) => {
        const newRows = [...prev];
        const updatedRow = {
          ...newRows[index],
          price: cleanedValue === "" ? 0 : parseFloat(cleanedValue) || 0,
        };

        // Сразу рассчитываем сумму для этой строки
        const rowWithDiff = calculateRowDiff(updatedRow);
        newRows[index] = rowWithDiff;

        // Пересчитываем общие тоталы
        const newTotals = calculateTotals(newRows);
        setTotal(newTotals.totalGas);
        setTotalSum(newTotals.totalSum);

        return newRows;
      });
    },
    [calculateRowDiff, calculateTotals]
  );

  // Валидация формы
  const allFilled = useMemo(
    () =>
      rows.every(
        (row) =>
          row.current !== "" &&
          !isNaN(Number(row.current)) &&
          Number(row.current) >= 0
      ),
    [rows]
  );

  const anyInvalid = useMemo(
    () =>
      rows.some((row) => {
        const current = Number(row.current);
        const prev = Number(row.prev);
        return current < prev;
      }),
    [rows]
  );

  const canSave = !loading && date && allFilled && !anyInvalid;

  // Получение IP клиента
  const getClientIp = async () => {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      const data = await response.json();
      return data.ip || "unknown";
    } catch (error) {
      return "unknown";
    }
  };

  // Сохранение отчета
  const handleSave = async () => {
    if (!canSave) return;

    setLoading(true);
    const toastId = toast.loading("Сохранение отчета...");

    try {
      const ip = await getClientIp();
      const userId = auth?.currentUser?.uid || "unknown";

      const hoses = rows.map((row) => ({
        hose: row.hose,
        prev: Number(row.prev) || 0,
        current: Number(row.current) || 0,
        price: Number(row.price) || 0, // Сохраняем цену
        diff: Number(row.diff) || 0,
        sum: Number(row.sum) || 0, // Сохраняем сумму
      }));

      const reportData = {
        stationId: station.id,
        stationName: station.stationName || "Без названия",
        date,
        hoses,
        totalgas: total,
        totalsum: totalSum, // Сохраняем общую сумму
        createdAt: serverTimestamp(),
        createdBy: userId,
        createdIp: ip,
      };

      await addDoc(collection(db, "daily_hose_reports"), reportData);

      toast.success("Отчет успешно сохранен!");
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (error) {
      console.error("Ошибка сохранения:", error);
      toast.error("Ошибка при сохранении отчета");
    } finally {
      setLoading(false);
      toast.dismiss(toastId);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden">
        {/* Заголовок */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Новый отчет по шлангам
              </h2>
              <p className="text-blue-100 mt-1">
                {station?.stationName || "Станция"} •{" "}
                {date || "Не выбрана дата"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-blue-500 p-2 rounded-full transition-colors"
              disabled={loading}>
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div
          className="p-6 overflow-auto"
          style={{ maxHeight: "calc(95vh - 120px)" }}>
          {/* Поле даты */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Дата отчета *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={dateDisabled || loading}
              className="w-full max-w-xs px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              required
            />
            {dateDisabled && lastReport && (
              <p className="text-sm text-green-600 mt-2 flex items-center">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Дата установлена автоматически (следующий день после последнего
                отчета {lastReport.date})
              </p>
            )}
          </div>

          {/* Таблица шлангов */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Показания шлангов
              </h3>
              <div className="text-sm text-gray-600">
                Всего шлангов: {hosesCount}
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700 border-b">
                      Шланг
                    </th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700 border-b">
                      Цена (₽)
                    </th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700 border-b">
                      Предыдущее показание
                    </th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700 border-b">
                      Текущее показание *
                    </th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700 border-b">
                      Разница
                    </th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700 border-b">
                      Сумма (₽)
                    </th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700 border-b">
                      Статус
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rows.map((row, index) => {
                    const currentNum = Number(row.current);
                    const prevNum = Number(row.prev);
                    const isInvalid =
                      row.current !== "" && currentNum < prevNum;

                    return (
                      <tr
                        key={row.hose}
                        className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-semibold text-gray-900">
                            {row.hose}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            value={row.price}
                            onChange={(e) =>
                              handlePriceChange(index, e.target.value)
                            }
                            className="w-full max-w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                            disabled={loading}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            value={row.prev}
                            onChange={(e) =>
                              handlePrevChange(index, e.target.value)
                            }
                            disabled={row.prevDisabled || loading}
                            className={`w-full max-w-40 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                              row.prevDisabled
                                ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                                : "bg-white"
                            } appearance-none`}
                            min="0"
                            step="1"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            value={row.current}
                            onChange={(e) =>
                              handleCurrentChange(index, e.target.value)
                            }
                            className={`w-full max-w-40 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                              isInvalid
                                ? "border-red-500 ring-2 ring-red-200"
                                : "border-gray-300"
                            } appearance-none`}
                            disabled={loading}
                            required
                            min="0"
                            step="1"
                            placeholder="Введите показание"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`font-semibold ${
                              row.diff > 0 ? "text-green-600" : "text-gray-500"
                            }`}>
                            {row.diff}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`font-semibold ${
                              row.sum > 0 ? "text-blue-600" : "text-gray-500"
                            }`}>
                            {row.sum.toLocaleString("ru-RU", {
                              minimumFractionDigits: 2,
                            })}{" "}
                            ₽
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {isInvalid ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <svg
                                className="w-4 h-4 mr-1"
                                fill="currentColor"
                                viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Ошибка
                            </span>
                          ) : row.current === "" ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Ожидание
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <svg
                                className="w-4 h-4 mr-1"
                                fill="currentColor"
                                viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Готово
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Итоговая информация */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-lg font-semibold text-blue-900">
                    Итог за день (м³)
                  </h4>
                  <p className="text-blue-700 text-sm">
                    Суммарный расход по всем шлангам
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-900">
                    {total.toLocaleString()}
                  </div>
                  <div className="text-blue-700 font-medium">м³</div>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-lg font-semibold text-green-900">
                    Итог за день (₽)
                  </h4>
                  <p className="text-green-700 text-sm">
                    Суммарная стоимость по всем шлангам
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-green-900">
                    {totalSum.toLocaleString("ru-RU", {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-green-700 font-medium">руб.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Сообщения о статусе */}
          <div className="mb-6 space-y-2">
            {!allFilled && (
              <div className="flex items-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <svg
                  className="w-5 h-5 text-yellow-600 mr-3"
                  fill="currentColor"
                  viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-yellow-800">
                  Заполните все текущие показания
                </span>
              </div>
            )}
            {anyInvalid && (
              <div className="flex items-center p-4 bg-red-50 border border-red-200 rounded-lg">
                <svg
                  className="w-5 h-5 text-red-600 mr-3"
                  fill="currentColor"
                  viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-red-800">
                  Исправьте показания, где текущее значение меньше предыдущего
                </span>
              </div>
            )}
          </div>

          {/* Кнопки */}
          <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50">
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Сохранение...
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Сохранить отчет
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddHoseReportModal;
