import React, { useState, useEffect, useCallback } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase/config";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useAppStore } from "../lib/zustand";

const UnifiedReportModal = ({ isOpen, onClose, station, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [reportDate, setReportDate] = useState("");
  const [dateDisabled, setDateDisabled] = useState(false);
  const [savedReportId, setSavedReportId] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  // Данные для всех отчетов
  const [partnerData, setPartnerData] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [hoseRows, setHoseRows] = useState([]);
  const [hoseTotal, setHoseTotal] = useState(0);
  const [hoseTotalSum, setHoseTotalSum] = useState(0);
  const [generalData, setGeneralData] = useState({
    autopilotReading: "",
    gasPrice: "",
    humoTerminal: "",
    uzcardTerminal: "",
    electronicPaymentSystem: "",
  });

  const userData = useAppStore((state) => state.userData);

  // Получаем количество шлангов
  const hosesCount = React.useMemo(() => {
    const d = Array.isArray(station?.dispensers)
      ? station.dispensers.length
      : 0;
    return d * 2;
  }, [station?.dispensers]);

  // Создаем имена шлангов
  const hoseNames = React.useMemo(() => {
    return Array.from({ length: hosesCount }, (_, i) => `Шланг-${i + 1}`);
  }, [hosesCount]);

  // Функция для добавления дней к дате
  const addDays = useCallback((dateString, days) => {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  }, []);

  // Функция для получения данных об обнулениях счетчиков
  const getMeterResetData = useCallback(async (stationId, reportDate) => {
    if (!stationId || !reportDate) {
      return [];
    }

    try {
      // Конвертируем дату отчета из YYYY-MM-DD в DD-MM-YYYY для поиска
      const [year, month, day] = reportDate.split("-");
      const resetDateFormatted = `${day}-${month}-${year}`;

      // Ищем события обнуления для этой станции на дату отчета
      const resetQuery = query(
        collection(db, "meterResetEvents"),
        where("stationId", "==", stationId),
        where("resetDate", "==", resetDateFormatted)
      );

      const snapshot = await getDocs(resetQuery);
      const resetEvents = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return resetEvents;
    } catch (error) {
      return [];
    }
  }, []);

  // Простая функция для ввода чисел с минусом
  const formatNumberInput = (value) => {
    if (value === "" || value === null || value === undefined) return "";

    const stringValue = String(value);
    const validChars = /^-?[\d,.]*$/;

    if (!validChars.test(stringValue)) {
      return stringValue.slice(0, -1);
    }

    if (stringValue.includes("-") && stringValue.indexOf("-") > 0) {
      return stringValue.replace(/-/g, "");
    }

    return stringValue;
  };

  // Функция для отображения отформатированного числа
  const formatNumberForDisplay = (value) => {
    try {
      if (value === "" || value === null || value === undefined) return "";
      if (value === "-") return "-";

      const stringValue = String(value);
      const hasMinus = stringValue.startsWith("-");
      const numberString = hasMinus ? stringValue.substring(1) : stringValue;

      if (numberString === "" || numberString === "0")
        return hasMinus ? "-0" : "0";

      const cleanNumberString = numberString.replace(",", ".");
      const number = parseFloat(cleanNumberString);

      if (isNaN(number)) return stringValue;

      const formatted = number.toLocaleString("ru-RU", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      });

      return hasMinus ? `-${formatted}` : formatted;
    } catch (error) {
      return String(value);
    }
  };

  // Функция для парсинга форматированного числа
  const parseFormattedNumber = (value) => {
    if (!value || value === "-") return 0;

    try {
      const stringValue = String(value);
      const hasMinus = stringValue.startsWith("-");
      const cleaned = stringValue.replace(/\s/g, "").replace(",", ".");

      const numberString = hasMinus ? cleaned.substring(1) : cleaned;
      const number = parseFloat(numberString) || 0;

      return hasMinus ? -number : number;
    } catch (error) {
      return 0;
    }
  };

  // Проверка существующего отчета
  const checkExistingReport = useCallback(async () => {
    if (!station?.id || !reportDate) return false;

    try {
      const reportQuery = query(
        collection(db, "unifiedDailyReports"),
        where("stationId", "==", station.id),
        where("reportDate", "==", reportDate)
      );

      const snapshot = await getDocs(reportQuery);

      if (!snapshot.empty) {
        toast.error("Бу санага ҳисобот мавжуд");
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }, [station?.id, reportDate]);

  // Функция для загрузки и применения данных обнулений
  const loadAndApplyResetData = useCallback(
    async (stationId, reportDate, hasPreviousReport, lastReportSnapshot) => {
      if (!stationId || !reportDate) {
        return [];
      }

      const resetEvents = await getMeterResetData(stationId, reportDate);

      if (resetEvents.length > 0) {
        // Обновляем данные шлангов с учетом обнулений
        setHoseRows((prevRows) =>
          prevRows.map((row) => {
            // Находим обнуления для этого конкретного шланга
            const hoseResetEvents = resetEvents.filter(
              (event) => event.hose === row.hose
            );

            if (hoseResetEvents.length > 0) {
              const latestReset = hoseResetEvents[0];

              return {
                ...row,
                prev: latestReset.newReadingAfterReset,
                hasReset: true,
                resetInfo: latestReset,
              };
            } else {
              // Если обнулений нет, но есть предыдущий отчет - используем данные из отчета
              if (hasPreviousReport && lastReportSnapshot) {
                const lastReport = lastReportSnapshot.docs[0].data();
                const lastHose = lastReport.hoseData?.find(
                  (h) => h.hose === row.hose
                );
                if (lastHose) {
                  return {
                    ...row,
                    prev: lastHose.current || 0,
                    hasReset: false,
                    resetInfo: null,
                  };
                }
              }
              return {
                ...row,
                hasReset: false,
                resetInfo: null,
              };
            }
          })
        );
      }

      return resetEvents;
    },
    [getMeterResetData]
  );

  // Полная функция initializeData с загрузкой контрактов и сортировкой по autoId
  const initializeData = async () => {
    if (!isOpen || !station?.id) return;

    try {
      setLoading(true);

      // Загружаем последний объединенный отчет для определения даты
      const lastReportQuery = query(
        collection(db, "unifiedDailyReports"),
        where("stationId", "==", station.id),
        orderBy("reportDate", "desc"),
        limit(1)
      );

      const lastReportSnapshot = await getDocs(lastReportQuery);
      const hasPreviousReport = !lastReportSnapshot.empty;

      let nextDate = "";
      if (hasPreviousReport) {
        const lastReport = lastReportSnapshot.docs[0].data();
        nextDate = addDays(lastReport.reportDate, 1);
        setReportDate(nextDate);
        setDateDisabled(true);
      } else {
        setReportDate("");
        setDateDisabled(false);
      }

      // Загружаем договоры с сортировкой по autoId
      const contractsQuery = query(
        collection(db, "contracts"),
        where("stationId", "==", station.id)
      );

      const contractsSnapshot = await getDocs(contractsQuery);
      const contractsData = contractsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // СОРТИРОВКА контрактов по autoId
      const sortedContracts = [...contractsData].sort((a, b) => {
        // Получаем autoId, если нет - используем 0
        const autoIdA = a.autoId || 0;
        const autoIdB = b.autoId || 0;

        // Сортировка по возрастанию autoId
        if (autoIdA !== autoIdB) {
          return autoIdA - autoIdB;
        }

        // Если autoId одинаковые, сортируем по названию партнера
        return (a.partner || "").localeCompare(b.partner || "");
      });

      setContracts(sortedContracts);

      // Инициализируем данные партнеров с ценами из последнего отчета
      // Партнеры будут отображаться в том же порядке, что и в sortedContracts
      const initializedPartnerData = sortedContracts.map((contract) => {
        let pricePerM3 = 0;

        if (hasPreviousReport) {
          const lastReport = lastReportSnapshot.docs[0].data();
          const lastPartnerData = lastReport.partnerData?.find(
            (p) => p.partnerId === contract.id
          );
          if (lastPartnerData) {
            pricePerM3 = lastPartnerData.pricePerM3 || 0;
          }
        }

        return {
          partnerId: contract.id,
          partnerName: contract.partner,
          contractNumber: contract.contractNumber,
          pricePerM3: pricePerM3,
          soldM3: "",
          totalAmount: 0,
          autoId: contract.autoId || 0, // Сохраняем autoId для отображения
        };
      });

      setPartnerData(initializedPartnerData);

      // Инициализируем базовые данные шлангов
      const initializedHoseRows = hoseNames.map((name, index) => {
        let prev = 0;
        let price = 0;
        let prevDisabled = false;

        if (hasPreviousReport) {
          const lastReport = lastReportSnapshot.docs[0].data();
          const lastHose = lastReport.hoseData?.find((h) => h.hose === name);

          if (lastHose) {
            prev = lastHose.current || 0;
            price = lastHose.price || 0;
            prevDisabled = true;
          }
        }

        return {
          hose: name,
          prev: prev,
          current: "",
          price: price,
          diff: 0,
          sum: 0,
          prevDisabled: prevDisabled,
          hasReset: false,
          resetInfo: null,
        };
      });

      setHoseRows(initializedHoseRows);

      // Инициализируем общие данные из последнего отчета
      if (hasPreviousReport) {
        const lastReport = lastReportSnapshot.docs[0].data();
        setGeneralData((prev) => ({
          ...prev,
          gasPrice: lastReport.generalData?.gasPrice
            ? lastReport.generalData.gasPrice.toString()
            : "",
        }));
      }

      // Если есть дата отчета, загружаем обнуления
      if (nextDate) {
        await loadAndApplyResetData(
          station.id,
          nextDate,
          hasPreviousReport,
          lastReportSnapshot
        );
      }
    } catch (error) {
      toast.error("Маълумотлар юкланишида хатолик");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      initializeData();
    }
  }, [isOpen, station?.id, hoseNames, addDays]);

  // Перезагрузка данных об обнулениях при изменении даты отчета
  useEffect(() => {
    if (isOpen && station?.id && reportDate) {
      const reloadResetData = async () => {
        try {
          await loadAndApplyResetData(station.id, reportDate, true, null);
        } catch (error) {
          // Ошибка перезагрузки данных обнулений
        }
      };

      reloadResetData();
    }
  }, [reportDate, isOpen, station?.id, loadAndApplyResetData]);

  // ========== ФУНКЦИИ ДЛЯ ОТЧЕТА ПО ПАРТНЕРАМ ==========

  // Обработчик изменения цены
  const handlePartnerPriceChange = (partnerId, newPrice) => {
    const formattedValue = formatNumberInput(newPrice);
    const numericValue = parseFormattedNumber(formattedValue);

    setPartnerData((prev) =>
      prev.map((partner) => {
        if (partner.partnerId === partnerId) {
          const soldM3Value =
            partner.soldM3 === "" ? 0 : parseFormattedNumber(partner.soldM3);
          const totalAmount = soldM3Value * numericValue;

          return {
            ...partner,
            pricePerM3: numericValue,
            totalAmount: totalAmount,
          };
        }
        return partner;
      })
    );
  };

  // Обработчик изменения проданных м³
  const handlePartnerSoldM3Change = (partnerId, soldM3) => {
    if (soldM3 === "") {
      setPartnerData((prev) =>
        prev.map((partner) => {
          if (partner.partnerId === partnerId) {
            const totalAmount = 0;

            return {
              ...partner,
              soldM3: "",
              totalAmount: totalAmount,
            };
          }
          return partner;
        })
      );
      return;
    }

    const formattedValue = formatNumberInput(soldM3);
    const numericValue = parseFormattedNumber(formattedValue);

    setPartnerData((prev) =>
      prev.map((partner) => {
        if (partner.partnerId === partnerId) {
          const totalAmount = numericValue * partner.pricePerM3;

          return {
            ...partner,
            soldM3: formattedValue,
            totalAmount: totalAmount,
          };
        }
        return partner;
      })
    );
  };

  // Подсчет итогов для партнеров
  const partnerTotals = partnerData.reduce(
    (acc, partner) => {
      const soldM3Value =
        partner.soldM3 === "" ? 0 : parseFormattedNumber(partner.soldM3);
      acc.totalM3 += soldM3Value;
      acc.totalAmount += partner.totalAmount;
      return acc;
    },
    { totalM3: 0, totalAmount: 0 }
  );

  // Проверка, есть ли данные для сохранения у партнеров
  const hasPartnerData = () => {
    return partnerData.some((partner) => {
      if (partner.soldM3 === "") return false;
      const numericValue = parseFormattedNumber(partner.soldM3);
      return numericValue > 0;
    });
  };

  // ========== ФУНКЦИИ ДЛЯ ОТЧЕТА ПО ШЛАНГАМ ==========

  // Расчет разницы и суммы для шланга с учетом обнулений
  const calculateHoseRowDiff = useCallback((row) => {
    const prev = Number(row.prev) || 0;
    const current = row.current === "" ? 0 : parseFormattedNumber(row.current);
    const price = Number(row.price) || 0;

    let diff = 0;

    if (row.hasReset && row.resetInfo) {
      // Если есть обнуление, используем специальную формулу:
      // diff = (lastReadingBeforeReset - lastReadingFromReport) + (current - newReadingAfterReset)
      const lastReadingBeforeReset = row.resetInfo.lastReadingBeforeReset;
      const lastReadingFromReport = row.resetInfo.lastReadingFromReport;
      const newReadingAfterReset = row.resetInfo.newReadingAfterReset;

      // Расчет по вашей формуле:
      diff =
        lastReadingBeforeReset -
        lastReadingFromReport +
        (current - newReadingAfterReset);
    } else {
      // Базовая разница без обнулений
      if (current >= prev) {
        diff = current - prev;
      } else {
        // Если текущее меньше предыдущего, но нет обнуления - это ошибка
        diff = 0;
      }
    }

    const sum = diff * price;

    return {
      ...row,
      diff: Math.max(0, isNaN(diff) ? 0 : diff), // Не допускаем отрицательные значения
      sum: Math.max(0, isNaN(sum) ? 0 : sum),
    };
  }, []);

  // Обработчик изменения текущего показания шланга
  const handleHoseCurrentChange = (index, value) => {
    const formattedValue = formatNumberInput(value);

    setHoseRows((prev) => {
      const newRows = [...prev];
      const updatedRow = {
        ...newRows[index],
        current: formattedValue,
      };

      const rowWithDiff = calculateHoseRowDiff(updatedRow);
      newRows[index] = rowWithDiff;

      const totals = newRows.reduce(
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

      setHoseTotal(totals.totalGas);
      setHoseTotalSum(totals.totalSum);

      return newRows;
    });
  };

  // Обработчик изменения цены шланга
  const handleHosePriceChange = (index, value) => {
    const formattedValue = formatNumberInput(value);
    const numericValue = parseFormattedNumber(formattedValue);

    setHoseRows((prev) => {
      const newRows = [...prev];
      const updatedRow = {
        ...newRows[index],
        price: numericValue,
      };

      const rowWithDiff = calculateHoseRowDiff(updatedRow);
      newRows[index] = rowWithDiff;

      const totals = newRows.reduce(
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

      setHoseTotal(totals.totalGas);
      setHoseTotalSum(totals.totalSum);

      return newRows;
    });
  };

  // Валидация отчета по шлангам
  const isHoseReportValid = () => {
    return (
      hoseRows.every(
        (row) =>
          row.current !== "" &&
          !isNaN(parseFormattedNumber(row.current)) &&
          parseFormattedNumber(row.current) >= 0
      ) &&
      !hoseRows.some((row) => {
        const current = parseFormattedNumber(row.current);
        const prev = Number(row.prev);
        return current < prev && !row.hasReset; // Разрешаем текущее меньше предыдущего только если было обнуление
      })
    );
  };

  // ========== ФУНКЦИИ ДЛЯ ОБЩЕГО ОТЧЕТА ==========

  const handleGeneralInputChange = (field, value) => {
    const formattedValue = formatNumberInput(value);
    setGeneralData((prev) => ({
      ...prev,
      [field]: formattedValue,
    }));
  };

  // Расчет наличных
  const calculateCashAmount = () => {
    const gasPrice = parseFormattedNumber(generalData.gasPrice);
    const humoTerminal = parseFormattedNumber(generalData.humoTerminal);
    const uzcardTerminal = parseFormattedNumber(generalData.uzcardTerminal);
    const electronicPaymentSystem = parseFormattedNumber(
      generalData.electronicPaymentSystem
    );

    const cashAmount =
      (hoseTotal - partnerTotals.totalM3) * gasPrice -
      humoTerminal -
      uzcardTerminal -
      electronicPaymentSystem;

    return cashAmount > 0 ? cashAmount : 0;
  };

  // Валидация общего отчета
  const isGeneralReportValid = () => {
    return (
      generalData.autopilotReading &&
      generalData.gasPrice &&
      generalData.humoTerminal !== "" &&
      generalData.uzcardTerminal !== "" &&
      generalData.electronicPaymentSystem !== ""
    );
  };

  // Общая валидация всего отчета
  const isReportValid = () => {
    const hasPartners = partnerData.length > 0;

    // Если есть прикрепленные партнеры, проверяем их данные
    if (hasPartners) {
      const arePartnersValid = partnerData.every((partner) => {
        // Если soldM3 пустая строка - невалидно
        if (partner.soldM3 === "") return false;

        const soldM3Value = parseFormattedNumber(partner.soldM3);
        // Проверяем что значение числовое и неотрицательное
        return !isNaN(soldM3Value) && soldM3Value >= 0;
      });

      // Все должно быть валидно: шланги, общий отчет И партнеры (если они есть)
      return isHoseReportValid() && isGeneralReportValid() && arePartnersValid;
    }

    // Если партнеров нет, проверяем только шланги и общий отчет
    return isHoseReportValid() && isGeneralReportValid();
  };

  // ========== ФУНКЦИИ СОХРАНЕНИЯ ==========

  const getClientIP = async () => {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      const data = await response.json();
      return data.ip;
    } catch (error) {
      return "Номаълум";
    }
  };

  // Функция для сохранения данных партнеров в коллекцию contracts
  const savePartnerDataToContracts = async (partnerDataToSave) => {
    try {
      const savePromises = partnerDataToSave.map(async (partner) => {
        const contractRef = doc(db, "contracts", partner.partnerId);

        // Сначала получаем текущий документ контракта
        const contractDoc = await getDoc(contractRef);
        const currentContract = contractDoc.data();

        const partnerTransactionData = {
          reportDate: reportDate,
          soldM3: partner.soldM3,
          pricePerM3: partner.pricePerM3,
          totalAmount: partner.totalAmount,
          paymentSum: 0, // Добавляем поле для оплаты
          stationId: station.id,
          stationName: station.stationName,
          createdAt: new Date().toISOString(),
          createdBy: auth?.currentUser?.email || "unknown",
        };

        // Получаем текущие транзакции или создаем пустой массив
        const currentTransactions = currentContract.transactions || [];

        // Добавляем новую транзакцию
        const updatedTransactions = [
          ...currentTransactions,
          partnerTransactionData,
        ];

        await updateDoc(contractRef, {
          transactions: updatedTransactions,
          lastUpdated: serverTimestamp(),
        });
      });

      await Promise.all(savePromises);
    } catch (error) {
      throw error;
    }
  };

  // Функция для открытия модального окна подтверждения
  const handleSaveClick = () => {
    if (!isReportValid()) {
      toast.error("Мажбурий тўлдириш қаторларини тўлдиринг");
      return;
    }
    setIsConfirmModalOpen(true);
  };

  // Сохранение объединенного отчета
  const saveUnifiedReport = async () => {
    try {
      setLoading(true);

      // Проверяем существующие отчеты перед сохранением
      const hasExistingReport = await checkExistingReport();
      if (hasExistingReport) {
        setIsConfirmModalOpen(false);
        setLoading(false);
        return;
      }

      // Конвертируем дату отчета для поиска обнулений
      const [year, month, day] = reportDate.split("-");
      const resetDateFormatted = `${day}-${month}-${year}`;

      // Загружаем актуальные данные об обнулениях с правильным форматом даты
      const resetQuery = query(
        collection(db, "meterResetEvents"),
        where("stationId", "==", station.id),
        where("resetDate", "==", resetDateFormatted)
      );

      const resetSnapshot = await getDocs(resetQuery);
      const resetEvents = resetSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const ip = await getClientIP();
      const userEmail = auth?.currentUser?.email || "unknown";

      const cashAmount = calculateCashAmount();

      // Подготавливаем данные шлангов с учетом обнулений
      const hoseData = hoseRows.map((row) => {
        let finalDiff = Number(row.diff) || 0;
        let resetCalculation = null;

        // Проверяем, есть ли обнуления для этого шланга на дату отчета
        const hoseResetEvents = resetEvents.filter(
          (event) => event.hose === row.hose
        );

        if (hoseResetEvents.length > 0) {
          const latestReset = hoseResetEvents[0];

          // Применяем формулу коррекции для финального diff
          const calculatedDiff =
            latestReset.lastReadingBeforeReset -
            latestReset.lastReadingFromReport +
            (parseFormattedNumber(row.current) -
              latestReset.newReadingAfterReset);

          finalDiff = Math.max(0, calculatedDiff);

          resetCalculation = {
            lastReadingBeforeReset: latestReset.lastReadingBeforeReset,
            lastReadingFromReport: latestReset.lastReadingFromReport,
            newReadingAfterReset: latestReset.newReadingAfterReset,
            calculatedDiff: calculatedDiff,
            finalDiff: finalDiff,
          };
        }

        return {
          hose: row.hose,
          prev: Number(row.prev) || 0,
          current: parseFormattedNumber(row.current) || 0,
          price: Number(row.price) || 0,
          diff: finalDiff,
          sum: finalDiff * (Number(row.price) || 0),
          hasResetCorrection: hoseResetEvents.length > 0,
          resetCalculation: resetCalculation,
          resetNote: hoseResetEvents.length > 0 ? "Кўрсаткич нўлланган" : null,
        };
      });

      // Пересчитываем итоги с учетом коррекции обнулений
      const correctedTotals = hoseData.reduce(
        (acc, hose) => {
          return {
            totalGas: acc.totalGas + (hose.diff > 0 ? hose.diff : 0),
            totalSum: acc.totalSum + hose.sum,
          };
        },
        { totalGas: 0, totalSum: 0 }
      );

      // Подготавливаем данные партнеров (только тех, у кого есть данные)
      const partnerDataToSave = partnerData
        .filter((partner) => {
          if (partner.soldM3 === "") return false;
          const numericValue = parseFormattedNumber(partner.soldM3);
          return numericValue > 0;
        })
        .map((partner) => ({
          ...partner,
          soldM3: parseFormattedNumber(partner.soldM3),
          paymentSum: 0, // Добавляем поле для оплаты
          autoId: partner.autoId, // Сохраняем autoId для сохранения порядка
        }));

      // Сохраняем данные партнеров в коллекцию contracts
      if (partnerDataToSave.length > 0) {
        await savePartnerDataToContracts(partnerDataToSave);
      }

      // Создаем объединенный отчет
      const reportData = {
        reportDate,
        stationId: station.id,
        stationName: station.stationName || "Неизвестная станция",

        // Данные партнеров (уже отсортированы по autoId)
        partnerData: partnerDataToSave,
        partnerTotalM3: partnerTotals.totalM3,
        partnerTotalAmount: partnerTotals.totalAmount,
        partnerTotalPaymentSum: 0,
        hasPartnerData: hasPartnerData(),

        // Данные шлангов
        hoseData: hoseData,
        hoseTotalGas: correctedTotals.totalGas,
        hoseTotalSum: correctedTotals.totalSum,

        // Общие данные
        generalData: {
          autopilotReading: parseFormattedNumber(generalData.autopilotReading),
          gasPrice: parseFormattedNumber(generalData.gasPrice),
          humoTerminal: parseFormattedNumber(generalData.humoTerminal),
          uzcardTerminal: parseFormattedNumber(generalData.uzcardTerminal),
          electronicPaymentSystem: parseFormattedNumber(
            generalData.electronicPaymentSystem
          ),
          cashAmount: cashAmount,
          controlTotalSum: 0,
          controlHumoSum: 0,
          controlUzcardSum: 0,
        },

        // Метаданные
        createdBy: userEmail,
        createdAt: serverTimestamp(),
        createdIp: ip,
        status: "completed",
        hasMeterResets: resetEvents.length > 0,
        meterResetEventsCount: resetEvents.length,
      };

      const docRef = await addDoc(
        collection(db, "unifiedDailyReports"),
        reportData
      );
      setSavedReportId(docRef.id);

      // Закрываем модальное окно подтверждения и открываем окно успеха
      setIsConfirmModalOpen(false);
      setIsSuccessModalOpen(true);
    } catch (error) {
      toast.error("Ҳисоботни сақлашда хатолик");
    } finally {
      setLoading(false);
    }
  };

  // Завершение работы с отчетом
  const handleFinish = () => {
    setIsSuccessModalOpen(false);
    // Сбрасываем состояние и закрываем модальное окно
    setPartnerData([]);
    setHoseRows([]);
    setGeneralData({
      autopilotReading: "",
      gasPrice: "",
      humoTerminal: "",
      uzcardTerminal: "",
      electronicPaymentSystem: "",
    });
    setSavedReportId(null);

    // Вызываем callback для обновления списка отчетов
    if (onSaved) {
      onSaved();
    }

    onClose();
  };

  // Сброс формы при отмене
  const handleClose = async () => {
    if (savedReportId) {
      try {
        await deleteDoc(doc(db, "unifiedDailyReports", savedReportId));
      } catch (error) {
        // Ошибка удаления отчета
      }
    }

    setPartnerData([]);
    setHoseRows([]);
    setGeneralData({
      autopilotReading: "",
      gasPrice: "",
      humoTerminal: "",
      uzcardTerminal: "",
      electronicPaymentSystem: "",
    });
    setSavedReportId(null);
    setIsConfirmModalOpen(false);
    setIsSuccessModalOpen(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex justify-center items-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}>
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}>
              {/* Заголовок */}
              <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-semibold">Кунлик ҳисобот</h3>
                    <p className="text-blue-100 mt-1">
                      {station?.stationName} заправкаси
                    </p>
                  </div>
                  <div className="text-sm bg-blue-500 px-3 py-1 rounded-full">
                    {reportDate || "Санани танланг"}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-6">
                {/* Общее поле даты */}
                <div className="mb-6 bg-blue-50 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ҳисобот санаси *
                  </label>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    disabled={dateDisabled || loading}
                    className="w-full max-w-xs border border-gray-300 rounded-xl p-3 disabled:bg-gray-100"
                  />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Правая колонка: Отчет по шлангам */}
                  <div className="space-y-6">
                    <div className="bg-white border border-gray-200 rounded-xl">
                      <div className="p-4 border-b bg-gray-50">
                        <h4 className="text-lg font-semibold">
                          Шланглар бўйича ҳисобот
                        </h4>
                      </div>
                      <div className="p-4">
                        <div className="overflow-x-auto">
                          <table className="w-full table-auto md:table-fixed">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider md:px-3 md:w-1/6">
                                  Шланг
                                </th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider md:px-3 md:w-1/6">
                                  Олдинги кўрсаткич
                                </th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider md:px-3 md:w-1/6">
                                  Жорий кўрсаткич *
                                </th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider md:px-3 md:w-1/6">
                                  Фарқи
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {hoseRows.map((row, index) => {
                                const currentNum = parseFormattedNumber(
                                  row.current
                                );
                                const prevNum = Number(row.prev);
                                const isInvalid =
                                  row.current !== "" &&
                                  currentNum < prevNum &&
                                  !row.hasReset;

                                return (
                                  <tr
                                    key={row.hose}
                                    className={`hover:bg-gray-50 transition-colors ${
                                      row.hasReset ? "bg-yellow-50" : ""
                                    }`}>
                                    <td className="px-3 py-2">
                                      <div className="flex items-center">
                                        <span className="font-semibold text-gray-900 text-xs md:text-sm">
                                          {row.hose}
                                        </span>
                                        {row.hasReset && (
                                          <span
                                            className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full"
                                            title="Кўрсаткич нўлланган">
                                            🔄 Нўлланган
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-2 py-3 md:px-3 md:w-1/6">
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={formatNumberInput(row.prev)}
                                        onChange={(e) => {
                                          const newRows = [...hoseRows];
                                          newRows[index].prev =
                                            parseFormattedNumber(
                                              e.target.value
                                            ) || 0;
                                          setHoseRows(newRows);
                                        }}
                                        disabled={row.prevDisabled || loading}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner text-xs md:text-sm"
                                        placeholder="0"
                                      />
                                    </td>
                                    <td className="px-2 py-3 md:px-3 md:w-1/6">
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={row.current}
                                        onChange={(e) =>
                                          handleHoseCurrentChange(
                                            index,
                                            e.target.value
                                          )
                                        }
                                        className={`w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner text-xs md:text-sm ${
                                          isInvalid
                                            ? "border-red-500 ring-2 ring-red-200"
                                            : "border-gray-300"
                                        }`}
                                        disabled={loading}
                                        required
                                        placeholder="0"
                                      />
                                    </td>
                                    <td className="px-2 py-3 md:px-3 md:w-1/6">
                                      <div className="flex flex-col">
                                        <span
                                          className={`font-semibold text-xs md:text-sm ${
                                            row.diff > 0
                                              ? "text-green-600"
                                              : "text-gray-500"
                                          }`}>
                                          {formatNumberForDisplay(row.diff)}
                                        </span>
                                        {row.hasReset && (
                                          <span className="text-xs text-orange-600 mt-1">
                                            Нўлланиш ҳисоби б-н
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Итоги по шлангам */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          <div className="bg-blue-50 w-full border border-blue-200 rounded-lg p-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="font-semibold text-blue-900 text-sm">
                                  Жами кун давомида (м³)
                                </h4>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold text-blue-900">
                                  {formatNumberForDisplay(hoseTotal)}
                                </div>
                                <div className="text-blue-700 font-medium text-sm">
                                  м³
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Левая колонка: Партнеры и Общий отчет */}
                  <div className="space-y-6">
                    {/* Отчет по партнерам с отображением номера */}
                    <div className="bg-white border border-gray-200 rounded-xl">
                      <div className="p-4 border-b bg-gray-50">
                        <h4 className="text-lg font-semibold">
                          Хамкорлар бўйича ҳисобот{" "}
                          {partnerData.length > 0
                            ? "(тўлдирилиши зарур)"
                            : "(хамкорлар мавжуд эмас)"}
                        </h4>
                      </div>
                      <div className="p-4">
                        {partnerData.length === 0 ? (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                            <p className="text-yellow-700">
                              Бу заправкада хамкорлар мавжуд эмас
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="p-2 text-left w-10">№</th>
                                  <th className="p-2 text-left">Партнер</th>
                                  <th className="p-2 text-right w-24">
                                    1м³ нарх (сўм)
                                  </th>
                                  <th className="p-2 text-right w-24">
                                    Сотилди м³ *
                                  </th>
                                  <th className="p-2 text-right w-24">
                                    Суммаси (сўм)
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {partnerData.map((partner, idx) => (
                                  <tr
                                    key={partner.partnerId}
                                    className="border-t hover:bg-gray-50">
                                    <td className="p-2 text-center text-gray-500 font-medium">
                                      {/* Отображаем autoId или порядковый номер */}
                                      {partner.autoId || idx + 1}
                                    </td>
                                    <td className="p-2">
                                      <div>
                                        <div className="font-medium">
                                          {partner.partnerName}
                                        </div>
                                        {/* <div className="text-xs text-gray-500">
                                          {partner.contractNumber}
                                        </div> */}
                                      </div>
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={formatNumberInput(
                                          partner.pricePerM3
                                        )}
                                        onChange={(e) =>
                                          handlePartnerPriceChange(
                                            partner.partnerId,
                                            e.target.value
                                          )
                                        }
                                        className="w-full text-right border border-gray-300 rounded p-1 no-spinner text-sm"
                                        placeholder="0"
                                        disabled={loading}
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={partner.soldM3}
                                        onChange={(e) =>
                                          handlePartnerSoldM3Change(
                                            partner.partnerId,
                                            e.target.value
                                          )
                                        }
                                        className={`w-full text-right border rounded p-1 no-spinner text-sm ${
                                          partner.soldM3 === ""
                                            ? "border-red-300 bg-red-50"
                                            : "border-gray-300"
                                        }`}
                                        placeholder="0"
                                        disabled={loading}
                                      />
                                    </td>
                                    <td className="p-2 text-right font-semibold text-sm">
                                      {formatNumberForDisplay(
                                        partner.totalAmount
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              {hasPartnerData() && (
                                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                  <tr>
                                    <td
                                      className="p-2 font-semibold"
                                      colSpan="3">
                                      Жами:
                                    </td>
                                    <td className="p-2 text-right font-semibold text-sm">
                                      {formatNumberForDisplay(
                                        partnerTotals.totalM3
                                      )}{" "}
                                      м³
                                    </td>
                                    <td className="p-2 text-right font-semibold text-sm">
                                      {formatNumberForDisplay(
                                        partnerTotals.totalAmount
                                      )}{" "}
                                      сўм
                                    </td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Общий отчет */}
                    <div className="bg-white border border-gray-200 rounded-xl">
                      <div className="p-4 border-b bg-gray-50">
                        <h4 className="text-lg font-semibold">
                          Умумий ҳисобот
                        </h4>
                      </div>
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              AutoPilot кўрсаткичи *
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={generalData.autopilotReading}
                              onChange={(e) =>
                                handleGeneralInputChange(
                                  "autopilotReading",
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner"
                              disabled={loading}
                              placeholder="0"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              1 м³ газ нархи (сўм) *
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={generalData.gasPrice}
                              onChange={(e) =>
                                handleGeneralInputChange(
                                  "gasPrice",
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner"
                              disabled={loading}
                              placeholder="0"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              "Хумо" терминали (сўм) *
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={generalData.humoTerminal}
                              onChange={(e) =>
                                handleGeneralInputChange(
                                  "humoTerminal",
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner"
                              disabled={loading}
                              placeholder="0"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              "Узкард" терминали (сўм) *
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={generalData.uzcardTerminal}
                              onChange={(e) =>
                                handleGeneralInputChange(
                                  "uzcardTerminal",
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner"
                              disabled={loading}
                              placeholder="0"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Электрон тўлов тизими (сўм) *
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={generalData.electronicPaymentSystem}
                              onChange={(e) =>
                                handleGeneralInputChange(
                                  "electronicPaymentSystem",
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner"
                              disabled={loading}
                              placeholder="0"
                              required
                            />
                          </div>
                          <div>{/* Пустой div для выравнивания */}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Сводная информация */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Йиғма маълумот
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center">
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Шланглар орқали сотилди
                      </label>
                      <div className="text-lg font-semibold text-green-600">
                        {formatNumberForDisplay(hoseTotal)} м³
                      </div>
                    </div>
                    <div className="text-center">
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Хамкорларга сотилди
                      </label>
                      <div className="text-lg font-semibold text-blue-600">
                        {formatNumberForDisplay(partnerTotals.totalM3)} м³
                      </div>
                    </div>
                    <div className="text-center">
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Хамкорларга сотилди
                      </label>
                      <div className="text-lg font-semibold text-purple-600">
                        {formatNumberForDisplay(partnerTotals.totalAmount)} сўм
                      </div>
                    </div>
                    <div className="text-center">
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Z-ҳисобот
                      </label>
                      <div className="text-lg font-semibold text-orange-600">
                        {formatNumberForDisplay(calculateCashAmount())} сўм
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Кнопки управления */}
              <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Хамкорлар: {partnerData.length} • Шланглар: {hoseRows.length}
                  {hoseRows.some((row) => row.hasReset) && (
                    <span className="ml-2 text-yellow-600">
                      • Нўлланиш:{" "}
                      {hoseRows.filter((row) => row.hasReset).length}
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100">
                    Бекор
                  </button>
                  <button
                    onClick={handleSaveClick}
                    disabled={loading || !isReportValid()}
                    className={`px-5 py-2 rounded-xl text-white font-semibold ${
                      isReportValid() && !loading
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-gray-400 cursor-not-allowed"
                    }`}>
                    {loading ? "Сақланмоқда..." : "Ҳисоботни сақлаш"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модальное окно подтверждения сохранения */}
      <AnimatePresence>
        {isConfirmModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}>
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-2"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}>
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-t-2xl">
                <div className="flex items-center justify-center">
                  <div className="bg-white bg-opacity-20 p-3 rounded-full">
                    <svg
                      className="w-8 h-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white text-center mt-4">
                  Сақлашни тасдиқлайсизми?
                </h3>
              </div>

              <div className="p-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-yellow-800 text-center font-medium">
                    ⚠️ Сақланганингизда сўнг ҳисоботни ўзгартириб бўлмайди!
                  </p>
                </div>

                <div className="space-y-3 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span className="font-medium">Сана:</span>
                    <span>{reportDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Автопилот:</span>
                    <span>
                      {formatNumberForDisplay(generalData.autopilotReading)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">1м нархи³:</span>
                    <span>
                      {formatNumberForDisplay(generalData.gasPrice)} ₽
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Хумо терминал:</span>
                    <span>
                      {formatNumberForDisplay(generalData.humoTerminal)} ₽
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Узкард терминал:</span>
                    <span>
                      {formatNumberForDisplay(generalData.uzcardTerminal)} ₽
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Электрон тўлов тизими:</span>
                    <span>
                      {formatNumberForDisplay(
                        generalData.electronicPaymentSystem
                      )}{" "}
                      ₽
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">
                      Шланглар орқали сотилди:
                    </span>
                    <span>{formatNumberForDisplay(hoseTotal)} м³</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Хамкорларга сотилди:</span>
                    <span>
                      {formatNumberForDisplay(partnerTotals.totalM3)} м³
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <span className="font-bold">Z-ҳисобот:</span>
                    <span className="font-bold text-orange-600">
                      {formatNumberForDisplay(calculateCashAmount())} ₽
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button
                    onClick={() => setIsConfirmModalOpen(false)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex-1">
                    Бекор
                  </button>
                  <button
                    onClick={saveUnifiedReport}
                    disabled={loading}
                    className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium flex-1 flex items-center justify-center disabled:bg-orange-300">
                    {loading ? (
                      "Сақланмоқда..."
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
                        Сақлашни тасдиқлаш
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модальное окно успешного сохранения */}
      <AnimatePresence>
        {isSuccessModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex justify-center items-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}>
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-md"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}>
              <div className="p-6 border-b">
                <h3 className="text-xl font-semibold text-green-600">
                  Ҳисобот мувафақиятли сақланди!
                </h3>
              </div>
              <div className="p-6">
                <p className="text-gray-700 mb-4">
                  {reportDate} кунги ҳисобот тизимда мувафақиятли сақланди.
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center text-green-700">
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="currentColor"
                      viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Барча маълумотлар сақланди</span>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t bg-gray-50 flex justify-end">
                <button
                  onClick={handleFinish}
                  className="px-5 py-2 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700">
                  Закрыть
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .no-spinner::-webkit-outer-spin-button,
        .no-spinner::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spinner {
          -moz-appearance: textfield;
        }
      `}</style>
    </>
  );
};

export default UnifiedReportModal;
