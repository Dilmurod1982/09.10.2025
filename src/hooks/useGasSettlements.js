import { useState, useEffect } from "react";
import {
  doc,
  getDoc,
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

  // Загрузка всех данных
  const loadAllData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log("=== Loading gas settlements data ===");

      // Загружаем основные данные из gasSettlements
      const gasSettlementsRef = doc(db, "gasSettlements", "main");
      const gasSettlementsSnap = await getDoc(gasSettlementsRef);

      if (gasSettlementsSnap.exists()) {
        const data = gasSettlementsSnap.data();
        console.log("Loaded gas settlements data:", data);

        // Убедимся, что данные есть и они в правильном формате
        const mainData = Array.isArray(data.mainData) ? data.mainData : [];
        const settlements = Array.isArray(data.data) ? data.data : [];
        const prices = Array.isArray(data.priceOfGas) ? data.priceOfGas : [];

        console.log("Main data count:", mainData.length);
        console.log("Settlements data count:", settlements.length);
        console.log("Price data count:", prices.length);

        if (settlements.length > 0) {
          console.log("Sample settlement data:", settlements[0]);
          console.log("Sample period:", settlements[0].period);
          console.log("Sample stationId:", settlements[0].stationId);
        }

        setStations(mainData);
        setSettlementsData(settlements);
        setPriceOfGas(prices);
      } else {
        console.log(
          "No gas settlements document found, creating empty structure",
        );
        await updateDoc(gasSettlementsRef, {
          mainData: [],
          data: [],
          priceOfGas: [],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        setStations([]);
        setSettlementsData([]);
        setPriceOfGas([]);
      }

      // Загружаем регионы
      try {
        console.log("Loading regions...");
        const regionsCollection = collection(db, "regions");
        const regionsSnapshot = await getDocs(regionsCollection);

        const regionsList = [];
        regionsSnapshot.forEach((doc) => {
          regionsList.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        console.log("Loaded regions:", regionsList.length);
        setRegions(regionsList);
      } catch (regionErr) {
        console.warn("Could not load regions:", regionErr.message);
        setRegions([]);
      }

      // Загружаем банки
      try {
        console.log("Loading banks...");
        const banksCollection = collection(db, "banks");
        const banksSnapshot = await getDocs(banksCollection);

        const banksList = [];
        banksSnapshot.forEach((doc) => {
          banksList.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        console.log("Loaded banks:", banksList.length);
        setBanks(banksList);
      } catch (bankErr) {
        console.warn("Could not load banks:", bankErr.message);
        setBanks([]);
      }

      setLastUpdated(new Date());
      console.log("=== Data loading completed ===");
    } catch (err) {
      console.error("Error loading data:", err);
      setError(`Ошибка загрузки данных: ${err.message}`);

      // Устанавливаем пустые массивы в случае ошибки
      setStations([]);
      setSettlementsData([]);
      setPriceOfGas([]);
      setRegions([]);
      setBanks([]);
    } finally {
      setLoading(false);
    }
  };

  // Сохранение данных
  const saveData = async (fieldName, data) => {
    setLoading(true);
    try {
      console.log(`Saving data to ${fieldName}:`, data);

      const docRef = doc(db, "gasSettlements", "main");
      await updateDoc(docRef, {
        [fieldName]: data,
        updatedAt: Timestamp.now(),
      });

      console.log(`Data saved to ${fieldName} successfully`);
      return true;
    } catch (err) {
      console.error("Error saving data:", err);
      setError(`Ошибка сохранения: ${err.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Добавление новой заправки
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
      };

      const newStations = [...stations, newStation];
      const success = await saveData("mainData", newStations);

      if (success) {
        setStations(newStations);
        console.log("Station added successfully:", newStation);
        return { success: true, id: newId };
      }

      return { success: false, error: "Не удалось сохранить заправку" };
    } catch (err) {
      console.error("Error adding station:", err);
      setError(`Ошибка добавления заправки: ${err.message}`);
      return { success: false, error: err.message };
    }
  };

  // Обновление заправки
  const updateStation = async (stationId, updatedData) => {
    try {
      console.log("Updating station:", stationId, updatedData);

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
        console.log("Station updated successfully");
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
      console.log("Deleting station:", stationId);

      const newStations = stations.filter(
        (station) => station.id.toString() !== stationId.toString(),
      );

      const success = await saveData("mainData", newStations);

      if (success) {
        setStations(newStations);
        console.log("Station deleted successfully");
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
      console.log("Adding settlement data:", newData);

      const newSettlements = [...settlementsData];

      // Проверяем, нет ли уже данных за этот период для этой заправки
      const existingIndex = newSettlements.findIndex(
        (item) =>
          item.period === newData.period &&
          item.stationId.toString() === newData.stationId.toString(),
      );

      if (existingIndex !== -1) {
        // Обновляем существующие данные
        newSettlements[existingIndex] = {
          ...newSettlements[existingIndex],
          ...newData,
          updatedAt: new Date().toISOString(),
        };
        console.log("Updated existing settlement record");
      } else {
        // Добавляем новые данные
        newSettlements.push({
          ...newData,
          createdAt: new Date().toISOString(),
        });
        console.log("Added new settlement record");
      }

      const success = await saveData("data", newSettlements);

      if (success) {
        setSettlementsData(newSettlements);
        console.log("Settlement data saved successfully");
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
      console.log("Adding multiple settlement data:", dataArray);

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
        console.log("Multiple settlement data saved successfully");
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
      console.log("Updating settlement data:", updatedData);

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
        console.log("Settlement data updated successfully");
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
      console.log("Deleting settlement data:", period, stationId);

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
        console.log("Settlement data deleted successfully");
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
      console.log("Adding new price:", priceData);

      // Создаем копию массива цен
      const newPrices = [...priceOfGas];

      // Если есть предыдущая цена, обновляем ее endDate
      if (newPrices.length > 0) {
        const lastPrice = newPrices[newPrices.length - 1];

        // Проверяем, что у последней цены нет endDate
        if (!lastPrice.endDate) {
          // Устанавливаем endDate предыдущей цены на день перед началом новой цены
          const newStartDate = new Date(priceData.startDate);
          const prevEndDate = new Date(newStartDate);
          prevEndDate.setDate(prevEndDate.getDate() - 1);

          // Форматируем дату как YYYY-MM
          const prevEndYear = prevEndDate.getFullYear();
          const prevEndMonth = (prevEndDate.getMonth() + 1)
            .toString()
            .padStart(2, "0");
          lastPrice.endDate = `${prevEndYear}-${prevEndMonth}`;

          console.log("Updated end date of previous price:", lastPrice);
        }
      }

      // Добавляем новую цену
      newPrices.push({
        ...priceData,
        createdAt: new Date().toISOString(),
      });

      console.log("New prices array:", newPrices);

      const success = await saveData("priceOfGas", newPrices);

      if (success) {
        setPriceOfGas(newPrices);
        console.log("Price added successfully");
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
      console.log("Updating price:", oldStartDate, updatedPriceData);

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
        console.log("Price updated successfully");
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
      console.log("Deleting price:", startDate);

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

      // Если удаляем не последнюю цену, нужно обновить endDate предыдущей
      if (priceIndex > 0 && priceIndex < priceOfGas.length) {
        const previousPrice = newPrices[priceIndex - 1];
        const nextPrice = priceOfGas[priceIndex + 1];

        if (previousPrice && nextPrice) {
          previousPrice.endDate = nextPrice.startDate;
        } else if (previousPrice) {
          // Если это была последняя цена, у предыдущей убираем endDate
          previousPrice.endDate = null;
        }
      }

      const success = await saveData("priceOfGas", newPrices);

      if (success) {
        setPriceOfGas(newPrices);
        console.log("Price deleted successfully");
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
      console.log("No price data available");
      return 0;
    }

    // Преобразуем дату в формат YYYY-MM для сравнения
    let targetDateStr;
    if (typeof date === "string") {
      targetDateStr = date;
    } else if (date instanceof Date) {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      targetDateStr = `${year}-${month}`;
    } else {
      console.log("Invalid date format:", date);
      return 0;
    }

    console.log("Looking for price on date:", targetDateStr);

    // Находим актуальную цену на заданную дату
    const price = priceOfGas.find((p) => {
      if (!p.startDate) return false;

      const startDate = new Date(p.startDate);
      const endDate = p.endDate ? new Date(p.endDate) : new Date();
      const targetDate = new Date(targetDateStr);

      return targetDate >= startDate && targetDate <= endDate;
    });

    const result = price ? price.price : 0;
    console.log(`Found price: ${result} for date ${targetDateStr}`);

    return result;
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
    getPriceForDate,
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
