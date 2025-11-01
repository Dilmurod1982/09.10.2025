import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../lib/zustand";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import AddPaymentModal from "../components/AddPaymentModal";

const Payments = () => {
  const userData = useAppStore((state) => state.userData);
  const [stations, setStations] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Генерация месяцев
  const monthOptions = useMemo(() => {
    const options = [];
    const currentDate = new Date();
    const startDate = new Date(2025, 0, 1);

    for (
      let date = new Date(startDate);
      date <= currentDate;
      date.setMonth(date.getMonth() + 1)
    ) {
      const year = date.getFullYear();
      const month = date.getMonth();
      const value = `${year}-${String(month + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("ru-RU", {
        year: "numeric",
        month: "long",
      });
      options.push({ value, label });
    }

    return options.reverse();
  }, []);

  // Загрузка станций
  useEffect(() => {
    const fetchStations = async () => {
      if (!userData?.stations?.length) return;

      try {
        const snapshot = await getDocs(collection(db, "stations"));
        const matched = snapshot.docs
          .filter((doc) => userData.stations.includes(doc.id))
          .map((doc) => ({ id: doc.id, ...doc.data() }));

        setStations(matched);
      } catch (error) {
        console.error("Ошибка при загрузке станций:", error);
      }
    };

    fetchStations();
  }, [userData]);

  // Загрузка контрактов
  useEffect(() => {
    const fetchContracts = async () => {
      if (!userData?.stations?.length) return;

      try {
        const contractsQuery = query(
          collection(db, "contracts"),
          where("stationId", "in", userData.stations)
        );

        const snapshot = await getDocs(contractsQuery);
        const contractsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setContracts(contractsData);
      } catch (error) {
        console.error("Ошибка при загрузке контрактов:", error);
      }
    };

    fetchContracts();
  }, [userData, refreshTrigger]);

  // Загрузка платежей из контрактов
  useEffect(() => {
    if (!selectedMonth) {
      setPayments([]);
      return;
    }

    const fetchPayments = async () => {
      setLoading(true);
      try {
        const [year, month] = selectedMonth.split("-");
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-31`;

        let stationIds = [];
        if (selectedStation) {
          stationIds = [selectedStation.id];
        } else {
          stationIds = userData?.stations || [];
        }

        if (stationIds.length === 0) {
          setPayments([]);
          return;
        }

        // Фильтруем контракты по выбранным станциям
        const filteredContracts = contracts.filter((contract) =>
          stationIds.includes(contract.stationId)
        );

        // Извлекаем платежи из массива transactions каждого контракта
        const paymentsData = [];

        filteredContracts.forEach((contract) => {
          const {
            id: contractId,
            partner,
            contractNumber,
            stationId,
            station: stationName,
            transactions = [],
          } = contract;

          // Фильтруем по выбранному партнеру
          if (selectedPartner && contractId !== selectedPartner.id) {
            return;
          }

          // Обрабатываем транзакции контракта
          transactions.forEach((transaction, index) => {
            const transactionDate = transaction.reportDate;

            // Проверяем, что транзакция входит в выбранный месяц
            if (transactionDate >= startDate && transactionDate <= endDate) {
              const paymentSum = parseFloat(transaction.paymentSum) || 0;

              // Добавляем платеж только если есть сумма оплаты
              if (paymentSum > 0) {
                paymentsData.push({
                  id: `${contractId}_${index}`,
                  contractId,
                  stationId,
                  stationName,
                  reportDate: transaction.reportDate,
                  paymentDate:
                    transaction.paymentCreatedAt ||
                    transaction.createdAt ||
                    transaction.reportDate,
                  paymentSum: paymentSum,
                  createdBy:
                    transaction.paymentCreatedBy ||
                    transaction.createdBy ||
                    "unknown",
                  createdAt:
                    transaction.paymentCreatedAt || transaction.createdAt,
                  partnerName: partner,
                  partnerId: contractId,
                  contractNumber: contractNumber,
                  transactionData: transaction, // Сохраняем всю транзакцию для дополнительной информации
                });
              }
            }
          });
        });

        // Сортируем платежи по дате
        paymentsData.sort(
          (a, b) => new Date(b.paymentDate) - new Date(a.paymentDate)
        );

        setPayments(paymentsData);
      } catch (error) {
        console.error("Ошибка при загрузке платежей:", error);
        setPayments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, [
    selectedStation,
    selectedPartner,
    selectedMonth,
    refreshTrigger,
    userData,
    contracts,
  ]);

  // Получаем список партнеров из контрактов
  const partners = useMemo(() => {
    return contracts.map((contract) => ({
      id: contract.id,
      partner: contract.partner,
      contractNumber: contract.contractNumber,
      stationId: contract.stationId,
      stationName: contract.station,
    }));
  }, [contracts]);

  // Фильтрация партнеров по выбранной станции
  const filteredPartners = useMemo(() => {
    if (selectedStation) {
      return partners.filter(
        (partner) => partner.stationId === selectedStation.id
      );
    }
    return partners;
  }, [partners, selectedStation]);

  // Форматирование даты
  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString; // Возвращаем оригинальную строку если дата невалидна
      }
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      return dateString;
    }
  };

  // Форматирование суммы
  const formatAmount = (amount) => {
    const num = parseFloat(amount) || 0;
    return num.toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Обновление данных после сохранения
  const handleSaveSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Экспорт в Excel
  const exportToExcel = () => {
    if (!payments.length) return;

    const worksheetData = [
      ["Платежи партнерам"],
      [
        selectedStation
          ? `Станция: ${selectedStation.stationName}`
          : `Все станции`,
      ],
      [
        selectedPartner
          ? `Партнер: ${selectedPartner.partner}`
          : `Все партнеры`,
      ],
      [
        `Период: ${new Date(selectedMonth + "-01").toLocaleDateString("ru-RU", {
          month: "long",
          year: "numeric",
        })}`,
      ],
      [],
      [
        "Станция",
        "Партнер",
        "Договор",
        "Дата отчета",
        "Дата оплаты",
        "Сумма оплаты",
        "Внесен пользователем",
        "Дата создания",
      ],
      ...payments.map((payment) => [
        payment.stationName,
        payment.partnerName,
        payment.contractNumber,
        formatDate(payment.reportDate),
        formatDate(payment.paymentDate),
        formatAmount(payment.paymentSum),
        payment.createdBy,
        formatDate(payment.createdAt),
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Платежи");

    const colWidths = [
      { wch: 20 }, // Станция
      { wch: 20 }, // Партнер
      { wch: 15 }, // Договор
      { wch: 12 }, // Дата отчета
      { wch: 12 }, // Дата оплаты
      { wch: 15 }, // Сумма оплаты
      { wch: 20 }, // Пользователь
      { wch: 15 }, // Дата создания
    ];

    ws["!cols"] = colWidths;

    const fileName = `Платежи_${selectedMonth}`;
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Платежи партнерам
          </h1>
          <p className="text-gray-600">
            Учет платежей партнерам за поставленный газ
          </p>
        </div>

        {/* Панель управления */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Выбор станции */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Станция
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedStation?.id || ""}
                onChange={(e) => {
                  const station = stations.find((s) => s.id === e.target.value);
                  setSelectedStation(station || null);
                }}>
                <option value="">Все станции</option>
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
                Партнер
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedPartner?.id || ""}
                onChange={(e) => {
                  const partner = partners.find((p) => p.id === e.target.value);
                  setSelectedPartner(partner || null);
                }}
                disabled={!selectedStation && stations.length > 0}>
                <option value="">Все партнеры</option>
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

            {/* Выбор месяца */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Месяц *
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}>
                <option value="">Выберите месяц...</option>
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Кнопка добавления */}
            <div className="flex items-end">
              <button
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setShowAddModal(true)}>
                Добавить оплату
              </button>
            </div>
          </div>

          {/* Кнопка экспорта */}
          <div className="flex justify-end">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              onClick={exportToExcel}
              disabled={!payments.length}>
              Экспорт в Excel
            </button>
          </div>
        </div>

        {/* Индикатор загрузки */}
        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Таблица */}
        {!loading && selectedMonth && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Станция
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Дата отчета
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Дата оплаты
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Сумма оплаты
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Внесен пользователем
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Партнер
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Договор
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {payment.stationName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(payment.reportDate)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(payment.paymentDate)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 font-semibold">
                          {formatAmount(payment.paymentSum)} сўм
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {payment.createdBy}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-600">
                          {payment.partnerName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {payment.contractNumber}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Платежи не найдены
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Для выбранных параметров платежи отсутствуют
                </p>
              </div>
            )}
          </div>
        )}

        {/* Сообщение о выборе месяца */}
        {!selectedMonth && !loading && (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md mx-auto">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Выберите месяц
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Выберите месяц для просмотра платежей
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Модальное окно добавления оплаты */}
      <AnimatePresence>
        {showAddModal && (
          <AddPaymentModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            stations={stations}
            partners={partners}
            onSaved={handleSaveSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Payments;
