import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  orderBy,
  limit,
} from "firebase/firestore";
import { db, auth } from "../firebase/config";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

const AddPaymentModal = ({ isOpen, onClose, stations, partners, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [selectedStation, setSelectedStation] = useState("");
  const [selectedPartner, setSelectedPartner] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentSum, setPaymentSum] = useState("");
  const [filteredPartners, setFilteredPartners] = useState([]);

  // Фильтрация партнеров при выборе станции
  useEffect(() => {
    if (selectedStation) {
      const filtered = partners.filter(
        (partner) => partner.stationId === selectedStation
      );
      setFilteredPartners(filtered);
      // Сбрасываем выбранного партнера если он не принадлежит выбранной станции
      if (selectedPartner && !filtered.some((p) => p.id === selectedPartner)) {
        setSelectedPartner("");
      }
    } else {
      setFilteredPartners(partners);
    }
  }, [selectedStation, selectedPartner, partners]);

  // Сброс формы
  const resetForm = () => {
    setSelectedStation("");
    setSelectedPartner("");
    setPaymentDate("");
    setPaymentSum("");
    setFilteredPartners(partners);
  };

  // Функция для пересчета всех последующих отчетов
  const updateSubsequentReports = async (
    stationId,
    partnerId,
    paymentDate,
    paymentAmount
  ) => {
    try {
      // Получаем все отчеты начиная с даты оплаты
      const subsequentReportsQuery = query(
        collection(db, "unifiedDailyReports"),
        where("stationId", "==", stationId),
        where("reportDate", ">=", paymentDate),
        orderBy("reportDate", "asc")
      );

      const snapshot = await getDocs(subsequentReportsQuery);
      const reportsToUpdate = [];

      // Собираем отчеты для обновления
      for (const reportDoc of snapshot.docs) {
        const reportData = reportDoc.data();
        const reportPartners = reportData.partnerData || [];

        const partnerIndex = reportPartners.findIndex(
          (p) => p.partnerId === partnerId
        );

        if (partnerIndex >= 0) {
          reportsToUpdate.push({
            doc: reportDoc,
            data: reportData,
            partnerIndex,
            partners: reportPartners,
          });
        }
      }

      // Обновляем отчеты последовательно
      for (const report of reportsToUpdate) {
        const updatedPartners = [...report.partners];
        const partner = updatedPartners[report.partnerIndex];

        // Пересчитываем сальдо
        const startBalance = parseFloat(partner.startBalance) || 0;
        const totalAmount = parseFloat(partner.totalAmount) || 0;
        const currentPaymentSum = parseFloat(partner.paymentSum) || 0;

        // Если это отчет с датой оплаты, добавляем новую оплату
        let newPaymentSum = currentPaymentSum;
        if (report.data.reportDate === paymentDate) {
          newPaymentSum = currentPaymentSum + paymentAmount;
        }

        // Пересчитываем конечное сальдо
        const endBalance = startBalance + totalAmount - newPaymentSum;

        // Обновляем партнера
        updatedPartners[report.partnerIndex] = {
          ...partner,
          paymentSum: newPaymentSum,
          endBalance: endBalance,
        };

        // Если это не первый отчет в цепочке, обновляем startBalance следующего отчета
        const reportIndex = reportsToUpdate.findIndex(
          (r) => r.doc.id === report.doc.id
        );
        if (reportIndex < reportsToUpdate.length - 1) {
          const nextReport = reportsToUpdate[reportIndex + 1];
          const nextPartnerIndex = nextReport.partners.findIndex(
            (p) => p.partnerId === partnerId
          );

          if (nextPartnerIndex >= 0) {
            const nextUpdatedPartners = [...nextReport.partners];
            nextUpdatedPartners[nextPartnerIndex] = {
              ...nextUpdatedPartners[nextPartnerIndex],
              startBalance: endBalance, // startBalance следующего дня = endBalance текущего дня
            };

            // Обновляем следующий отчет
            await updateDoc(doc(db, "unifiedDailyReports", nextReport.doc.id), {
              partnerData: nextUpdatedPartners,
            });
          }
        }

        // Обновляем текущий отчет
        await updateDoc(doc(db, "unifiedDailyReports", report.doc.id), {
          partnerData: updatedPartners,
        });
      }

      return reportsToUpdate.length;
    } catch (error) {
      console.error("Ошибка при обновлении последующих отчетов:", error);
      throw error;
    }
  };

  // Сохранение платежа
  const handleSave = async () => {
    if (!selectedStation || !selectedPartner || !paymentDate || !paymentSum) {
      toast.error("Заполните все обязательные поля");
      return;
    }

    const numericSum = parseFloat(
      paymentSum.replace(/\s/g, "").replace(",", ".")
    );
    if (isNaN(numericSum) || numericSum <= 0) {
      toast.error("Введите корректную сумму");
      return;
    }

    setLoading(true);
    try {
      const userEmail = auth?.currentUser?.email || "unknown";
      const selectedPartnerData = partners.find(
        (p) => p.id === selectedPartner
      );
      const selectedStationData = stations.find(
        (s) => s.id === selectedStation
      );

      if (!selectedPartnerData || !selectedStationData) {
        toast.error("Ошибка при получении данных партнера или станции");
        return;
      }

      // Находим отчет за выбранную дату и станцию
      const reportQuery = query(
        collection(db, "unifiedDailyReports"),
        where("stationId", "==", selectedStation),
        where("reportDate", "==", paymentDate)
      );

      const snapshot = await getDocs(reportQuery);

      if (snapshot.empty) {
        toast.error(`Отчет за дату ${paymentDate} не найден`);
        setLoading(false);
        return;
      }

      const reportDoc = snapshot.docs[0];
      const reportData = reportDoc.data();
      const reportPartners = reportData.partnerData || [];

      // Проверяем существует ли партнер в отчете
      const existingPartnerIndex = reportPartners.findIndex(
        (p) => p.partnerId === selectedPartner
      );

      // Создаем объект платежа
      const paymentData = {
        paymentDate: paymentDate,
        paymentSum: numericSum,
        paymentCreatedBy: userEmail,
        paymentCreatedAt: new Date().toISOString(),
      };

      let updatedPartners;
      let updatedPartner;

      if (existingPartnerIndex >= 0) {
        // Обновляем существующего партнера
        updatedPartners = [...reportPartners];
        const existingPartner = updatedPartners[existingPartnerIndex];

        // Получаем текущие значения
        const currentStartBalance =
          parseFloat(existingPartner.startBalance) || 0;
        const currentTotalAmount = parseFloat(existingPartner.totalAmount) || 0;
        const currentPaymentSum = parseFloat(existingPartner.paymentSum) || 0;

        // Добавляем новую оплату к существующей
        const newPaymentSum = currentPaymentSum + numericSum;

        // Пересчитываем конечное сальдо
        const newEndBalance =
          currentStartBalance + currentTotalAmount - newPaymentSum;

        updatedPartner = {
          ...existingPartner,
          paymentSum: newPaymentSum,
          endBalance: newEndBalance,
          ...paymentData,
        };

        updatedPartners[existingPartnerIndex] = updatedPartner;
      } else {
        // Добавляем нового партнера с оплатой
        // Находим startBalance из предыдущего отчета
        let startBalance = 0;

        // Ищем предыдущий отчет для получения endBalance как startBalance
        const previousReportQuery = query(
          collection(db, "unifiedDailyReports"),
          where("stationId", "==", selectedStation),
          where("reportDate", "<", paymentDate),
          orderBy("reportDate", "desc"),
          limit(1)
        );

        const previousSnapshot = await getDocs(previousReportQuery);
        if (!previousSnapshot.empty) {
          const previousReport = previousSnapshot.docs[0].data();
          const previousPartner = previousReport.partnerData?.find(
            (p) => p.partnerId === selectedPartner
          );
          if (previousPartner) {
            startBalance = parseFloat(previousPartner.endBalance) || 0;
          }
        }

        // Создаем нового партнера
        updatedPartner = {
          partnerId: selectedPartner,
          partnerName: selectedPartnerData.partner,
          contractNumber: selectedPartnerData.contractNumber,
          startBalance: startBalance,
          pricePerM3: 0,
          soldM3: 0,
          totalAmount: 0,
          paymentSum: numericSum,
          endBalance: startBalance - numericSum, // totalAmount = 0, поэтому endBalance = startBalance - paymentSum
          ...paymentData,
        };

        updatedPartners = [...reportPartners, updatedPartner];
      }

      // Обновляем текущий отчет
      await updateDoc(doc(db, "unifiedDailyReports", reportDoc.id), {
        partnerData: updatedPartners,
        hasPartnerData: true,
      });

      // Обновляем все последующие отчеты
      const updatedReportsCount = await updateSubsequentReports(
        selectedStation,
        selectedPartner,
        paymentDate,
        numericSum
      );

      toast.success(
        `Оплата успешно сохранена. Обновлено ${updatedReportsCount} отчетов`
      );
      resetForm();
      onSaved();
      onClose();
    } catch (error) {
      console.error("Ошибка сохранения оплаты:", error);
      toast.error("Ошибка при сохранении оплаты");
    } finally {
      setLoading(false);
    }
  };

  // Форматирование числа
  const formatNumberInput = (value) => {
    if (value === "" || value === null || value === undefined) return "";
    const cleaned = value.toString().replace(/[^\d,.]/g, "");
    const number = parseFloat(cleaned.replace(",", "."));
    if (isNaN(number)) return cleaned;
    return number.toLocaleString("ru-RU", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
  };

  const handlePaymentSumChange = (value) => {
    const formattedValue = formatNumberInput(value);
    setPaymentSum(formattedValue);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex justify-center items-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}>
          <motion.div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}>
            {/* Заголовок */}
            <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <h3 className="text-xl font-semibold text-center">
                Добавление оплаты партнеру
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {/* Выбор станции */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Станция *
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  disabled={loading}>
                  <option value="">Выберите станцию...</option>
                  {stations.map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.stationName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Выбор партнера */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Партнер *
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={selectedPartner}
                  onChange={(e) => setSelectedPartner(e.target.value)}
                  disabled={loading || !selectedStation}>
                  <option value="">Выберите партнера...</option>
                  {filteredPartners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.partner} ({partner.contractNumber})
                    </option>
                  ))}
                </select>
                {selectedStation && filteredPartners.length === 0 && (
                  <p className="text-sm text-orange-600 mt-1">
                    На выбранной станции нет прикрепленных партнеров
                  </p>
                )}
              </div>

              {/* Дата оплаты */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Дата оплаты *
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Сумма оплаты */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Сумма оплаты *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner"
                  value={paymentSum}
                  onChange={(e) => handlePaymentSumChange(e.target.value)}
                  disabled={loading}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Кнопки */}
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                disabled={loading}>
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={
                  loading ||
                  !selectedStation ||
                  !selectedPartner ||
                  !paymentDate ||
                  !paymentSum
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddPaymentModal;
