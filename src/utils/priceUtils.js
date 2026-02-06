// src/utils/priceUtils.js

// Функция для получения цены на газ для указанного периода
export const getPriceForPeriod = (priceOfGas, period) => {
  if (!priceOfGas || !priceOfGas.length || !period) return 0;

  try {
    const periodDate = new Date(period);

    // Ищем актуальную цену для этого периода
    const priceEntry = priceOfGas.find((p) => {
      if (!p.startDate) return false;

      const startDate = new Date(p.startDate);
      const endDate = p.endDate ? new Date(p.endDate) : new Date();

      // Проверяем, попадает ли период в диапазон цены
      return periodDate >= startDate && periodDate <= endDate;
    });

    return priceEntry ? priceEntry.price : 0;
  } catch (error) {
    console.error("Ошибка при получении цены:", error);
    return 0;
  }
};
