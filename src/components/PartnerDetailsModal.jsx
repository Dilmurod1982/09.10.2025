import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { toast } from "react-hot-toast";

// Узбекские названия месяцев
const UZ_MONTHS = [
  "Январ",
  "Феврал",
  "Март",
  "Апрел",
  "Май",
  "Июн",
  "Июл",
  "Август",
  "Сентябр",
  "Октябр",
  "Ноябр",
  "Декабр",
];

const PartnerDetailsModal = ({ isOpen, onClose, partner, stationName }) => {
  const [turnoverData, setTurnoverData] = useState([]);
  const [paymentsData, setPaymentsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contractData, setContractData] = useState(null);

  // Состояния для выбора периода (дневная/квартальная/годовая оборотка)
  const [periodType, setPeriodType] = useState("month");
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString()
  );
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("");

  // 🤝 Год для месячной оборотки (отдельно от фильтра дневной)
  const [monthlyYear, setMonthlyYear] = useState(
    new Date().getFullYear().toString()
  );

  // Годы для выбора
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = 2025; y <= currentYear; y++) {
      years.push(y.toString());
    }
    return years.reverse();
  }, []);

  const monthOptions = [
    { value: "01", label: "Январ" },
    { value: "02", label: "Феврал" },
    { value: "03", label: "Март" },
    { value: "04", label: "Апрел" },
    { value: "05", label: "Май" },
    { value: "06", label: "Июн" },
    { value: "07", label: "Июл" },
    { value: "08", label: "Август" },
    { value: "09", label: "Сентябр" },
    { value: "10", label: "Октябр" },
    { value: "11", label: "Ноябр" },
    { value: "12", label: "Декабр" },
  ];

  const quarterOptions = [
    { value: "I", label: "I чорак (январ-март)" },
    { value: "II", label: "II чорак (апрел-июн)" },
    { value: "III", label: "III чорак (июл-сентябр)" },
    { value: "IV", label: "IV чорак (октябр-декабр)" },
  ];

  // Сброс месяца/квартала при смене типа периода
  useEffect(() => {
    setSelectedMonth("");
    setSelectedQuarter("");
  }, [periodType]);

  // Установка текущего месяца при первом открытии
  useEffect(() => {
    if (isOpen && periodType === "month") {
      const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");
      setSelectedMonth(currentMonth);
    }
    if (isOpen && periodType === "quarter") {
      const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
      const quarterMap = { 1: "I", 2: "II", 3: "III", 4: "IV" };
      setSelectedQuarter(quarterMap[currentQuarter]);
    }
  }, [isOpen, periodType]);

  // Загрузка полных данных контракта
  useEffect(() => {
    if (!isOpen || !partner || !partner.contractId) return;

    const fetchContractData = async () => {
      try {
        const q = query(
          collection(db, "contracts"),
          where("contractId", "==", partner.contractId)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          setContractData({ id: doc.id, ...doc.data() });
        } else {
          const q2 = query(
            collection(db, "contracts"),
            where("__name__", "==", partner.contractId)
          );
          const snapshot2 = await getDocs(q2);
          if (!snapshot2.empty) {
            const doc = snapshot2.docs[0];
            setContractData({ id: doc.id, ...doc.data() });
          }
        }
      } catch (error) {
        toast.error("Шартнома маълумотларини юклашда хатолик");
      }
    };

    fetchContractData();
  }, [isOpen, partner]);

  // Вспомогательные функции
  const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const formatNumber = (num) => {
    return toNumber(num).toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatNumberM3 = (num) => {
    return toNumber(num).toLocaleString("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const [year, month, day] = String(dateStr).split("-");
    return `${day}.${month}.${year}`;
  };

  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return "—";
    const date = new Date(dateTimeStr);
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const pad2 = (n) => String(n).padStart(2, "0");

  const getLastDayOfMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  const getMaxTransactionDate = (transactions) => {
    if (!transactions || transactions.length === 0) return null;

    let maxDate = null;
    for (const t of transactions) {
      const reportDate = t.reportDate;
      if (reportDate) {
        if (!maxDate || reportDate > maxDate) {
          maxDate = reportDate;
        }
      }
    }
    return maxDate;
  };

  const getDateRange = (maxAllowedDate) => {
    const year = parseInt(selectedYear);
    let startDate, endDate;

    if (periodType === "month" && selectedMonth) {
      const month = parseInt(selectedMonth);
      const lastDay = getLastDayOfMonth(year, month);
      startDate = `${year}-${pad2(month)}-01`;
      endDate = `${year}-${pad2(month)}-${pad2(lastDay)}`;
    } else if (periodType === "quarter" && selectedQuarter) {
      const quarterMap = {
        I: [1, 3],
        II: [4, 6],
        III: [7, 9],
        IV: [10, 12],
      };
      const [startMonth, endMonth] = quarterMap[selectedQuarter];
      const lastDay = getLastDayOfMonth(year, endMonth);
      startDate = `${year}-${pad2(startMonth)}-01`;
      endDate = `${year}-${pad2(endMonth)}-${pad2(lastDay)}`;
    } else if (periodType === "year") {
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
    }

    if (!startDate || !endDate) return [];

    let finalEndDate = endDate;
    if (maxAllowedDate && maxAllowedDate < endDate) {
      finalEndDate = maxAllowedDate;
    }

    const dates = [];
    const current = new Date(startDate);
    const end = new Date(finalEndDate);

    while (current <= end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, "0");
      const day = String(current.getDate()).padStart(2, "0");
      dates.push(`${year}-${month}-${day}`);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  const getFilteredPayments = (transactions, startDate, endDate) => {
    if (!transactions || transactions.length === 0) return [];

    const payments = [];
    for (const t of transactions) {
      const paymentSum = toNumber(t.paymentSum);
      if (paymentSum > 0) {
        const reportDate = t.reportDate;
        if (reportDate && reportDate >= startDate && reportDate <= endDate) {
          payments.push({
            amount: paymentSum,
            paymentDate: reportDate,
            createdAt: t.createdAt,
            createdBy: t.createdBy || t.paymentCreatedBy || "—",
            updatedBy: t.paymentUpdatedBy,
            updatedAt: t.paymentUpdatedAt,
          });
        }
      }
    }

    payments.sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
    return payments;
  };

  const calculateDailyTurnover = (
    dateRange,
    transactions,
    startBalance,
    startBalanceDate
  ) => {
    if (!dateRange.length || !transactions) return [];

    const sortedTransactions = [...transactions].sort((a, b) =>
      (a.reportDate || "").localeCompare(b.reportDate || "")
    );

    const dailyMap = new Map();

    for (const t of sortedTransactions) {
      const date = t.reportDate;
      if (!date) continue;

      if (!dailyMap.has(date)) {
        dailyMap.set(date, { soldM3: 0, totalAmount: 0, paymentSum: 0 });
      }
      const dayData = dailyMap.get(date);
      dayData.soldM3 += toNumber(t.soldM3);
      dayData.totalAmount += toNumber(t.totalAmount);
      dayData.paymentSum += toNumber(t.paymentSum);
    }

    let currentBalance = toNumber(startBalance);
    const turnover = [];

    for (let i = 0; i < dateRange.length; i++) {
      const date = dateRange[i];
      const dayTransactions = dailyMap.get(date) || {
        soldM3: 0,
        totalAmount: 0,
        paymentSum: 0,
      };

      let dayStartBalance;

      if (i === 0 && startBalanceDate && date === startBalanceDate) {
        dayStartBalance = toNumber(startBalance);
      } else if (i === 0) {
        let balance = toNumber(startBalance);
        for (const t of sortedTransactions) {
          const tDate = t.reportDate;
          if (tDate && tDate < date) {
            balance += toNumber(t.totalAmount) - toNumber(t.paymentSum);
          }
        }
        dayStartBalance = balance;
      } else {
        dayStartBalance = turnover[i - 1].dayEndBalance;
      }

      const soldM3 = dayTransactions.soldM3;
      const soldAmount = dayTransactions.totalAmount;
      const paid = dayTransactions.paymentSum;
      const dayEndBalance = dayStartBalance + soldAmount - paid;

      turnover.push({
        date,
        dayStartBalance,
        soldM3,
        soldAmount,
        paid,
        dayEndBalance,
      });

      currentBalance = dayEndBalance;
    }

    return turnover;
  };

  // Загрузка данных для дневной/квартальной/годовой оборотки
  useEffect(() => {
    if (!isOpen || !contractData) return;
    if (periodType === "month" && !selectedMonth) return;
    if (periodType === "quarter" && !selectedQuarter) return;
    if (!selectedYear) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const transactions = contractData.transactions || [];

        const maxTransactionDate = getMaxTransactionDate(transactions);
        const dateRange = getDateRange(maxTransactionDate);

        if (dateRange.length === 0) {
          setTurnoverData([]);
          setPaymentsData([]);
          setLoading(false);
          return;
        }

        const startDate = dateRange[0];
        const endDate = dateRange[dateRange.length - 1];

        const filteredPayments = getFilteredPayments(
          transactions,
          startDate,
          endDate
        );
        setPaymentsData(filteredPayments);

        const startBalance = contractData.startBalance || 0;
        const startBalanceDate = contractData.startBalanceDate;

        const turnover = calculateDailyTurnover(
          dateRange,
          transactions,
          startBalance,
          startBalanceDate
        );
        setTurnoverData(turnover);
      } catch (error) {
        toast.error("Маълумотларни ҳисоблашда хатолик");
        setTurnoverData([]);
        setPaymentsData([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [
    isOpen,
    contractData,
    periodType,
    selectedYear,
    selectedMonth,
    selectedQuarter,
  ]);

  // Итоги по дневной оборотке
  const totals = useMemo(() => {
    return turnoverData.reduce(
      (acc, day) => {
        acc.totalSoldM3 += day.soldM3;
        acc.totalSoldAmount += day.soldAmount;
        acc.totalPaid += day.paid;
        return acc;
      },
      { totalSoldM3: 0, totalSoldAmount: 0, totalPaid: 0 }
    );
  }, [turnoverData]);

  const paymentsTotal = useMemo(() => {
    return paymentsData.reduce((sum, payment) => sum + payment.amount, 0);
  }, [paymentsData]);

  // ============================================================
  // 🤝 ОЙЛИК ОБОРОТ — расчёт по месяцам за выбранный год
  // ============================================================
  const monthlyTurnover = useMemo(() => {
    if (!contractData) return [];

    const transactions = Array.isArray(contractData.transactions)
      ? [...contractData.transactions].sort((a, b) =>
          String(a.reportDate || "").localeCompare(String(b.reportDate || ""))
        )
      : [];

    const startBalance = toNumber(contractData.startBalance);
    const year = parseInt(monthlyYear);

    if (!year) return [];

    const result = [];

    let runningBalance = startBalance;
    let txIndex = 0;

    // сначала учтём все транзакции ДО 1 января выбранного года
    const yearStartDate = `${year}-01-01`;
    while (txIndex < transactions.length) {
      const t = transactions[txIndex];
      const d = t.reportDate;
      if (!d || d >= yearStartDate) break;
      runningBalance += toNumber(t.totalAmount) - toNumber(t.paymentSum);
      txIndex++;
    }

    for (let m = 1; m <= 12; m++) {
      const monthStart = `${year}-${pad2(m)}-01`;
      const lastDay = getLastDayOfMonth(year, m);
      const monthEnd = `${year}-${pad2(m)}-${pad2(lastDay)}`;

      const monthStartBalance = runningBalance;
      let monthSoldM3 = 0;
      let monthSoldAmount = 0;
      let monthPaid = 0;

      while (txIndex < transactions.length) {
        const t = transactions[txIndex];
        const d = t.reportDate;
        if (!d || d > monthEnd) break;
        if (d >= monthStart) {
          monthSoldM3 += toNumber(t.soldM3);
          monthSoldAmount += toNumber(t.totalAmount);
          monthPaid += toNumber(t.paymentSum);
        }
        txIndex++;
      }

      const monthEndBalance = monthStartBalance + monthSoldAmount - monthPaid;

      result.push({
        month: UZ_MONTHS[m - 1],
        monthNumber: m,
        startBalance: monthStartBalance,
        soldM3: monthSoldM3,
        soldAmount: monthSoldAmount,
        paid: monthPaid,
        endBalance: monthEndBalance,
        hasActivity: monthSoldM3 > 0 || monthSoldAmount > 0 || monthPaid > 0,
      });

      runningBalance = monthEndBalance;
    }

    return result;
  }, [contractData, monthlyYear]);

  // Итоги по месячной оборотке
  const monthlyTotals = useMemo(() => {
    return monthlyTurnover.reduce(
      (acc, m) => {
        acc.totalSoldM3 += m.soldM3;
        acc.totalSoldAmount += m.soldAmount;
        acc.totalPaid += m.paid;
        return acc;
      },
      { totalSoldM3: 0, totalSoldAmount: 0, totalPaid: 0 }
    );
  }, [monthlyTurnover]);

  // Стиль для сальдо
  const balanceClass = (val) => {
    const n = toNumber(val);
    if (n > 0) return "text-red-600";
    if (n < 0) return "text-green-600";
    return "text-gray-700";
  };

  // Печать
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");

    const getPeriodLabel = () => {
      if (periodType === "month") {
        const month = monthOptions.find(
          (m) => m.value === selectedMonth
        )?.label;
        return `${month} ${selectedYear}`;
      }
      if (periodType === "quarter") {
        const quarter = quarterOptions.find(
          (q) => q.value === selectedQuarter
        )?.label;
        return `${quarter} ${selectedYear}`;
      }
      return `${selectedYear} йил`;
    };

    printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Ҳамкор маълумотлари - ${partner.partnerName}</title>
        <style>
          @page { size: A4 landscape; margin: 0.5cm; }
          body { font-family: Arial, sans-serif; font-size: 10px; line-height: 1.2; margin: 0; padding: 0; }
          .container { max-width: 100%; padding: 5px; }
          .header { text-align: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #2563eb; page-break-after: avoid; }
          .header h1 { font-size: 14px; margin: 0 0 5px; color: #2563eb; font-weight: bold; }
          .header p { margin: 2px 0; color: #374151; font-size: 9px; }
          .info-section { margin-bottom: 10px; border: 1px solid #d1d5db; border-radius: 4px; padding: 8px; page-break-inside: avoid; page-break-after: avoid; }
          .info-title { font-size: 11px; font-weight: bold; margin-bottom: 6px; color: #2563eb; }
          .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
          .info-item { display: flex; font-size: 9px; }
          .info-label { font-weight: bold; width: 120px; flex-shrink: 0; }
          .info-value { color: #374151; word-break: break-word; }
          .table-container { margin-bottom: 15px; page-break-inside: avoid; }
          .table-title { font-size: 11px; font-weight: bold; margin-bottom: 6px; color: #2563eb; background-color: #f3f4f6; padding: 6px; border-radius: 4px; page-break-after: avoid; }
          table { width: 100%; border-collapse: collapse; font-size: 8px; page-break-inside: auto; }
          thead { display: table-header-group; }
          tbody { display: table-row-group; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th, td { border: 1px solid #9ca3af; padding: 4px 3px; text-align: right; }
          th:first-child, td:first-child { text-align: center; width: 30px; }
          th:nth-child(2), td:nth-child(2) { text-align: center; width: 70px; }
          th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
          tfoot td { background-color: #f3f4f6; font-weight: bold; }
          .text-red-600 { color: #dc2626; }
          .text-green-600 { color: #16a34a; }
          .footer { margin-top: 15px; text-align: center; font-size: 8px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Ҳамкор маълумотлари ва оборот ҳисоботи</h1>
            <p>${stationName || "Заправка"} | ${getPeriodLabel()}</p>
            <p>Ҳисобот санаси: ${new Date().toLocaleDateString("ru-RU")}</p>
          </div>
          
          <div class="info-section">
            <div class="info-title">📋 Ҳамкор маълумотлари</div>
            <div class="info-grid">
              <div class="info-item"><span class="info-label">Ҳамкор номи:</span><span class="info-value">${
                partner.partnerName || "—"
              }</span></div>
              <div class="info-item"><span class="info-label">ИНН:</span><span class="info-value">${
                partner.inn || "—"
              }</span></div>
              <div class="info-item"><span class="info-label">Раҳбар ФИО:</span><span class="info-value">${
                partner.director || "—"
              }</span></div>
              <div class="info-item"><span class="info-label">ШХР:</span><span class="info-value">${
                partner.shhr || "—"
              }</span></div>
              <div class="info-item"><span class="info-label">Р/счет:</span><span class="info-value">${
                partner.bankAccount || "—"
              }</span></div>
              <div class="info-item"><span class="info-label">Шартнома №:</span><span class="info-value">${
                partner.contractNumber || "—"
              }</span></div>
              <div class="info-item"><span class="info-label">Шартнома санаси:</span><span class="info-value">${formatDate(
                partner.contractDate
              )}</span></div>
              <div class="info-item"><span class="info-label">Шартнома тугаш санаси:</span><span class="info-value">${formatDate(
                partner.contractEndDate
              )}</span></div>
              <div class="info-item"><span class="info-label">Станция:</span><span class="info-value">${
                stationName || partner.stationName || "—"
              }</span></div>
              <div class="info-item"><span class="info-label">Бошланғич сальдо:</span><span class="info-value">${formatNumber(
                partner.startBalance || 0
              )} сўм</span></div>
              <div class="info-item"><span class="info-label">Сальдо санаси:</span><span class="info-value">${formatDate(
                partner.startBalanceDate
              )}</span></div>
            </div>
          </div>

          <div class="table-container">
            <div class="table-title">📅 Ойлик оборот (${monthlyYear} йил)</div>
            <table>
              <thead>
                <tr>
                  <th>№</th>
                  <th>Ой</th>
                  <th>Ой бошига сальдо (сўм)</th>
                  <th>Заправлено м³</th>
                  <th>Заправлено сум</th>
                  <th>Тўланди (сўм)</th>
                  <th>Ой охирига сальдо (сўм)</th>
                </tr>
              </thead>
              <tbody>
                ${monthlyTurnover
                  .map(
                    (m, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${m.month}</td>
                    <td class="${
                      m.startBalance > 0
                        ? "text-red-600"
                        : m.startBalance < 0
                        ? "text-green-600"
                        : ""
                    }">${formatNumber(m.startBalance)}</td>
                    <td>${formatNumberM3(m.soldM3)}</td>
                    <td>${formatNumber(m.soldAmount)}</td>
                    <td style="color:#16a34a;">${formatNumber(m.paid)}</td>
                    <td class="${
                      m.endBalance > 0
                        ? "text-red-600"
                        : m.endBalance < 0
                        ? "text-green-600"
                        : ""
                    }">${formatNumber(m.endBalance)}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="text-align: right;">Жами:</td>
                  <td>${formatNumberM3(monthlyTotals.totalSoldM3)}</td>
                  <td>${formatNumber(monthlyTotals.totalSoldAmount)}</td>
                  <td style="color:#16a34a;">${formatNumber(
                    monthlyTotals.totalPaid
                  )}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="table-container">
            <div class="table-title">📊 Кунлик оборот (${getPeriodLabel()})</div>
            <table>
              <thead>
                <tr>
                  <th>№</th>
                  <th>Кун</th>
                  <th>Бошланғич сальдо (сўм)</th>
                  <th>Сотилган газ (м³)</th>
                  <th>Сотилган газ (сўм)</th>
                  <th>Тўлов (сўм)</th>
                  <th>Охирги сальдо (сўм)</th>
                </tr>
              </thead>
              <tbody>
                ${turnoverData
                  .map(
                    (day, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${formatDate(day.date)}</td>
                    <td class="${
                      day.dayStartBalance > 0
                        ? "text-red-600"
                        : day.dayStartBalance < 0
                        ? "text-green-600"
                        : ""
                    }">${formatNumber(day.dayStartBalance)}</td>
                    <td>${formatNumber(day.soldM3)}</td>
                    <td>${formatNumber(day.soldAmount)}</td>
                    <td>${formatNumber(day.paid)}</td>
                    <td class="${
                      day.dayEndBalance > 0
                        ? "text-red-600"
                        : day.dayEndBalance < 0
                        ? "text-green-600"
                        : ""
                    }">${formatNumber(day.dayEndBalance)}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="text-align: right;">Жами:</td>
                  <td>${formatNumber(totals.totalSoldM3)}</td>
                  <td>${formatNumber(totals.totalSoldAmount)}</td>
                  <td>${formatNumber(totals.totalPaid)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="table-container">
            <div class="table-title">💳 Тўловлар ҳисоботи (${getPeriodLabel()})</div>
            <table>
              <thead>
                <tr>
                  <th>№</th>
                  <th>Сумма (сўм)</th>
                  <th>Тўлов санаси</th>
                  <th>Базага киритилган сана</th>
                  <th>Ким томонидан киритилган</th>
                </tr>
              </thead>
              <tbody>
                ${paymentsData
                  .map(
                    (payment, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${formatNumber(payment.amount)}</td>
                    <td>${formatDate(payment.paymentDate)}</td>
                    <td>${formatDateTime(payment.createdAt)}</td>
                    <td>${payment.createdBy || "—"}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="1" style="text-align: right;">Жами:</td>
                  <td style="font-weight: bold;">${formatNumber(
                    paymentsTotal
                  )} сўм</td>
                  <td colspan="3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          <div class="footer">
            <p>Ҳисобот автоматик тарзда яратилди | ${new Date().toLocaleString()}</p>
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); setTimeout(() => window.close(), 500); }
        </script>
      </body>
    </html>
  `);
    printWindow.document.close();
  };

  if (!isOpen || !partner) return null;

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
            className="bg-white rounded-2xl shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Заголовок */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold">{partner.partnerName}</h2>
                  <p className="text-blue-100 text-sm mt-1">
                    Шартнома №{partner.contractNumber} |{" "}
                    {stationName || "Заправка"}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="text-white hover:text-blue-200"
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

            <div className="flex-1 overflow-auto p-5">
              {/* Информация о партнере */}
              <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Ҳамкор маълумотлари
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">ИНН:</span>{" "}
                    {partner.inn || "—"}
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Раҳбар:</span>{" "}
                    {partner.director || "—"}
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">ШХР:</span>{" "}
                    {partner.shhr || "—"}
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Р/счет:</span>{" "}
                    {partner.bankAccount || "—"}
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">
                      Шартнома санаси:
                    </span>{" "}
                    {formatDate(partner.contractDate)}
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">
                      Тугаш санаси:
                    </span>{" "}
                    {formatDate(partner.contractEndDate)}
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">
                      Бошланғич сальдо:
                    </span>{" "}
                    <span className={balanceClass(partner.startBalance)}>
                      {formatNumber(partner.startBalance || 0)} сўм
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">
                      Сальдо санаси:
                    </span>{" "}
                    {formatDate(partner.startBalanceDate)}
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Файллар:</span>{" "}
                    {partner.files?.length || 0} та
                  </div>
                </div>
              </div>

              {/* ============================================================
                  🤝 ОЙЛИК ОБОРОТ
                  ============================================================ */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-4 py-3 border-b flex flex-wrap justify-between items-center gap-3">
                  <h3 className="font-semibold text-gray-800">
                    📅 Ойлик оборот
                  </h3>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 font-medium">
                      Йил:
                    </label>
                    <select
                      className="px-3 py-1.5 border rounded-lg text-sm"
                      value={monthlyYear}
                      onChange={(e) => setMonthlyYear(e.target.value)}
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-center w-12">№</th>
                        <th className="px-3 py-2 text-left">Ой</th>
                        <th className="px-3 py-2 text-right">
                          Ой бошига сальдо (сўм)
                        </th>
                        <th className="px-3 py-2 text-right">Заправлено м³</th>
                        <th className="px-3 py-2 text-right">Заправлено сум</th>
                        <th className="px-3 py-2 text-right">Тўланди (сўм)</th>
                        <th className="px-3 py-2 text-right">
                          Ой охирига сальдо (сўм)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyTurnover.map((m, idx) => (
                        <tr
                          key={m.monthNumber}
                          className={`border-t ${
                            m.hasActivity ? "hover:bg-gray-50" : "text-gray-400"
                          }`}
                        >
                          <td className="px-3 py-2 text-center">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium">{m.month}</td>
                          <td
                            className={`px-3 py-2 text-right font-mono ${balanceClass(
                              m.startBalance
                            )}`}
                          >
                            {formatNumber(m.startBalance)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-purple-600">
                            {formatNumberM3(m.soldM3)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-blue-600">
                            {formatNumber(m.soldAmount)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-green-600">
                            {formatNumber(m.paid)}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-mono font-semibold ${balanceClass(
                              m.endBalance
                            )}`}
                          >
                            {formatNumber(m.endBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-semibold">
                      <tr>
                        <td colSpan="3" className="px-3 py-2 text-right">
                          Жами:
                        </td>
                        <td className="px-3 py-2 text-right text-purple-600">
                          {formatNumberM3(monthlyTotals.totalSoldM3)}
                        </td>
                        <td className="px-3 py-2 text-right text-blue-600">
                          {formatNumber(monthlyTotals.totalSoldAmount)}
                        </td>
                        <td className="px-3 py-2 text-right text-green-600">
                          {formatNumber(monthlyTotals.totalPaid)}
                        </td>
                        <td className="px-3 py-2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="px-4 py-2 text-xs text-gray-500 border-t bg-gray-50">
                  💡 Сальдо:{" "}
                  <span className="text-red-600 font-semibold">қизил</span> —
                  қарздорлик,{" "}
                  <span className="text-green-600 font-semibold">яшил</span> —
                  олдиндан тўлов
                </div>
              </div>

              {/* Фильтры периода (для дневной/квартальной/годовой оборотки) */}
              <div className="bg-white rounded-xl p-4 mb-5 border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  Кунлик оборот даврини танланг
                </h3>
                <div className="flex flex-wrap gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ҳисобот даври
                    </label>
                    <select
                      className="px-3 py-2 border rounded-lg text-sm"
                      value={periodType}
                      onChange={(e) => setPeriodType(e.target.value)}
                    >
                      <option value="month">Ойлик</option>
                      <option value="quarter">Чораклик</option>
                      <option value="year">Йиллик</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Йил
                    </label>
                    <select
                      className="px-3 py-2 border rounded-lg text-sm"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  {periodType === "month" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ой
                      </label>
                      <select
                        className="px-3 py-2 border rounded-lg text-sm"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                      >
                        <option value="">Танланг</option>
                        {monthOptions.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {periodType === "quarter" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Чорак
                      </label>
                      <select
                        className="px-3 py-2 border rounded-lg text-sm"
                        value={selectedQuarter}
                        onChange={(e) => setSelectedQuarter(e.target.value)}
                      >
                        <option value="">Танланг</option>
                        {quarterOptions.map((q) => (
                          <option key={q.value} value={q.value}>
                            {q.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Таблица оборота (дневная) */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
                <div className="bg-gray-50 px-4 py-2 border-b">
                  <h3 className="font-semibold text-gray-800">
                    📊 Кунлик оборот
                  </h3>
                </div>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : turnoverData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-center">№</th>
                          <th className="px-3 py-2 text-center">Кун</th>
                          <th className="px-3 py-2 text-right">
                            Бошланғич сальдо (сўм)
                          </th>
                          <th className="px-3 py-2 text-right">
                            Сотилган газ (м³)
                          </th>
                          <th className="px-3 py-2 text-right">
                            Сотилган газ (сўм)
                          </th>
                          <th className="px-3 py-2 text-right">Тўлов (сўм)</th>
                          <th className="px-3 py-2 text-right">
                            Охирги сальдо (сўм)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {turnoverData.map((day, idx) => (
                          <tr
                            key={day.date}
                            className="border-t hover:bg-gray-50"
                          >
                            <td className="px-3 py-2 text-center">{idx + 1}</td>
                            <td className="px-3 py-2 text-center font-medium">
                              {formatDate(day.date)}
                            </td>
                            <td
                              className={`px-3 py-2 text-right font-mono ${balanceClass(
                                day.dayStartBalance
                              )}`}
                            >
                              {formatNumber(day.dayStartBalance)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatNumber(day.soldM3)}
                            </td>
                            <td className="px-3 py-2 text-right text-blue-600">
                              {formatNumber(day.soldAmount)}
                            </td>
                            <td className="px-3 py-2 text-right text-green-600">
                              {formatNumber(day.paid)}
                            </td>
                            <td
                              className={`px-3 py-2 text-right font-mono font-semibold ${balanceClass(
                                day.dayEndBalance
                              )}`}
                            >
                              {formatNumber(day.dayEndBalance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 font-semibold">
                        <tr>
                          <td colSpan="3" className="px-3 py-2 text-right">
                            Жами:
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatNumber(totals.totalSoldM3)}
                          </td>
                          <td className="px-3 py-2 text-right text-blue-600">
                            {formatNumber(totals.totalSoldAmount)}
                          </td>
                          <td className="px-3 py-2 text-right text-green-600">
                            {formatNumber(totals.totalPaid)}
                          </td>
                          <td className="px-3 py-2 text-right"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    {!contractData
                      ? "Маълумотлар юкланмоқда..."
                      : "Маълумотлар топилмади. Илтимос, даврни танланг."}
                  </div>
                )}
              </div>

              {/* Таблица платежей */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b">
                  <h3 className="font-semibold text-gray-800">
                    💳 Тўловлар ҳисоботи
                  </h3>
                </div>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : paymentsData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-center">№</th>
                          <th className="px-3 py-2 text-right">Сумма (сўм)</th>
                          <th className="px-3 py-2 text-center">
                            Тўлов санаси
                          </th>
                          <th className="px-3 py-2 text-center">
                            Базага киритилган сана
                          </th>
                          <th className="px-3 py-2 text-left">
                            Ким томонидан киритилган
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentsData.map((payment, idx) => (
                          <tr key={idx} className="border-t hover:bg-gray-50">
                            <td className="px-3 py-2 text-center">{idx + 1}</td>
                            <td className="px-3 py-2 text-right text-green-600 font-semibold">
                              {formatNumber(payment.amount)} сўм
                            </td>
                            <td className="px-3 py-2 text-center">
                              {formatDate(payment.paymentDate)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {formatDateTime(payment.createdAt)}
                            </td>
                            <td className="px-3 py-2 text-left">
                              {payment.createdBy}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 font-semibold">
                        <tr>
                          <td colSpan="1" className="px-3 py-2 text-right">
                            Жами:
                          </td>
                          <td className="px-3 py-2 text-right text-green-600">
                            {formatNumber(paymentsTotal)} сўм
                          </td>
                          <td colSpan="3" className="px-3 py-2"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    {!contractData
                      ? "Маълумотлар юкланмоқда..."
                      : "Тўловлар топилмади"}
                  </div>
                )}
              </div>
            </div>

            {/* Кнопки */}
            <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {turnoverData.length > 0 && `${turnoverData.length} кун`}
                {paymentsData.length > 0 &&
                  ` | ${paymentsData.length} та тўлов`}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Ёпиш
                </button>
                <button
                  onClick={handlePrint}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
                >
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
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                    />
                  </svg>
                  Чоп этиш
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PartnerDetailsModal;
