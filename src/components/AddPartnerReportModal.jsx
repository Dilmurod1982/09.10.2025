import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useAppStore } from "../lib/zustand";

const AddPartnerReportModal = ({
  isOpen,
  onClose,
  stationId,
  stationName,
  contracts,
  reports,
}) => {
  const [reportDate, setReportDate] = useState("");
  const [partnerData, setPartnerData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Получаем данные пользователя из Zustand
  const userData = useAppStore((state) => state.userData);
  const userName = userData?.email || "Неизвестный пользователь";

  // Инициализация данных при открытии модалки
  useEffect(() => {
    if (isOpen && stationId && contracts.length > 0) {
      initializePartnerData();
    }
  }, [isOpen, stationId, contracts]);

  const initializePartnerData = async () => {
    try {
      // Получаем последний отчет для определения даты
      const lastReportQuery = query(
        collection(db, "dailyPartnerReports"),
        where("stationId", "==", stationId),
        orderBy("reportDate", "desc")
      );

      const lastReportSnapshot = await getDocs(lastReportQuery);

      if (lastReportSnapshot.empty) {
        // Первый отчет - дата выбирается вручную
        setReportDate("");
      } else {
        // Следующий отчет - дата автоматически +1 день
        const lastReport = lastReportSnapshot.docs[0].data();
        const lastDate = new Date(lastReport.reportDate);
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + 1);
        setReportDate(nextDate.toISOString().split("T")[0]);
      }

      // Получаем последний отчет для цен
      const lastReportData = lastReportSnapshot.empty
        ? null
        : lastReportSnapshot.docs[0].data();

      // Инициализируем данные партнеров
      const initializedData = contracts.map((contract) => {
        const lastPartnerData = lastReportData?.partnerData?.find(
          (p) => p.partnerId === contract.id
        );

        return {
          partnerId: contract.id,
          partnerName: contract.partner,
          contractNumber: contract.contractNumber,
          pricePerM3: lastPartnerData?.pricePerM3 || 0,
          soldM3: 0,
          totalAmount: 0,
        };
      });

      setPartnerData(initializedData);
    } catch (error) {
      console.error("Ошибка инициализации данных:", error);
      toast.error("Ошибка при загрузке данных");
    }
  };

  const handlePriceChange = (partnerId, newPrice) => {
    setPartnerData((prev) =>
      prev.map((partner) =>
        partner.partnerId === partnerId
          ? {
              ...partner,
              pricePerM3: parseFloat(newPrice) || 0,
              totalAmount: partner.soldM3 * (parseFloat(newPrice) || 0),
            }
          : partner
      )
    );
  };

  const handleSoldM3Change = (partnerId, soldM3) => {
    setPartnerData((prev) =>
      prev.map((partner) => {
        if (partner.partnerId === partnerId) {
          const sold = parseFloat(soldM3) || 0;
          const totalAmount = sold * partner.pricePerM3;
          return {
            ...partner,
            soldM3: sold,
            totalAmount: totalAmount,
          };
        }
        return partner;
      })
    );
  };

  const getClientIP = async () => {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error("Ошибка получения IP:", error);
      return "Неизвестно";
    }
  };

  const saveReport = async () => {
    if (!reportDate || !stationId || partnerData.length === 0) {
      toast.error("Заполните все обязательные поля");
      return;
    }

    // Проверяем, что есть хотя бы один партнер с данными
    const hasData = partnerData.some((partner) => partner.soldM3 > 0);
    if (!hasData) {
      toast.error("Введите данные хотя бы для одного партнера");
      return;
    }

    try {
      setLoading(true);

      const clientIP = await getClientIP();

      const reportData = {
        reportDate,
        stationId: stationId,
        stationName: stationName || "Неизвестная станция",
        partnerData,
        createdBy: userName,
        createdAt: new Date(),
        clientIP,
        status: "saving",
      };

      console.log("Сохранение отчета:", reportData);

      // Сохраняем отчет
      const docRef = await addDoc(
        collection(db, "dailyPartnerReports"),
        reportData
      );

      // Обновляем статус
      await updateDoc(docRef, { status: "saved" });

      toast.success("Отчет успешно сохранен!");
      onClose();
    } catch (error) {
      console.error("Ошибка сохранения отчета:", error);
      toast.error("Ошибка при сохранении отчета");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setReportDate("");
    setPartnerData([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Подсчет итогов
  const totals = partnerData.reduce(
    (acc, partner) => {
      acc.totalM3 += partner.soldM3;
      acc.totalAmount += partner.totalAmount;
      return acc;
    },
    { totalM3: 0, totalAmount: 0 }
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex justify-center items-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}>
          <motion.div
            className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-xl font-semibold">
                Новый отчет для {stationName}
              </h3>
            </div>

            <div className="p-6 overflow-auto max-h-[70vh]">
              {/* Дата отчета */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Дата отчета *
                </label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full max-w-xs border border-gray-300 rounded-xl p-3"
                  disabled={reports.length > 0} // Автоматическая дата после первого отчета
                />
                {reports.length > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    Дата устанавливается автоматически (+1 день к последнему
                    отчету)
                  </p>
                )}
              </div>

              {/* Таблица партнеров */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 text-left">Партнер</th>
                      <th className="p-3 text-left">№ договора</th>
                      <th className="p-3 text-right">Цена за 1 м³ (₽)</th>
                      <th className="p-3 text-right">Количество м³</th>
                      <th className="p-3 text-right">Сумма (₽)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partnerData.map((partner, idx) => (
                      <tr
                        key={partner.partnerId}
                        className="border-t hover:bg-gray-50">
                        <td className="p-3">{partner.partnerName}</td>
                        <td className="p-3">{partner.contractNumber}</td>
                        <td className="p-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={partner.pricePerM3}
                            onChange={(e) =>
                              handlePriceChange(
                                partner.partnerId,
                                e.target.value
                              )
                            }
                            className="w-full text-right border border-gray-300 rounded p-2"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={partner.soldM3}
                            onChange={(e) =>
                              handleSoldM3Change(
                                partner.partnerId,
                                e.target.value
                              )
                            }
                            className="w-full text-right border border-gray-300 rounded p-2"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="p-3 text-right font-semibold">
                          {partner.totalAmount.toLocaleString("ru-RU", {
                            minimumFractionDigits: 2,
                          })}{" "}
                          ₽
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Итоги */}
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td className="p-3 font-semibold" colSpan="3">
                        Итого:
                      </td>
                      <td className="p-3 text-right font-semibold">
                        {totals.totalM3.toLocaleString("ru-RU", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        м³
                      </td>
                      <td className="p-3 text-right font-semibold">
                        {totals.totalAmount.toLocaleString("ru-RU", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        ₽
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Всего партнеров: {partnerData.length} | Итого м³:{" "}
                {totals.totalM3.toLocaleString("ru-RU")} | Итого сумма:{" "}
                {totals.totalAmount.toLocaleString("ru-RU")} ₽
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100">
                  Отмена
                </button>
                <button
                  onClick={saveReport}
                  disabled={loading || !reportDate || partnerData.length === 0}
                  className={`px-5 py-2 rounded-xl text-white font-semibold ${
                    reportDate && partnerData.length > 0
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-gray-400 cursor-not-allowed"
                  }`}>
                  {loading ? "Сохранение..." : "Сохранить отчет"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddPartnerReportModal;
