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

const UnifiedReportModal = ({ isOpen, onClose, station }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [reportDate, setReportDate] = useState("");
  const [dateDisabled, setDateDisabled] = useState(false);
  const [savedReportIds, setSavedReportIds] = useState({
    partner: null,
    hose: null,
    general: null,
  });
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isConsistencyModalOpen, setIsConsistencyModalOpen] = useState(false);
  const [consistencyData, setConsistencyData] = useState(null);

  // Данные для отчета по партнерам
  const [partnerData, setPartnerData] = useState([]);
  const [contracts, setContracts] = useState([]);

  // Данные для отчета по шлангам
  const [hoseRows, setHoseRows] = useState([]);
  const [hoseTotal, setHoseTotal] = useState(0);
  const [hoseTotalSum, setHoseTotalSum] = useState(0);

  // Данные для общего отчета
  const [generalData, setGeneralData] = useState({
    autopilotReading: "",
    gasPrice: "",
    humoTerminal: "",
    uzcardTerminal: "",
  });

  const userData = useAppStore((state) => state.userData);
  const userName = userData?.email || "Неизвестный пользователь";

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

  // Функция форматирования чисел с разделителями тысяч
  const formatNumberInput = (value) => {
    if (value === "" || value === null || value === undefined) return "";
    // Удаляем все нецифровые символы кроме точки и запятой
    const cleaned = value.toString().replace(/[^\d,.]/g, "");
    // Заменяем запятую на точку для парсинга
    const number = parseFloat(cleaned.replace(",", "."));
    if (isNaN(number)) return cleaned;
    // Форматируем с разделителями тысяч
    return number.toLocaleString("ru-RU", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
  };

  // Функция для парсинка форматированного числа
  const parseFormattedNumber = (value) => {
    if (!value) return 0;
    const cleaned = value.toString().replace(/\s/g, "").replace(",", ".");
    return parseFloat(cleaned) || 0;
  };

  // Проверка согласованности последних отчетов
  const checkReportsConsistency = useCallback(async () => {
    if (!station?.id) return null;

    try {
      // Получаем последний отчет по партнерам
      const lastPartnerReportQuery = query(
        collection(db, "dailyPartnerReports"),
        where("stationId", "==", station.id),
        orderBy("reportDate", "desc"),
        limit(1)
      );

      // Получаем последний отчет по шлангам
      const lastHoseReportQuery = query(
        collection(db, "daily_hose_reports"),
        where("stationId", "==", station.id),
        orderBy("date", "desc"),
        limit(1)
      );

      // Получаем последний общий отчет
      const lastGeneralReportQuery = query(
        collection(db, "generalDailyReports"),
        where("stationId", "==", station.id),
        orderBy("date", "desc"),
        limit(1)
      );

      const [partnerSnapshot, hoseSnapshot, generalSnapshot] =
        await Promise.all([
          getDocs(lastPartnerReportQuery),
          getDocs(lastHoseReportQuery),
          getDocs(lastGeneralReportQuery),
        ]);

      const partnerReport = !partnerSnapshot.empty
        ? partnerSnapshot.docs[0].data()
        : null;
      const hoseReport = !hoseSnapshot.empty
        ? hoseSnapshot.docs[0].data()
        : null;
      const generalReport = !generalSnapshot.empty
        ? generalSnapshot.docs[0].data()
        : null;

      const partnerDate = partnerReport?.reportDate;
      const hoseDate = hoseReport?.date;
      const generalDate = generalReport?.date;

      const isConsistent = partnerDate === hoseDate && hoseDate === generalDate;

      return {
        partnerReport,
        hoseReport,
        generalReport,
        partnerDate,
        hoseDate,
        generalDate,
        isConsistent,
      };
    } catch (error) {
      console.error("Ошибка проверки согласованности отчетов:", error);
      return null;
    }
  }, [station?.id]);

  // Проверка существующих отчетов для конкретной коллекции
  const checkExistingReport = useCallback(
    async (collectionName, dateField = "date") => {
      if (!station?.id || !reportDate) return false;

      try {
        let queryCondition;

        if (collectionName === "dailyPartnerReports") {
          queryCondition = query(
            collection(db, collectionName),
            where("stationId", "==", station.id),
            where("reportDate", "==", reportDate)
          );
        } else {
          queryCondition = query(
            collection(db, collectionName),
            where("stationId", "==", station.id),
            where(dateField, "==", reportDate)
          );
        }

        const snapshot = await getDocs(queryCondition);

        if (!snapshot.empty) {
          toast.error(
            `Отчет ${getCollectionName(
              collectionName
            )} за эту дату уже существует!`
          );
          return true;
        }

        return false;
      } catch (error) {
        console.error(`Ошибка проверки отчетов в ${collectionName}:`, error);
        return false;
      }
    },
    [station?.id, reportDate]
  );

  // Вспомогательная функция для получения читаемого имени коллекции
  const getCollectionName = (collectionName) => {
    switch (collectionName) {
      case "dailyPartnerReports":
        return "по партнерам";
      case "daily_hose_reports":
        return "по шлангам";
      case "generalDailyReports":
        return "общий";
      default:
        return "";
    }
  };

  // Загрузка последних данных для инициализации
  useEffect(() => {
    if (!isOpen || !station?.id) return;

    const initializeData = async () => {
      try {
        setLoading(true);

        // Проверяем согласованность отчетов
        const consistency = await checkReportsConsistency();
        setConsistencyData(consistency);

        if (consistency && !consistency.isConsistent) {
          setIsConsistencyModalOpen(true);
          return;
        }

        // Загружаем последний отчет по партнерам для определения даты и цен
        const lastPartnerReportQuery = query(
          collection(db, "dailyPartnerReports"),
          where("stationId", "==", station.id),
          orderBy("reportDate", "desc"),
          limit(1)
        );

        const lastPartnerReportSnapshot = await getDocs(lastPartnerReportQuery);

        if (!lastPartnerReportSnapshot.empty) {
          const lastReport = lastPartnerReportSnapshot.docs[0].data();
          const nextDate = addDays(lastReport.reportDate, 1);
          setReportDate(nextDate);
          setDateDisabled(true);
        } else {
          setReportDate("");
          setDateDisabled(false);
        }

        // Загружаем договоры
        const contractsQuery = query(
          collection(db, "contracts"),
          where("stationId", "==", station.id)
        );

        const contractsSnapshot = await getDocs(contractsQuery);
        const contractsData = contractsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setContracts(contractsData);

        // Инициализируем данные партнеров с ценами из последнего отчета
        const initializedPartnerData = contractsData.map((contract) => {
          let pricePerM3 = 0;

          // Пытаемся найти цену из последнего отчета для этого партнера
          if (!lastPartnerReportSnapshot.empty) {
            const lastReport = lastPartnerReportSnapshot.docs[0].data();
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
            soldM3: 0,
            totalAmount: 0,
          };
        });

        setPartnerData(initializedPartnerData);

        // Загружаем последний отчет по шлангам для получения предыдущих показаний и цен
        const lastHoseReportQuery = query(
          collection(db, "daily_hose_reports"),
          where("stationId", "==", station.id),
          orderBy("date", "desc"),
          limit(1)
        );

        const lastHoseReportSnapshot = await getDocs(lastHoseReportQuery);

        const initializedHoseRows = hoseNames.map((name, index) => {
          let prev = 0;
          let price = 0;
          let prevDisabled = false;

          if (!lastHoseReportSnapshot.empty) {
            const lastReport = lastHoseReportSnapshot.docs[0].data();
            const lastHose = lastReport.hoses?.find((h) => h.hose === name);
            if (lastHose) {
              prev = lastHose.current || 0; // Текущее показание становится предыдущим
              price = lastHose.price || 0;
              prevDisabled = true; // Предыдущее показание нельзя менять
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
          };
        });

        setHoseRows(initializedHoseRows);

        // Загружаем последний общий отчет для получения цены газа
        const lastGeneralReportQuery = query(
          collection(db, "generalDailyReports"),
          where("stationId", "==", station.id),
          orderBy("date", "desc"),
          limit(1)
        );

        const lastGeneralReportSnapshot = await getDocs(lastGeneralReportQuery);

        if (!lastGeneralReportSnapshot.empty) {
          const lastReport = lastGeneralReportSnapshot.docs[0].data();
          setGeneralData((prev) => ({
            ...prev,
            gasPrice: lastReport.gasPrice ? lastReport.gasPrice.toString() : "",
          }));
        }
      } catch (error) {
        console.error("Ошибка инициализации данных:", error);
        toast.error("Ошибка при загрузке данных");
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [isOpen, station?.id, hoseNames, addDays, checkReportsConsistency]);

  // Удаление сохраненных отчетов при отмене (только если отчет не завершен)
  const deleteSavedReports = async () => {
    try {
      const deletePromises = [];

      if (savedReportIds.partner) {
        deletePromises.push(
          deleteDoc(doc(db, "dailyPartnerReports", savedReportIds.partner))
        );
      }
      if (savedReportIds.hose) {
        deletePromises.push(
          deleteDoc(doc(db, "daily_hose_reports", savedReportIds.hose))
        );
      }
      if (savedReportIds.general) {
        deletePromises.push(
          deleteDoc(doc(db, "generalDailyReports", savedReportIds.general))
        );
      }

      await Promise.all(deletePromises);
      console.log("Незавершенные отчеты удалены");
    } catch (error) {
      console.error("Ошибка удаления отчетов:", error);
    }
  };

  // ========== ФУНКЦИИ ДЛЯ ОТЧЕТА ПО ПАРТНЕРАМ ==========

  const handlePartnerPriceChange = (partnerId, newPrice) => {
    const formattedValue = formatNumberInput(newPrice);
    const numericValue = parseFormattedNumber(formattedValue);

    setPartnerData((prev) =>
      prev.map((partner) =>
        partner.partnerId === partnerId
          ? {
              ...partner,
              pricePerM3: numericValue,
              totalAmount: partner.soldM3 * numericValue,
            }
          : partner
      )
    );
  };

  const handlePartnerSoldM3Change = (partnerId, soldM3) => {
    const formattedValue = formatNumberInput(soldM3);
    const numericValue = parseFormattedNumber(formattedValue);

    setPartnerData((prev) =>
      prev.map((partner) => {
        if (partner.partnerId === partnerId) {
          const totalAmount = numericValue * partner.pricePerM3;
          return {
            ...partner,
            soldM3: numericValue,
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
      acc.totalM3 += partner.soldM3;
      acc.totalAmount += partner.totalAmount;
      return acc;
    },
    { totalM3: 0, totalAmount: 0 }
  );

  // Валидация отчета по партнерам - теперь можно сохранить даже если нет данных
  const isPartnerReportValid = () => {
    if (!reportDate || partnerData.length === 0) return true; // Разрешаем сохранение даже без партнеров
    return true; // Всегда валидно, так как можно пропустить
  };

  // Проверка, есть ли данные для сохранения
  const hasPartnerData = () => {
    return partnerData.some((partner) => partner.soldM3 > 0);
  };

  // ========== ФУНКЦИИ ДЛЯ ОТЧЕТА ПО ШЛАНГАМ ==========

  // Расчет разницы и суммы для шланга
  const calculateHoseRowDiff = useCallback((row) => {
    const prev = Number(row.prev) || 0;
    const current = row.current === "" ? 0 : parseFormattedNumber(row.current);
    const price = Number(row.price) || 0;
    const diff = current >= prev ? current - prev : 0;
    const sum = diff * price;

    return {
      ...row,
      diff: isNaN(diff) ? 0 : diff,
      sum: isNaN(sum) ? 0 : sum,
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

      // Пересчитываем общие тоталы
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
        return current < prev;
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

    const cashAmount =
      (hoseTotal - partnerTotals.totalM3) * gasPrice -
      humoTerminal -
      uzcardTerminal;
    return cashAmount > 0 ? cashAmount : 0;
  };

  // Валидация общего отчета
  const isGeneralReportValid = () => {
    return (
      generalData.autopilotReading &&
      generalData.gasPrice &&
      generalData.humoTerminal !== "" &&
      generalData.uzcardTerminal !== ""
    );
  };

  // ========== ФУНКЦИИ СОХРАНЕНИЯ ==========

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

  // Сохранение отчета по партнерам
  const savePartnerReport = async () => {
    if (!isPartnerReportValid()) {
      toast.error("Ошибка валидации отчета по партнерам");
      return;
    }

    // Если нет данных для сохранения, просто переходим к следующему шагу
    if (!hasPartnerData()) {
      toast.success("Пропускаем отчет по партнерам (нет данных)");
      setCurrentStep(2);
      return;
    }

    try {
      setLoading(true);

      // Проверяем существующие отчеты по партнерам перед сохранением
      const hasExistingReport = await checkExistingReport(
        "dailyPartnerReports",
        "reportDate"
      );
      if (hasExistingReport) {
        setLoading(false);
        return;
      }

      const clientIP = await getClientIP();

      const totalGasPartner = partnerData.reduce((total, partner) => {
        return total + (partner.soldM3 || 0);
      }, 0);

      const totalSumGasPartner = partnerData.reduce((total, partner) => {
        return total + (partner.totalAmount || 0);
      }, 0);

      const reportData = {
        reportDate,
        stationId: station.id,
        stationName: station.stationName || "Неизвестная станция",
        partnerData: partnerData.filter((partner) => partner.soldM3 > 0), // Сохраняем только партнеров с данными
        totalgaspartner: totalGasPartner,
        totalsumgaspartner: totalSumGasPartner,
        createdBy: userName,
        createdAt: serverTimestamp(),
        clientIP,
        status: "saved",
      };

      const docRef = await addDoc(
        collection(db, "dailyPartnerReports"),
        reportData
      );
      setSavedReportIds((prev) => ({ ...prev, partner: docRef.id }));

      toast.success("Отчет по партнерам сохранен!");
      setCurrentStep(2);
    } catch (error) {
      console.error("Ошибка сохранения отчета по партнерам:", error);
      toast.error("Ошибка при сохранении отчета по партнерам");
    } finally {
      setLoading(false);
    }
  };

  // Сохранение отчета по шлангам
  const saveHoseReport = async () => {
    if (!isHoseReportValid()) {
      toast.error("Заполните все показания шлангов правильно");
      return;
    }

    try {
      setLoading(true);

      // Проверяем существующие отчеты по шлангам перед сохранением
      const hasExistingReport = await checkExistingReport("daily_hose_reports");
      if (hasExistingReport) {
        setLoading(false);
        return;
      }

      const ip = await getClientIP();
      const userId = auth?.currentUser?.uid || "unknown";

      const hoses = hoseRows.map((row) => ({
        hose: row.hose,
        prev: Number(row.prev) || 0,
        current: parseFormattedNumber(row.current) || 0,
        price: Number(row.price) || 0,
        diff: Number(row.diff) || 0,
        sum: Number(row.sum) || 0,
      }));

      const reportData = {
        stationId: station.id,
        stationName: station.stationName || "Без названия",
        date: reportDate,
        hoses,
        totalgas: hoseTotal,
        totalsum: hoseTotalSum,
        createdAt: serverTimestamp(),
        createdBy: userId,
        createdIp: ip,
      };

      const docRef = await addDoc(
        collection(db, "daily_hose_reports"),
        reportData
      );
      setSavedReportIds((prev) => ({ ...prev, hose: docRef.id }));

      toast.success("Отчет по шлангам сохранен!");
      setCurrentStep(3);
    } catch (error) {
      console.error("Ошибка сохранения отчета по шлангам:", error);
      toast.error("Ошибка при сохранении отчета по шлангам");
    } finally {
      setLoading(false);
    }
  };

  // Сохранение общего отчета
  const saveGeneralReport = async () => {
    if (!isGeneralReportValid()) {
      toast.error("Заполните все обязательные поля общего отчета");
      return;
    }

    try {
      setLoading(true);

      // Проверяем существующие общие отчеты перед сохранением
      const hasExistingReport = await checkExistingReport(
        "generalDailyReports"
      );
      if (hasExistingReport) {
        setLoading(false);
        return;
      }

      const ip = await getClientIP();
      const userEmail = auth?.currentUser?.email || "unknown";

      const cashAmount = calculateCashAmount();

      const reportData = {
        stationId: station.id,
        stationName: station.stationName,
        date: reportDate,
        autopilotReading: parseFormattedNumber(generalData.autopilotReading),
        gasPrice: parseFormattedNumber(generalData.gasPrice),
        hoseTotalGas: hoseTotal,
        partnerTotalGas: partnerTotals.totalM3,
        partnerTotalSum: partnerTotals.totalAmount,
        humoTerminal: parseFormattedNumber(generalData.humoTerminal),
        uzcardTerminal: parseFormattedNumber(generalData.uzcardTerminal),
        cashAmount: cashAmount,
        createdBy: userEmail,
        createdAt: serverTimestamp(),
        createdIp: ip,
      };

      const docRef = await addDoc(
        collection(db, "generalDailyReports"),
        reportData
      );
      setSavedReportIds((prev) => ({ ...prev, general: docRef.id }));

      // Показываем модальное окно подтверждения вместо немедленного закрытия
      setIsConfirmModalOpen(true);
    } catch (error) {
      console.error("Ошибка сохранения общего отчета:", error);
      toast.error("Ошибка при сохранении общего отчета");
    } finally {
      setLoading(false);
    }
  };

  // Подтверждение сохранения отчета
  const handleConfirmSave = () => {
    setIsConfirmModalOpen(false);
    setIsSuccessModalOpen(true);
  };

  // Завершение работы с отчетом
  const handleFinish = () => {
    setIsSuccessModalOpen(false);
    // Сбрасываем состояние и закрываем модальное окно
    setCurrentStep(1);
    setPartnerData([]);
    setHoseRows([]);
    setGeneralData({
      autopilotReading: "",
      gasPrice: "",
      humoTerminal: "",
      uzcardTerminal: "",
    });
    setSavedReportIds({ partner: null, hose: null, general: null });
    onClose(); // Закрываем основное модальное окно
  };

  // Обработка несогласованности отчетов
  const handleInconsistentReports = () => {
    setIsConsistencyModalOpen(false);
    onClose();
  };

  // Сброс формы при отмене (удаляем только незавершенные отчеты)
  const handleClose = async () => {
    // Удаляем сохраненные отчеты только если общий отчет не был завершен
    if (savedReportIds.partner || savedReportIds.hose) {
      await deleteSavedReports();
    }

    setCurrentStep(1);
    setPartnerData([]);
    setHoseRows([]);
    setGeneralData({
      autopilotReading: "",
      gasPrice: "",
      humoTerminal: "",
      uzcardTerminal: "",
    });
    setSavedReportIds({ partner: null, hose: null, general: null });
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
              className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}>
              {/* Заголовок */}
              <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-semibold">
                      Единый отчет - Шаг {currentStep} из 3
                    </h3>
                    <p className="text-blue-100 mt-1">
                      {currentStep === 1 && "Ежедневный отчет по партнерам"}
                      {currentStep === 2 && "Ежедневный отчет по шлангам"}
                      {currentStep === 3 && "Ежедневный общий отчет"}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {[1, 2, 3].map((step) => (
                      <div
                        key={step}
                        className={`w-3 h-3 rounded-full ${
                          step === currentStep
                            ? "bg-white"
                            : step < currentStep
                            ? "bg-green-400"
                            : "bg-blue-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-6">
                {/* Общее поле даты */}
                <div className="mb-6 bg-blue-50 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Дата отчета *
                  </label>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    disabled={dateDisabled || loading}
                    className="w-full max-w-xs border border-gray-300 rounded-xl p-3 disabled:bg-gray-100"
                  />
                  {dateDisabled && (
                    <p className="text-sm text-green-600 mt-1">
                      Дата установлена автоматически (+1 день к последнему
                      отчету)
                    </p>
                  )}
                </div>

                {/* Шаг 1: Отчет по партнерам */}
                {currentStep === 1 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}>
                    <h4 className="text-lg font-semibold mb-4">
                      Отчет по партнерам{" "}
                      {!hasPartnerData() && "(можно пропустить)"}
                    </h4>

                    {partnerData.length === 0 ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                        <p className="text-yellow-700 mb-4">
                          Для этой станции нет зарегистрированных партнеров.
                        </p>
                        <p className="text-yellow-600">
                          Вы можете пропустить этот шаг и перейти к отчету по
                          шлангам.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="p-3 text-left">Партнер</th>
                              <th className="p-3 text-left">№ договора</th>
                              <th className="p-3 text-right w-40">
                                Цена за 1 м³ (₽)
                              </th>
                              <th className="p-3 text-right w-40">
                                Количество м³
                              </th>
                              <th className="p-3 text-right">Сумма (₽)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {partnerData.map((partner, idx) => (
                              <tr
                                key={partner.partnerId}
                                className="border-t hover:bg-gray-50">
                                <td className="p-3">{partner.partnerName}</td>
                                <td className="p-3">
                                  {partner.contractNumber}
                                </td>
                                <td className="p-3">
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
                                    className="w-full text-right border border-gray-300 rounded p-2 no-spinner"
                                    placeholder="0"
                                    disabled={loading}
                                  />
                                </td>
                                <td className="p-3">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={formatNumberInput(partner.soldM3)}
                                    onChange={(e) =>
                                      handlePartnerSoldM3Change(
                                        partner.partnerId,
                                        e.target.value
                                      )
                                    }
                                    className="w-full text-right border border-gray-300 rounded p-2 no-spinner"
                                    placeholder="0"
                                    disabled={loading}
                                  />
                                </td>
                                <td className="p-3 text-right font-semibold">
                                  {formatNumberInput(partner.totalAmount)} ₽
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                            <tr>
                              <td className="p-3 font-semibold" colSpan="3">
                                Итого:
                              </td>
                              <td className="p-3 text-right font-semibold">
                                {formatNumberInput(partnerTotals.totalM3)} м³
                              </td>
                              <td className="p-3 text-right font-semibold">
                                {formatNumberInput(partnerTotals.totalAmount)} ₽
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Шаг 2: Отчет по шлангам */}
                {currentStep === 2 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}>
                    <h4 className="text-lg font-semibold mb-4">
                      Отчет по шлангам
                    </h4>

                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-4 text-left font-semibold text-gray-700 border-b">
                              Шланг
                            </th>
                            <th className="px-6 py-4 text-left font-semibold text-gray-700 border-b w-40">
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
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {hoseRows.map((row, index) => {
                            const currentNum = parseFormattedNumber(
                              row.current
                            );
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
                                    type="text"
                                    inputMode="decimal"
                                    value={formatNumberInput(row.price)}
                                    onChange={(e) =>
                                      handleHosePriceChange(
                                        index,
                                        e.target.value
                                      )
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner"
                                    disabled={loading}
                                    placeholder="0"
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={formatNumberInput(row.prev)}
                                    onChange={(e) => {
                                      const newRows = [...hoseRows];
                                      newRows[index].prev =
                                        parseFormattedNumber(e.target.value) ||
                                        0;
                                      setHoseRows(newRows);
                                    }}
                                    disabled={row.prevDisabled || loading}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="px-6 py-4">
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
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner ${
                                      isInvalid
                                        ? "border-red-500 ring-2 ring-red-200"
                                        : "border-gray-300"
                                    }`}
                                    disabled={loading}
                                    required
                                    placeholder="Введите показание"
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <span
                                    className={`font-semibold ${
                                      row.diff > 0
                                        ? "text-green-600"
                                        : "text-gray-500"
                                    }`}>
                                    {formatNumberInput(row.diff)}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <span
                                    className={`font-semibold ${
                                      row.sum > 0
                                        ? "text-blue-600"
                                        : "text-gray-500"
                                    }`}>
                                    {formatNumberInput(row.sum)} ₽
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Итоги по шлангам */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="text-lg font-semibold text-blue-900">
                              Итог за день (м³)
                            </h4>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-blue-900">
                              {formatNumberInput(hoseTotal)}
                            </div>
                            <div className="text-blue-700 font-medium">м³</div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="text-lg font-semibold text-green-900">
                              Итог за день (₽)
                            </h4>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-900">
                              {formatNumberInput(hoseTotalSum)}
                            </div>
                            <div className="text-green-700 font-medium">
                              руб.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Шаг 3: Общий отчет */}
                {currentStep === 3 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}>
                    <h4 className="text-lg font-semibold mb-4">Общий отчет</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Основные поля */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Показание счетчика AutoPilotPro *
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
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner"
                            disabled={loading}
                            placeholder="0"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Цена за 1 м³ газа (₽) *
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
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner"
                            disabled={loading}
                            placeholder="0"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Терминал "Хумо" (₽) *
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
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner"
                            disabled={loading}
                            placeholder="0"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Терминал "Узкард" (₽) *
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
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner"
                            disabled={loading}
                            placeholder="0"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Сводная информация */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mt-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        Сводные данные
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="text-center">
                          <label className="block text-sm font-medium text-gray-600 mb-1">
                            Продано через шланги
                          </label>
                          <div className="text-lg font-semibold text-green-600">
                            {formatNumberInput(hoseTotal)} м³
                          </div>
                        </div>
                        <div className="text-center">
                          <label className="block text-sm font-medium text-gray-600 mb-1">
                            Продано партнерам
                          </label>
                          <div className="text-lg font-semibold text-blue-600">
                            {formatNumberInput(partnerTotals.totalM3)} м³
                          </div>
                        </div>
                        <div className="text-center">
                          <label className="block text-sm font-medium text-gray-600 mb-1">
                            Сумма партнеров
                          </label>
                          <div className="text-lg font-semibold text-purple-600">
                            {formatNumberInput(partnerTotals.totalAmount)} ₽
                          </div>
                        </div>
                        <div className="text-center">
                          <label className="block text-sm font-medium text-gray-600 mb-1">
                            Наличные (расчет)
                          </label>
                          <div className="text-lg font-semibold text-orange-600">
                            {formatNumberInput(calculateCashAmount())} ₽
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Кнопки управления */}
              <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {currentStep === 1 && `Партнеров: ${partnerData.length}`}
                  {currentStep === 2 && `Шлангов: ${hoseRows.length}`}
                  {currentStep === 3 && "Завершение отчета"}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100">
                    Отмена
                  </button>

                  {currentStep === 1 && (
                    <button
                      onClick={savePartnerReport}
                      disabled={loading}
                      className={`px-5 py-2 rounded-xl text-white font-semibold ${
                        !loading
                          ? "bg-blue-600 hover:bg-blue-700"
                          : "bg-gray-400 cursor-not-allowed"
                      }`}>
                      {loading
                        ? "Сохранение..."
                        : hasPartnerData()
                        ? "Сохранить и продолжить"
                        : "Пропустить и продолжить"}
                    </button>
                  )}

                  {currentStep === 2 && (
                    <button
                      onClick={saveHoseReport}
                      disabled={loading || !isHoseReportValid()}
                      className={`px-5 py-2 rounded-xl text-white font-semibold ${
                        isHoseReportValid() && !loading
                          ? "bg-blue-600 hover:bg-blue-700"
                          : "bg-gray-400 cursor-not-allowed"
                      }`}>
                      {loading ? "Сохранение..." : "Сохранить и продолжить"}
                    </button>
                  )}

                  {currentStep === 3 && (
                    <button
                      onClick={saveGeneralReport}
                      disabled={loading || !isGeneralReportValid()}
                      className={`px-5 py-2 rounded-xl text-white font-semibold ${
                        isGeneralReportValid() && !loading
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-gray-400 cursor-not-allowed"
                      }`}>
                      {loading ? "Сохранение..." : "Завершить отчет"}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модальное окно проверки согласованности отчетов */}
      <AnimatePresence>
        {isConsistencyModalOpen && consistencyData && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}>
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-2"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}>
              {/* Заголовок */}
              <div
                className={`p-6 rounded-t-2xl ${
                  consistencyData.isConsistent
                    ? "bg-gradient-to-r from-green-500 to-green-600"
                    : "bg-gradient-to-r from-red-500 to-red-600"
                }`}>
                <div className="flex items-center justify-center">
                  <div className="bg-white bg-opacity-20 p-3 rounded-full">
                    {consistencyData.isConsistent ? (
                      <svg
                        className="w-8 h-8 text-white"
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
                    ) : (
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
                    )}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white text-center mt-4">
                  {consistencyData.isConsistent
                    ? "Отчеты согласованы"
                    : "Обнаружена несогласованность отчетов!"}
                </h3>
              </div>

              {/* Содержимое */}
              <div className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div
                      className={`p-4 rounded-lg border ${
                        consistencyData.partnerDate
                          ? "bg-green-50 border-green-200"
                          : "bg-gray-50 border-gray-200"
                      }`}>
                      <h4 className="font-semibold text-gray-800 mb-2">
                        Отчет по партнерам
                      </h4>
                      <p
                        className={
                          consistencyData.partnerDate
                            ? "text-green-700"
                            : "text-gray-500"
                        }>
                        {consistencyData.partnerDate || "Нет отчетов"}
                      </p>
                    </div>
                    <div
                      className={`p-4 rounded-lg border ${
                        consistencyData.hoseDate
                          ? "bg-green-50 border-green-200"
                          : "bg-gray-50 border-gray-200"
                      }`}>
                      <h4 className="font-semibold text-gray-800 mb-2">
                        Отчет по шлангам
                      </h4>
                      <p
                        className={
                          consistencyData.hoseDate
                            ? "text-green-700"
                            : "text-gray-500"
                        }>
                        {consistencyData.hoseDate || "Нет отчетов"}
                      </p>
                    </div>
                    <div
                      className={`p-4 rounded-lg border ${
                        consistencyData.generalDate
                          ? "bg-green-50 border-green-200"
                          : "bg-gray-50 border-gray-200"
                      }`}>
                      <h4 className="font-semibold text-gray-800 mb-2">
                        Общий отчет
                      </h4>
                      <p
                        className={
                          consistencyData.generalDate
                            ? "text-green-700"
                            : "text-gray-500"
                        }>
                        {consistencyData.generalDate || "Нет отчетов"}
                      </p>
                    </div>
                  </div>

                  {!consistencyData.isConsistent && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-700 text-center font-medium">
                        ⚠️ Нельзя создать новый отчет пока даты последних
                        отчетов не совпадают!
                      </p>
                      <p className="text-red-600 text-center mt-2 text-sm">
                        Пожалуйста, завершите все отчеты за предыдущие даты
                        перед созданием нового.
                      </p>
                    </div>
                  )}

                  {consistencyData.isConsistent && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-700 text-center font-medium">
                        ✅ Все отчеты согласованы. Можно создавать новый отчет.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-center mt-6">
                  <button
                    onClick={handleInconsistentReports}
                    className={`px-6 py-3 rounded-lg text-white font-medium ${
                      consistencyData.isConsistent
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}>
                    {consistencyData.isConsistent ? "Продолжить" : "Закрыть"}
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
              {/* Заголовок */}
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
                  Подтверждение сохранения
                </h3>
              </div>

              {/* Содержимое */}
              <div className="p-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-yellow-800 text-center font-medium">
                    ⚠️ После сохранения изменить данные будет невозможно!
                  </p>
                </div>

                <div className="space-y-3 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span className="font-medium">Дата:</span>
                    <span>{reportDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Показание счетчика:</span>
                    <span>
                      {formatNumberInput(generalData.autopilotReading)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Цена за м³:</span>
                    <span>{formatNumberInput(generalData.gasPrice)} ₽</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Продано через шланги:</span>
                    <span>{formatNumberInput(hoseTotal)} м³</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Продано партнерам:</span>
                    <span>{formatNumberInput(partnerTotals.totalM3)} м³</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Сумма партнеров:</span>
                    <span>
                      {formatNumberInput(partnerTotals.totalAmount)} ₽
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Терминал Хумо:</span>
                    <span>{formatNumberInput(generalData.humoTerminal)} ₽</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Терминал Узкард:</span>
                    <span>
                      {formatNumberInput(generalData.uzcardTerminal)} ₽
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <span className="font-bold">Наличные:</span>
                    <span className="font-bold text-orange-600">
                      {formatNumberInput(calculateCashAmount())} ₽
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button
                    onClick={() => setIsConfirmModalOpen(false)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex-1">
                    Отмена
                  </button>
                  <button
                    onClick={handleConfirmSave}
                    className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium flex-1 flex items-center justify-center">
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
                    Подтвердить сохранение
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
                  Отчет успешно завершен!
                </h3>
              </div>
              <div className="p-6">
                <p className="text-gray-700 mb-4">
                  Все отчеты за {reportDate} успешно сохранены в системе.
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
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
                    <span>Отчет по партнерам</span>
                  </div>
                  <div className="flex items-center text-green-700 mt-2">
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
                    <span>Отчет по шлангам</span>
                  </div>
                  <div className="flex items-center text-green-700 mt-2">
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
                    <span>Общий отчет</span>
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
