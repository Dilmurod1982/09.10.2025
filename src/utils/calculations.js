// Функция для сравнения дат по месяцу и году
export const isSameMonthYear = (date1, date2) => {
  if (!date1 || !date2) return false;
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth()
  );
};

// Функция для преобразования строки периода в Date
export const parsePeriodToDate = (period) => {
  if (!period) return null;

  try {
    // Поддерживаемые форматы: YYYY-MM, YYYY/MM, MM/YYYY, полная дата
    if (period.includes("-")) {
      // Формат YYYY-MM
      const [year, month] = period.split("-").map(Number);
      if (year && month) {
        return new Date(year, month - 1, 1);
      }
    } else if (period.includes("/")) {
      // Формат YYYY/MM или MM/YYYY
      const parts = period.split("/").map(Number);
      if (parts.length === 2) {
        if (parts[0] > 12) {
          // YYYY/MM
          return new Date(parts[0], parts[1] - 1, 1);
        } else {
          // MM/YYYY
          return new Date(parts[1], parts[0] - 1, 1);
        }
      }
    }

    // Пробуем как полную дату
    const date = new Date(period);
    if (!isNaN(date.getTime())) {
      return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    return null;
  } catch (error) {
    console.error("Error parsing period:", period, error);
    return null;
  }
};

// Расчет стартового баланса (исправленная версия)
export const calculateStartBalance = (
  mainData,
  data,
  selectedDate,
  stationId,
) => {
  if (!mainData || !data || mainData.length === 0) return 0;

  // Находим стартовые данные для конкретной станции
  const startData = mainData.find((item) =>
    stationId ? item.id.toString() === stationId.toString() : true,
  );

  if (!startData || !startData.startDate) {
    // console.log("No start data found for station:", stationId);
    return 0;
  }

  let balance = parseFloat(startData.startBalance) || 0;

  const startDate = parsePeriodToDate(startData.startDate);
  const endDate = new Date(selectedDate);

  if (!startDate) {
    // console.log("Could not parse start date:", startData.startDate);
    return balance;
  }

  // console.log(`Calculating balance for station ${stationId}`);
  // console.log("Start date:", startDate, "End date:", endDate);

  // Фильтруем данные по дате и станции
  const relevantData = data.filter((item) => {
    if (!item.period) return false;

    const itemDate = parsePeriodToDate(item.period);
    if (!itemDate) return false;

    const isDateInRange = itemDate >= startDate && itemDate < endDate;
    const isSameStation =
      !stationId || item.stationId.toString() === stationId.toString();

    return isDateInRange && isSameStation;
  });

  // Сортируем по дате
  relevantData.sort((a, b) => {
    const dateA = parsePeriodToDate(a.period);
    const dateB = parsePeriodToDate(b.period);
    return dateA - dateB;
  });

  // console.log(`Found ${relevantData.length} relevant records`);

  // Рассчитываем баланс
  relevantData.forEach((item, idx) => {
    const amount = parseFloat(item.amountOfGas) || 0;
    const payment = parseFloat(item.payment) || 0;
    const netChange = amount - payment;

    // console.log(
    //   `Record ${idx + 1}: amount=${amount}, payment=${payment}, net=${netChange}`,
    // );

    balance += netChange;
  });

  // console.log(`Final balance for station ${stationId}: ${balance}`);
  return balance;
};

// Расчет конечного баланса
export const calculateEndBalance = (
  startBalance,
  amountOfGas,
  amountOfLimit,
  payment,
) => {
  const gasAmount = amountOfGas || amountOfLimit || 0;
  const finalBalance = startBalance + gasAmount - (payment || 0);

  // console.log("End balance calculation:", {
  //   startBalance,
  //   gasAmount,
  //   payment,
  //   finalBalance,
  // });

  return finalBalance;
};

// Поиск цены на определенную дату
export const findPriceForDate = (priceOfGas, date) => {
  if (!priceOfGas || !priceOfGas.length) {
    // console.log("No price data available");
    return 0;
  }

  const targetDate = parsePeriodToDate(date);
  if (!targetDate) {
    // console.log("Could not parse target date:", date);
    return 0;
  }

  // console.log("Looking for price on date:", targetDate);

  // Находим актуальную цену на заданную дату
  const price = priceOfGas.find((p) => {
    if (!p.startDate) return false;

    const startDate = parsePeriodToDate(p.startDate);
    if (!startDate) return false;

    const endDate = p.endDate ? parsePeriodToDate(p.endDate) : new Date();

    const isWithinRange = targetDate >= startDate && targetDate <= endDate;

    if (isWithinRange) {
      // console.log(`Found price: ${p.price} from ${startDate} to ${endDate}`);
    }

    return isWithinRange;
  });

  return price ? price.price : 0;
};

// Получение следующего периода
export const getNextPeriod = (settlementsData) => {
  if (!settlementsData || settlementsData.length === 0) {
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

  const lastPeriod = parsePeriodToDate(sortedData[0].period);
  if (!lastPeriod) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      period: `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`,
    };
  }

  lastPeriod.setMonth(lastPeriod.getMonth() + 1);

  return {
    year: lastPeriod.getFullYear(),
    month: lastPeriod.getMonth() + 1,
    period: `${lastPeriod.getFullYear()}-${(lastPeriod.getMonth() + 1).toString().padStart(2, "0")}`,
  };
};

// Расчет суммы лимита газа
export const calculateAmountOfLimit = (limit, priceOfGas, period) => {
  const price = findPriceForDate(priceOfGas, period);
  const result = limit * price;

  // console.log("Amount of limit calculation:", {
  //   limit,
  //   price,
  //   period,
  //   result,
  // });

  return result;
};

// Расчет суммы газа
export const calculateAmountOfGas = (gasData, priceOfGas, period) => {
  const { gasByMeter = 0, confError = 0, lowPress = 0, gasAct = 0 } = gasData;
  const totalGas = gasByMeter + confError + lowPress + gasAct;
  const price = findPriceForDate(priceOfGas, period);
  const result = totalGas * price;

  // console.log("Amount of gas calculation:", {
  //   gasByMeter,
  //   confError,
  //   lowPress,
  //   gasAct,
  //   totalGas,
  //   price,
  //   period,
  //   result,
  // });

  return result;
};

// Вспомогательная функция для форматирования периода
export const formatPeriod = (year, month) => {
  return `${year}-${month.toString().padStart(2, "0")}`;
};

// Проверка, совпадает ли период
export const isPeriodMatch = (period1, year, month) => {
  if (!period1) return false;
  const expectedPeriod = `${year}-${month.toString().padStart(2, "0")}`;
  return period1 === expectedPeriod;
};
