import { useState, useEffect } from "react";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase/config";

export const useGasSettlements = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stations, setStations] = useState([]);
  const [settlementsData, setSettlementsData] = useState([]);
  const [priceOfGas, setPriceOfGas] = useState([]);
  const [regions, setRegions] = useState([]);
  const [banks, setBanks] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Функция для создания документа если он не существует
  const ensureDocumentExists = async () => {
    try {
      const gasSettlementsRef = doc(db, "gasSettlements", "main");
      const docSnap = await getDoc(gasSettlementsRef);

      if (!docSnap.exists()) {
        await setDoc(gasSettlementsRef, {
          mainData: [],
          data: [],
          priceOfGas: [],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
      return true;
    } catch (err) {
      throw err;
    }
  };

  // Загрузка всех данных
  const loadAllData = async () => {
    setLoading(true);
    setError(null);

    try {
      await ensureDocumentExists();

      const gasSettlementsRef = doc(db, "gasSettlements", "main");
      const gasSettlementsSnap = await getDoc(gasSettlementsRef);

      if (gasSettlementsSnap.exists()) {
        const data = gasSettlementsSnap.data();
        const mainData = Array.isArray(data.mainData) ? data.mainData : [];
        const settlements = Array.isArray(data.data) ? data.data : [];
        const prices = Array.isArray(data.priceOfGas) ? data.priceOfGas : [];

        setStations(mainData);
        setSettlementsData(settlements);
        setPriceOfGas(prices);
      }

      // Загружаем регионы
      try {
        const regionsCollection = collection(db, "regions");
        const regionsSnapshot = await getDocs(regionsCollection);

        const regionsList = [];
        regionsSnapshot.forEach((doc) => {
          regionsList.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        setRegions(regionsList);
      } catch (regionErr) {
        console.warn("Could not load regions:", regionErr.message);
        setRegions([]);
      }

      // Загружаем банки
      try {
        const banksCollection = collection(db, "banks");
        const banksSnapshot = await getDocs(banksCollection);

        const banksList = [];
        banksSnapshot.forEach((doc) => {
          banksList.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        setBanks(banksList);
      } catch (bankErr) {
        console.warn("Could not load banks:", bankErr.message);
        setBanks([]);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error loading data:", err);
      setError(`Ошибка загрузки данных: ${err.message}`);

      setStations([]);
      setSettlementsData([]);
      setPriceOfGas([]);
      setRegions([]);
      setBanks([]);
    } finally {
      setLoading(false);
    }
  };

  // Сохранение данных (обновленная версия)
  const saveData = async (fieldName, data) => {
    setLoading(true);
    try {
      const docRef = doc(db, "gasSettlements", "main");
      await ensureDocumentExists();
      await updateDoc(docRef, {
        [fieldName]: data,
        updatedAt: Timestamp.now(),
      });
      return true;
    } catch (err) {
      console.error("Error saving data:", err);
      setError(`Ошибка сохранения: ${err.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Добавление новой заправки (ИСПРАВЛЕНАЯ ВЕРСИЯ)
  const addNewStation = async (stationData) => {
    try {
      console.log("Adding new station:", stationData);

      // Генерируем новый ID
      const newId =
        stations.length > 0
          ? Math.max(...stations.map((s) => parseInt(s.id || 0))) + 1
          : 1;

      const newStation = {
        ...stationData,
        id: newId.toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const newStations = [...stations, newStation];
      const success = await saveData("mainData", newStations);

      if (success) {
        // ВАЖНО: Обновляем состояние stations
        setStations(newStations);
        console.log("Station added successfully:", newStation);
        console.log("Total stations now:", newStations.length);
        console.log("All stations:", newStations);

        return { success: true, data: newStation, id: newId };
      }

      return { success: false, error: "Не удалось сохранить заправку" };
    } catch (err) {
      console.error("Error adding station:", err);
      setError(`Ошибка добавления заправки: ${err.message}`);
      return { success: false, error: err.message };
    }
  };

  // ПРИНУДИТЕЛЬНАЯ ПЕРЕЗАГРУЗКА СТАНЦИЙ
  const reloadStations = async () => {
    try {
      console.log("Reloading stations...");
      const gasSettlementsRef = doc(db, "gasSettlements", "main");
      const gasSettlementsSnap = await getDoc(gasSettlementsRef);

      if (gasSettlementsSnap.exists()) {
        const data = gasSettlementsSnap.data();
        const mainData = Array.isArray(data.mainData) ? data.mainData : [];
        setStations(mainData);
        console.log("Stations reloaded:", mainData.length);
        return mainData;
      }
      return [];
    } catch (err) {
      console.error("Error reloading stations:", err);
      return [];
    }
  };

  // Обновление заправки
  const updateStation = async (stationId, updatedData) => {
    try {
      const newStations = stations.map((station) =>
        station.id.toString() === stationId.toString()
          ? {
              ...station,
              ...updatedData,
              updatedAt: new Date().toISOString(),
            }
          : station,
      );

      const success = await saveData("mainData", newStations);

      if (success) {
        setStations(newStations);
        return true;
      }

      return false;
    } catch (err) {
      console.error("Error updating station:", err);
      setError(`Ошибка обновления заправки: ${err.message}`);
      return false;
    }
  };

  // Удаление заправки
  const deleteStation = async (stationId) => {
    try {
      const newStations = stations.filter(
        (station) => station.id.toString() !== stationId.toString(),
      );

      const success = await saveData("mainData", newStations);

      if (success) {
        setStations(newStations);
        return true;
      }

      return false;
    } catch (err) {
      console.error("Error deleting station:", err);
      setError(`Ошибка удаления заправки: ${err.message}`);
      return false;
    }
  };

  // Добавление данных по заправкам
  const addSettlementData = async (newData) => {
    try {
      const newSettlements = [...settlementsData];

      const existingIndex = newSettlements.findIndex(
        (item) =>
          item.period === newData.period &&
          item.stationId.toString() === newData.stationId.toString(),
      );

      if (existingIndex !== -1) {
        newSettlements[existingIndex] = {
          ...newSettlements[existingIndex],
          ...newData,
          updatedAt: new Date().toISOString(),
        };
      } else {
        newSettlements.push({
          ...newData,
          createdAt: new Date().toISOString(),
        });
      }

      const success = await saveData("data", newSettlements);

      if (success) {
        setSettlementsData(newSettlements);
        return true;
      }

      return false;
    } catch (err) {
      console.error("Error adding settlement data:", err);
      setError(`Ошибка добавления данных: ${err.message}`);
      return false;
    }
  };

  // Добавление нескольких записей данных
  const addMultipleSettlementData = async (dataArray) => {
    try {
      const newSettlements = [...settlementsData];

      dataArray.forEach((newData) => {
        const existingIndex = newSettlements.findIndex(
          (item) =>
            item.period === newData.period &&
            item.stationId.toString() === newData.stationId.toString(),
        );

        if (existingIndex !== -1) {
          newSettlements[existingIndex] = {
            ...newSettlements[existingIndex],
            ...newData,
            updatedAt: new Date().toISOString(),
          };
        } else {
          newSettlements.push({
            ...newData,
            createdAt: new Date().toISOString(),
          });
        }
      });

      const success = await saveData("data", newSettlements);

      if (success) {
        setSettlementsData(newSettlements);
        return true;
      }

      return false;
    } catch (err) {
      console.error("Error adding multiple settlement data:", err);
      setError(`Ошибка добавления данных: ${err.message}`);
      return false;
    }
  };

  // Обновление данных по заправке
  const updateSettlementData = async (updatedData) => {
    try {
      const newSettlements = settlementsData.map((item) => {
        if (
          item.period === updatedData.period &&
          item.stationId.toString() === updatedData.stationId.toString()
        ) {
          return {
            ...item,
            ...updatedData,
            updatedAt: new Date().toISOString(),
          };
        }
        return item;
      });

      const success = await saveData("data", newSettlements);

      if (success) {
        setSettlementsData(newSettlements);
        return true;
      }

      return false;
    } catch (err) {
      console.error("Error updating settlement data:", err);
      setError(`Ошибка обновления данных: ${err.message}`);
      return false;
    }
  };

  // Удаление данных по заправке
  const deleteSettlementData = async (period, stationId) => {
    try {
      const newSettlements = settlementsData.filter(
        (item) =>
          !(
            item.period === period &&
            item.stationId.toString() === stationId.toString()
          ),
      );

      const success = await saveData("data", newSettlements);

      if (success) {
        setSettlementsData(newSettlements);
        return true;
      }

      return false;
    } catch (err) {
      console.error("Error deleting settlement data:", err);
      setError(`Ошибка удаления данных: ${err.message}`);
      return false;
    }
  };

  // Добавление новой цены
  const addNewPrice = async (priceData) => {
    try {
      const newPrices = [...priceOfGas];

      if (newPrices.length > 0) {
        const lastPrice = newPrices[newPrices.length - 1];

        if (!lastPrice.endDate) {
          const newStartDate = new Date(priceData.startDate);
          const prevEndDate = new Date(newStartDate);
          prevEndDate.setDate(prevEndDate.getDate() - 1);

          const prevEndYear = prevEndDate.getFullYear();
          const prevEndMonth = (prevEndDate.getMonth() + 1)
            .toString()
            .padStart(2, "0");
          lastPrice.endDate = `${prevEndYear}-${prevEndMonth}`;
        }
      }

      newPrices.push({
        ...priceData,
        createdAt: new Date().toISOString(),
      });

      const success = await saveData("priceOfGas", newPrices);

      if (success) {
        setPriceOfGas(newPrices);
        return true;
      }

      return false;
    } catch (err) {
      console.error("Error adding price:", err);
      setError(`Ошибка добавления цены: ${err.message}`);
      return false;
    }
  };

  // Обновление цены
  const updatePrice = async (oldStartDate, updatedPriceData) => {
    try {
      const newPrices = priceOfGas.map((price) => {
        if (price.startDate === oldStartDate) {
          return {
            ...price,
            ...updatedPriceData,
            updatedAt: new Date().toISOString(),
          };
        }
        return price;
      });

      const success = await saveData("priceOfGas", newPrices);

      if (success) {
        setPriceOfGas(newPrices);
        return true;
      }

      return false;
    } catch (err) {
      console.error("Error updating price:", err);
      setError(`Ошибка обновления цены: ${err.message}`);
      return false;
    }
  };

  // Удаление цены
  const deletePrice = async (startDate) => {
    try {
      const priceIndex = priceOfGas.findIndex(
        (price) => price.startDate === startDate,
      );

      if (priceIndex === -1) {
        setError("Цена не найдена");
        return false;
      }

      const newPrices = priceOfGas.filter(
        (price) => price.startDate !== startDate,
      );

      if (priceIndex > 0 && priceIndex < priceOfGas.length) {
        const previousPrice = newPrices[priceIndex - 1];
        const nextPrice = priceOfGas[priceIndex + 1];

        if (previousPrice && nextPrice) {
          previousPrice.endDate = nextPrice.startDate;
        } else if (previousPrice) {
          previousPrice.endDate = null;
        }
      }

      const success = await saveData("priceOfGas", newPrices);

      if (success) {
        setPriceOfGas(newPrices);
        return true;
      }

      return false;
    } catch (err) {
      console.error("Error deleting price:", err);
      setError(`Ошибка удаления цены: ${err.message}`);
      return false;
    }
  };

  // Получение данных по фильтрам
  const getFilteredSettlementData = (filters = {}) => {
    const { year, month, stationId, period } = filters;

    return settlementsData.filter((item) => {
      if (period && item.period !== period) return false;

      if (year && month) {
        const expectedPeriod = `${year}-${month.toString().padStart(2, "0")}`;
        if (item.period !== expectedPeriod) return false;
      }

      if (
        stationId &&
        stationId !== "all" &&
        item.stationId.toString() !== stationId.toString()
      ) {
        return false;
      }

      return true;
    });
  };

  // Получение уникальных периодов
  const getUniquePeriods = () => {
    const periodsMap = {};
    settlementsData.forEach((item) => {
      if (item.period) {
        periodsMap[item.period] = true;
      }
    });

    return Object.keys(periodsMap)
      .sort((a, b) => new Date(b) - new Date(a))
      .map((period) => {
        const date = new Date(period);
        return {
          period,
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          monthName: date.toLocaleString("ru", { month: "long" }),
        };
      });
  };

  // Получение данных за определенный период
  const getDataByPeriod = (period) => {
    return settlementsData.filter((item) => item.period === period);
  };

  // Получение заправки по ID
  const getStationById = (stationId) => {
    return stations.find(
      (station) => station.id.toString() === stationId.toString(),
    );
  };

  // Получение текущей цены на определенную дату
  const getPriceForDate = (date) => {
    if (!priceOfGas || !priceOfGas.length) {
      return 0;
    }

    let targetDateStr;
    if (typeof date === "string") {
      targetDateStr = date;
    } else if (date instanceof Date) {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      targetDateStr = `${year}-${month}`;
    } else {
      return 0;
    }

    const price = priceOfGas.find((p) => {
      if (!p.startDate) return false;

      const startDate = new Date(p.startDate);
      const endDate = p.endDate ? new Date(p.endDate) : new Date();
      const targetDate = new Date(targetDateStr);

      return targetDate >= startDate && targetDate <= endDate;
    });

    return price ? price.price : 0;
  };

  // Получение следующего периода для добавления данных
  const getNextPeriodForDataEntry = () => {
    if (settlementsData.length === 0) {
      const now = new Date();
      return {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        period: `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`,
      };
    }

    const sortedData = [...settlementsData].sort(
      (a, b) => new Date(b.period) - new Date(a.period),
    );

    const lastPeriod = new Date(sortedData[0].period);
    lastPeriod.setMonth(lastPeriod.getMonth() + 1);

    return {
      year: lastPeriod.getFullYear(),
      month: lastPeriod.getMonth() + 1,
      period: `${lastPeriod.getFullYear()}-${(lastPeriod.getMonth() + 1).toString().padStart(2, "0")}`,
    };
  };

  // Очистка ошибок
  const clearError = () => {
    setError(null);
  };

  // Загрузка данных при монтировании
  useEffect(() => {
    loadAllData();
  }, []);

  return {
    // Состояния
    loading,
    error,
    stations,
    settlementsData,
    priceOfGas,
    regions,
    banks,
    lastUpdated,

    // Основные методы
    reloadData: loadAllData,
    reloadStations, // НОВЫЙ МЕТОД для перезагрузки станций
    clearError,

    // Методы для работы с заправками
    addNewStation,
    updateStation,
    deleteStation,
    getStationById,

    // Методы для работы с данными по заправкам
    addSettlementData,
    addMultipleSettlementData,
    updateSettlementData,
    deleteSettlementData,
    getFilteredSettlementData,
    getDataByPeriod,
    getUniquePeriods,
    getNextPeriodForDataEntry,

    // Методы для работы с ценами
    addNewPrice,
    updatePrice,
    deletePrice,
    getPriceForDate,

    // Утилиты
    getUniquePeriods,

    // Для отладки
    getDataCounts: () => ({
      stations: stations.length,
      settlements: settlementsData.length,
      prices: priceOfGas.length,
      regions: regions.length,
      banks: banks.length,
      lastUpdated: lastUpdated ? lastUpdated.toLocaleTimeString() : "Never",
    }),

    // Для тестирования
    _debug: {
      stations,
      settlementsData,
      priceOfGas,
    },
  };
};
