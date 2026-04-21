import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase/config";
import toast from "react-hot-toast";
import { useAppStore } from "../lib/zustand";
import { useDeviceInfo } from "../hooks/useDeviceInfo";

// Функция для получения IP адреса
const getClientIP = async () => {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch (error) {
    return "Unknown";
  }
};

// Функция для определения квартала по дате
const getQuarterFromDate = (dateString) => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  if (month >= 1 && month <= 3) return "I";
  if (month >= 4 && month <= 6) return "II";
  if (month >= 7 && month <= 9) return "III";
  return "IV";
};

const EditReportModal = ({
  isOpen,
  onClose,
  report,
  collectionName,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [editedReport, setEditedReport] = useState(null);
  const [originalReport, setOriginalReport] = useState(null);
  const [changes, setChanges] = useState([]);
  const [allPaymentMethods, setAllPaymentMethods] = useState([]);
  const userData = useAppStore((state) => state.userData);
  const deviceInfo = useDeviceInfo();

  // Проверка прав доступа
  const canEdit = userData?.email === "dilik@mail.ru";

  // Загрузка всех платежных систем из коллекции paymentMethods
  const fetchPaymentMethods = async () => {
    try {
      const paymentMethodsRef = collection(db, "paymentMethods");
      const snapshot = await getDocs(paymentMethodsRef);
      const methods = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      methods.sort((a, b) => {
        if (a.isActive !== b.isActive) return b.isActive - a.isActive;
        return (a.name || "").localeCompare(b.name || "");
      });
      setAllPaymentMethods(methods);
      return methods;
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      return [];
    }
  };

  // Функция для обновления транзакции партнера в коллекции contracts
  const updatePartnerTransaction = async (
    partner,
    originalPartner,
    reportDate,
    station,
  ) => {
    try {
      const contractRef = doc(db, "contracts", partner.partnerId);
      const contractDoc = await getDoc(contractRef);

      if (!contractDoc.exists()) {
        console.error(`Contract not found for partner: ${partner.partnerId}`);
        return;
      }

      const contractData = contractDoc.data();
      const transactions = contractData.transactions || [];

      // Находим транзакцию за эту дату
      const transactionIndex = transactions.findIndex(
        (t) => t.reportDate === reportDate,
      );

      if (transactionIndex !== -1) {
        // Обновляем существующую транзакцию
        const updatedTransactions = [...transactions];
        updatedTransactions[transactionIndex] = {
          ...updatedTransactions[transactionIndex],
          soldM3: partner.soldM3,
          totalAmount: partner.totalAmount,
          pricePerM3: partner.pricePerM3,
          updatedAt: new Date().toISOString(),
          updatedBy: auth?.currentUser?.email || "unknown",
        };

        await updateDoc(contractRef, {
          transactions: updatedTransactions,
          lastUpdated: serverTimestamp(),
        });
      } else if (partner.soldM3 > 0) {
        // Если транзакции нет, но есть продажи - добавляем новую
        const newTransaction = {
          reportDate: reportDate,
          soldM3: partner.soldM3,
          pricePerM3: partner.pricePerM3,
          totalAmount: partner.totalAmount,
          paymentSum: 0,
          stationId: station.id,
          stationName: station.stationName,
          createdAt: new Date().toISOString(),
          createdBy: auth?.currentUser?.email || "unknown",
        };

        await updateDoc(contractRef, {
          transactions: [...transactions, newTransaction],
          lastUpdated: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error(
        `Error updating partner transaction for ${partner.partnerId}:`,
        error,
      );
      throw error;
    }
  };

  // Инициализация данных для редактирования
  useEffect(() => {
    const initializeData = async () => {
      if (isOpen && report && canEdit) {
        const methods = await fetchPaymentMethods();

        const clonedReport = JSON.parse(JSON.stringify(report));

        if (!clonedReport.paymentData) {
          clonedReport.paymentData = {};
        }

        methods.forEach((method) => {
          if (
            method.dbFieldName &&
            clonedReport.paymentData[method.dbFieldName] === undefined
          ) {
            clonedReport.paymentData[method.dbFieldName] = 0;
          }
        });

        setEditedReport(clonedReport);
        setOriginalReport(JSON.parse(JSON.stringify(report)));
        setChanges([]);
      }
    };

    initializeData();
  }, [isOpen, report, canEdit]);

  // Форматирование даты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Форматирование числа
  const formatNumberForDisplay = (value) => {
    if (value === undefined || value === null) return "0";
    return Number(value).toLocaleString("ru-RU");
  };

  // Парсинг форматированного числа
  const parseFormattedNumber = (value) => {
    if (!value) return 0;
    const stringValue = String(value).replace(/\s/g, "").replace(/,/g, ".");
    return parseFloat(stringValue) || 0;
  };

  // Форматирование ввода числа
  const formatNumberInput = (value) => {
    if (value === "" || value === null || value === undefined) return "";
    const stringValue = String(value);
    const validChars = /^[\d,.]*$/;
    if (!validChars.test(stringValue)) {
      return stringValue.slice(0, -1);
    }
    const parts = stringValue.split(".");
    if (parts.length > 1 && parts[1].length > 2) {
      return parts[0] + "." + parts[1].substring(0, 2);
    }
    return stringValue;
  };

  // Отслеживание изменений
  const trackChange = (field, oldValue, newValue, category) => {
    if (oldValue !== newValue) {
      setChanges((prev) => [
        ...prev,
        {
          category,
          field,
          oldValue,
          newValue,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  // Обработчик изменения общих данных
  const handleGeneralChange = (field, value) => {
    const formattedValue = formatNumberInput(value);
    const numericValue = parseFormattedNumber(formattedValue);
    const oldValue = editedReport.generalData?.[field] || 0;

    if (oldValue !== numericValue) {
      trackChange(field, oldValue, numericValue, "generalData");
      setEditedReport((prev) => ({
        ...prev,
        generalData: {
          ...prev.generalData,
          [field]: numericValue,
        },
      }));
    }
  };

  // Обработчик изменения данных партнера
  const handlePartnerChange = (partnerId, soldM3) => {
    const formattedValue = formatNumberInput(soldM3);
    const numericValue = parseFormattedNumber(formattedValue);

    const partnerIndex = editedReport.partnerData?.findIndex(
      (p) => p.partnerId === partnerId,
    );
    if (partnerIndex === -1) return;

    const oldValue = editedReport.partnerData[partnerIndex].soldM3 || 0;

    if (oldValue !== numericValue) {
      trackChange(
        `partner_${partnerId}_soldM3`,
        oldValue,
        numericValue,
        "partnerData",
      );

      const newPartnerData = [...editedReport.partnerData];
      newPartnerData[partnerIndex] = {
        ...newPartnerData[partnerIndex],
        soldM3: numericValue,
        totalAmount:
          numericValue * (newPartnerData[partnerIndex].pricePerM3 || 0),
      };

      const newPartnerTotalM3 = newPartnerData.reduce(
        (sum, p) => sum + (p.soldM3 || 0),
        0,
      );
      const newPartnerTotalAmount = newPartnerData.reduce(
        (sum, p) => sum + (p.totalAmount || 0),
        0,
      );

      setEditedReport((prev) => ({
        ...prev,
        partnerData: newPartnerData,
        partnerTotalM3: newPartnerTotalM3,
        partnerTotalAmount: newPartnerTotalAmount,
      }));
    }
  };

  // Обработчик изменения платежных данных
  const handlePaymentChange = (paymentKey, value) => {
    const formattedValue = formatNumberInput(value);
    const numericValue = parseFormattedNumber(formattedValue);
    const oldValue = editedReport.paymentData?.[paymentKey] || 0;

    if (oldValue !== numericValue) {
      trackChange(
        `payment_${paymentKey}`,
        oldValue,
        numericValue,
        "paymentData",
      );
      setEditedReport((prev) => ({
        ...prev,
        paymentData: {
          ...prev.paymentData,
          [paymentKey]: numericValue,
        },
      }));
    }
  };

  // Сохранение изменений
  const handleSave = async () => {
    if (!canEdit) {
      toast.error("Сизда ҳисоботни ўзгартириш ҳуқуқи йўқ");
      return;
    }

    if (changes.length === 0) {
      toast.info("Ўзгаришлар топилмади");
      onClose();
      return;
    }

    setLoading(true);

    try {
      const ip = await getClientIP();
      const userEmail = auth?.currentUser?.email || "unknown";
      const computerName = deviceInfo.computerName;
      const macAddress = deviceInfo.macAddress;
      const deviceId = deviceInfo.deviceId;

      // 1. Обновляем данные в коллекции unifiedDailyReports_{квартал}_{год}
      const updateData = {
        generalData: editedReport.generalData,
        partnerData: editedReport.partnerData,
        paymentData: editedReport.paymentData,
        partnerTotalM3: editedReport.partnerTotalM3,
        partnerTotalAmount: editedReport.partnerTotalAmount,
        updatedBy: userEmail,
        updatedAt: new Date().toISOString(),
        updatedIp: ip,
        updatedComputerName: computerName,
        updatedMacAddress: macAddress,
        updatedDeviceId: deviceId,
        editHistory: [
          ...(editedReport.editHistory || []),
          {
            changes: changes,
            changedBy: userEmail,
            changedAt: new Date().toISOString(),
            ip: ip,
            computerName: computerName,
            macAddress: macAddress,
            deviceId: deviceId,
          },
        ],
      };

      const reportRef = doc(db, collectionName, report.id);
      await updateDoc(reportRef, updateData);

      // 2. Обновляем данные партнеров в коллекции contracts
      const station = {
        id: editedReport.stationId,
        stationName: editedReport.stationName,
      };

      // Обновляем только тех партнеров, у которых изменились данные
      const changedPartners = changes
        .filter((change) => change.category === "partnerData")
        .map((change) => {
          const partnerId = change.field
            .replace("partner_", "")
            .replace("_soldM3", "");
          return partnerId;
        })
        .filter((value, index, self) => self.indexOf(value) === index);

      for (const partnerId of changedPartners) {
        const updatedPartner = editedReport.partnerData.find(
          (p) => p.partnerId === partnerId,
        );
        const originalPartner = originalReport.partnerData.find(
          (p) => p.partnerId === partnerId,
        );

        if (updatedPartner && originalPartner) {
          await updatePartnerTransaction(
            updatedPartner,
            originalPartner,
            editedReport.reportDate,
            station,
          );
        }
      }

      // Также обновляем всех партнеров, у которых soldM3 > 0 (на случай если данные изменились но не попали в changes)
      for (const partner of editedReport.partnerData) {
        const originalPartner = originalReport.partnerData.find(
          (p) => p.partnerId === partner.partnerId,
        );
        if (originalPartner && originalPartner.soldM3 !== partner.soldM3) {
          await updatePartnerTransaction(
            partner,
            originalPartner,
            editedReport.reportDate,
            station,
          );
        }
      }

      // Логируем изменения в отдельную коллекцию
      const changeLogRef = collection(db, "reportChangeLogs");
      await addDoc(changeLogRef, {
        reportId: report.id,
        collectionName,
        originalReport: {
          generalData: originalReport.generalData,
          partnerData: originalReport.partnerData,
          paymentData: originalReport.paymentData,
          partnerTotalM3: originalReport.partnerTotalM3,
          partnerTotalAmount: originalReport.partnerTotalAmount,
        },
        updatedData: {
          generalData: editedReport.generalData,
          partnerData: editedReport.partnerData,
          paymentData: editedReport.paymentData,
          partnerTotalM3: editedReport.partnerTotalM3,
          partnerTotalAmount: editedReport.partnerTotalAmount,
        },
        changes,
        changedBy: userEmail,
        changedAt: new Date().toISOString(),
        userIp: ip,
        computerName: computerName,
        macAddress: macAddress,
        deviceId: deviceId,
        reportDate: originalReport.reportDate,
        stationId: originalReport.stationId,
        stationName: originalReport.stationName,
      });

      toast.success(
        "Ҳисобот ва хамкорлар маълумотлари муваффақиятли ўзгартирилди",
      );

      if (onSaved) {
        onSaved();
      }

      onClose();
    } catch (error) {
      console.error("Error saving changes:", error);
      toast.error("Ўзгаришларни сақлашда хатолик");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !editedReport || !canEdit) return null;

  const allPartners = [...(editedReport.partnerData || [])].sort((a, b) => {
    if (a.autoId !== b.autoId) {
      return (a.autoId || 0) - (b.autoId || 0);
    }
    return (a.partnerName || "").localeCompare(b.partnerName || "");
  });

  const activePaymentMethods = allPaymentMethods.filter(
    (m) => m.isActive === 1 && m.dbFieldName !== "zhisobot",
  );
  const zhisobotMethod = allPaymentMethods.find(
    (m) => m.dbFieldName === "zhisobot",
  );

  const getPaymentMethodName = (method) => {
    return method.name || method.dbFieldName || "Номаълум";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Заголовок */}
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold mb-2">
                    Ҳисоботни таҳрирлаш
                  </h2>
                  <p className="text-orange-100 text-lg">
                    {editedReport.stationName} заправкаси -{" "}
                    {formatDate(editedReport.reportDate)}
                  </p>
                  <p className="text-orange-200 text-sm mt-2">
                    ⚠️ Шланглар кўрсаткичларини ўзгартириб бўлмайди
                  </p>
                  <div className="text-orange-200 text-xs mt-2">
                    💻 Компьютер: {deviceInfo.computerName} | ID:{" "}
                    {deviceInfo.deviceId?.substring(0, 8)}...
                  </div>
                  <div className="text-orange-200 text-xs mt-1">
                    📁 Коллекция: {collectionName} | Квартал:{" "}
                    {getQuarterFromDate(editedReport.reportDate)}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-white hover:text-orange-200 transition-colors"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
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

            {/* Контент */}
            <div className="flex-1 overflow-auto p-6">
              <div className="space-y-6">
                {/* Информация о шлангах (только для просмотра) */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="bg-gray-100 p-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-800">
                      Шланглар бўйича ҳисобот (ўзгартириш мумкин эмас)
                    </h3>
                  </div>
                  <div className="p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-200">
                          <tr>
                            <th className="px-4 py-2 text-left">№</th>
                            <th className="px-4 py-2 text-left">Шланг</th>
                            <th className="px-4 py-2 text-left">
                              Охирги кўрсаткич
                            </th>
                            <th className="px-4 py-2 text-left">
                              1 кунда сотилган газ (м³)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {editedReport.hoseData?.map((hose, index) => (
                            <tr key={hose.hose} className="border-b">
                              <td className="px-4 py-2">{index + 1}</td>
                              <td className="px-4 py-2 font-medium">
                                {hose.hose}
                              </td>
                              <td className="px-4 py-2">
                                {formatNumberForDisplay(hose.current)}
                              </td>
                              <td className="px-4 py-2 text-green-600 font-semibold">
                                {formatNumberForDisplay(hose.diff)} м³
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-100">
                          <tr>
                            <td
                              colSpan="3"
                              className="px-4 py-2 font-semibold text-right"
                            >
                              Жами:
                            </td>
                            <td className="px-4 py-2 font-semibold text-green-600">
                              {formatNumberForDisplay(
                                editedReport.hoseTotalGas,
                              )}{" "}
                              м³
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Данные партнеров */}
                <div className="bg-white border border-gray-200 rounded-xl">
                  <div className="bg-gray-50 p-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-800">
                      Хамкорлар бўйича ҳисобот (ўзгартириш мумкин)
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Барча хамкорлар кўрсатилган. Агар газ олинмаган бўлса, 0
                      ёки бўш қолдиринг. Ўзгартирилган маълумотлар contracts
                      коллекциясида ҳам янгиланади.
                    </p>
                  </div>
                  <div className="p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-2 text-left">№</th>
                            <th className="px-4 py-2 text-left">Хамкор номи</th>
                            <th className="px-4 py-2 text-left">Договор №</th>
                            <th className="px-4 py-2 text-left">
                              1 м³ нархи (сўм)
                            </th>
                            <th className="px-4 py-2 text-left">
                              Сотилган газ (м³) *
                            </th>
                            <th className="px-4 py-2 text-left">Сумма (сўм)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allPartners.map((partner, index) => {
                            const isSoldPositive = (partner.soldM3 || 0) > 0;
                            return (
                              <tr
                                key={partner.partnerId}
                                className={`border-b hover:bg-gray-50 ${isSoldPositive ? "bg-green-50" : ""}`}
                              >
                                <td className="px-4 py-2">
                                  {partner.autoId || index + 1}
                                </td>
                                <td className="px-4 py-2 font-medium">
                                  {partner.partnerName}
                                  {isSoldPositive && (
                                    <span className="ml-2 px-2 py-0.5 bg-green-200 text-green-800 text-xs rounded-full">
                                      Газ олинган
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-gray-600">
                                  {partner.contractNumber || "-"}
                                </td>
                                <td className="px-4 py-2">
                                  <div className="font-semibold text-blue-600">
                                    {formatNumberForDisplay(partner.pricePerM3)}{" "}
                                    сўм
                                  </div>
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={
                                      partner.soldM3 === 0
                                        ? ""
                                        : formatNumberForDisplay(partner.soldM3)
                                    }
                                    onChange={(e) =>
                                      handlePartnerChange(
                                        partner.partnerId,
                                        e.target.value,
                                      )
                                    }
                                    className={`w-32 px-2 py-1 border rounded focus:ring-2 focus:ring-orange-500 ${
                                      partner.soldM3 > 0
                                        ? "border-green-400 bg-green-50"
                                        : "border-gray-300"
                                    }`}
                                    placeholder="0"
                                    disabled={loading}
                                  />
                                </td>
                                <td className="px-4 py-2 font-semibold text-blue-600">
                                  {formatNumberForDisplay(partner.totalAmount)}{" "}
                                  сўм
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td
                              colSpan="4"
                              className="px-4 py-2 font-semibold text-right"
                            >
                              Жами:
                            </td>
                            <td className="px-4 py-2 font-semibold">
                              {formatNumberForDisplay(
                                editedReport.partnerTotalM3,
                              )}{" "}
                              м³
                            </td>
                            <td className="px-4 py-2 font-semibold text-blue-600">
                              {formatNumberForDisplay(
                                editedReport.partnerTotalAmount,
                              )}{" "}
                              сўм
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="mt-4 text-xs text-gray-500">
                      * Агар хамкор ушбу кун газ олмаган бўлса, майдонни бўш
                      қолдиринг ёки 0 киритинг.
                      <span className="text-green-600 ml-2">
                        ✅ Яшил фон - газ олинган хамкорлар.
                      </span>
                      <span className="text-orange-600 ml-2">
                        🔄 Ўзгартирилган маълумотлар contracts коллекциясида ҳам
                        янгиланади.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Общие данные */}
                <div className="bg-white border border-gray-200 rounded-xl">
                  <div className="bg-gray-50 p-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-800">
                      Умумий маълумотлар (ўзгартириш мумкин)
                    </h3>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          AutoPilot кўрсаткичи
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formatNumberForDisplay(
                            editedReport.generalData?.autopilotReading,
                          )}
                          onChange={(e) =>
                            handleGeneralChange(
                              "autopilotReading",
                              e.target.value,
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          disabled={loading}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          1 м³ газ нархи (сўм)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formatNumberForDisplay(
                            editedReport.generalData?.gasPrice,
                          )}
                          onChange={(e) =>
                            handleGeneralChange("gasPrice", e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Платежные данные */}
                <div className="bg-white border border-gray-200 rounded-xl">
                  <div className="bg-gray-50 p-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-800">
                      Тўлов маълумотлари (ўзгартириш мумкин)
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Барча фаол тўлов тизимлари кўрсатилган. Ҳар бир тизим учун
                      сумма киритинг.
                    </p>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activePaymentMethods.map((method) => {
                        const value =
                          editedReport.paymentData?.[method.dbFieldName] || 0;
                        return (
                          <div key={method.id}>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {getPaymentMethodName(method)}
                              {method.description && (
                                <span
                                  className="ml-1 text-xs text-gray-400"
                                  title={method.description}
                                >
                                  (i)
                                </span>
                              )}
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={
                                value === 0 ? "" : formatNumberForDisplay(value)
                              }
                              onChange={(e) =>
                                handlePaymentChange(
                                  method.dbFieldName,
                                  e.target.value,
                                )
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                              placeholder="0"
                              disabled={loading}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {zhisobotMethod && (
                      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <svg
                              className="w-5 h-5 text-yellow-600 mr-2"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <div>
                              <div className="font-semibold text-yellow-800">
                                {zhisobotMethod.name || "Z-ҳисобот"}
                              </div>
                              <div className="text-xs text-yellow-700 mt-1">
                                {zhisobotMethod.description ||
                                  "Накд пул тушуми"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-xl font-bold text-yellow-900">
                              {formatNumberForDisplay(
                                editedReport.paymentData?.zhisobot || 0,
                              )}{" "}
                              сўм
                            </div>
                            <button
                              onClick={() => {
                                const hoseTotal =
                                  editedReport.hoseTotalGas || 0;
                                const partnerTotal =
                                  editedReport.partnerTotalM3 || 0;
                                const gasPrice =
                                  editedReport.generalData?.gasPrice || 0;

                                let totalElectronicPayments = 0;
                                activePaymentMethods.forEach((method) => {
                                  totalElectronicPayments +=
                                    editedReport.paymentData?.[
                                      method.dbFieldName
                                    ] || 0;
                                });

                                const calculatedCash =
                                  (hoseTotal - partnerTotal) * gasPrice -
                                  totalElectronicPayments;
                                const newCashValue =
                                  calculatedCash > 0 ? calculatedCash : 0;

                                handlePaymentChange(
                                  "zhisobot",
                                  newCashValue.toString(),
                                );
                                toast.success("Z-ҳисобот автоматик ҳисобланди");
                              }}
                              className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                            >
                              Авто ҳисоблаш
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 text-sm text-yellow-700 bg-yellow-100 p-2 rounded">
                          <div className="font-medium mb-1">
                            Хисоб-китоб формуласи:
                          </div>
                          <div className="text-xs">
                            (Шланглар{" "}
                            {formatNumberForDisplay(editedReport.hoseTotalGas)}{" "}
                            - Хамкорлар{" "}
                            {formatNumberForDisplay(
                              editedReport.partnerTotalM3,
                            )}
                            ) × Газ нархи{" "}
                            {formatNumberForDisplay(
                              editedReport.generalData?.gasPrice,
                            )}{" "}
                            - Барча тўлов тизимлар
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Список изменений */}
                {changes.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl">
                    <div className="bg-yellow-100 p-4 border-b border-yellow-200">
                      <h3 className="text-lg font-semibold text-yellow-800">
                        Ўзгаришлар рўйхати ({changes.length} та)
                      </h3>
                    </div>
                    <div className="p-4">
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {changes.map((change, index) => (
                          <div
                            key={index}
                            className="text-sm text-yellow-800 bg-yellow-100 p-2 rounded"
                          >
                            <span className="font-medium">
                              {change.category === "generalData"
                                ? "📊 Умумий маълумот"
                                : change.category === "partnerData"
                                  ? "🤝 Хамкор"
                                  : change.category === "paymentData"
                                    ? "💰 Тўлов"
                                    : ""}
                              :
                            </span>{" "}
                            {change.field} -
                            <span className="text-red-600 line-through ml-1">
                              {formatNumberForDisplay(change.oldValue)}
                            </span>
                            →
                            <span className="text-green-600 font-bold ml-1">
                              {formatNumberForDisplay(change.newValue)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Кнопки */}
            <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                📊 Жами партнерлар: {allPartners.length} • 💰 Газ олинган:{" "}
                {allPartners.filter((p) => (p.soldM3 || 0) > 0).length} • 📦
                Умумий газ:{" "}
                {formatNumberForDisplay(editedReport.partnerTotalM3)} м³
                <br />
                💳 Тўлов тизимлари: {activePaymentMethods.length} та фаол
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                  disabled={loading}
                >
                  Бекор
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading || changes.length === 0}
                  className={`px-5 py-2 rounded-xl text-white font-semibold transition-colors flex items-center gap-2 ${
                    changes.length > 0 && !loading
                      ? "bg-orange-600 hover:bg-orange-700"
                      : "bg-gray-400 cursor-not-allowed"
                  }`}
                >
                  {loading ? (
                    "Сақланмоқда..."
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Ўзгаришларни сақлаш ({changes.length})
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EditReportModal;
