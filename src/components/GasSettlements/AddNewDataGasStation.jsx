import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGasSettlements } from "../../hooks/useGasSettlements";

const AddNewDataGasStation = ({ open, onClose }) => {
  const {
    addNewStation,
    regions,
    banks,
    loading: hookLoading,
  } = useGasSettlements();

  const [formData, setFormData] = useState({
    name: "",
    landmark: "",
    region: "",
    address: "",
    bank: "",
    account: "",
    mfo: "",
    inn: "",
    startDate: "",
    startBalance: "",
  });

  const [displayStartBalance, setDisplayStartBalance] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedBank, setSelectedBank] = useState(null);

  useEffect(() => {
    if (open) {
      // Сброс формы при открытии
      setFormData({
        name: "",
        landmark: "",
        region: "",
        address: "",
        bank: "",
        account: "",
        mfo: "",
        inn: "",
        startDate: "",
        startBalance: "",
      });
      setDisplayStartBalance("");
      setSelectedBank(null);
      setErrors({});
    }
  }, [open]);

  // Валидация расчетного счета (ровно 20 цифр)
  const validateAccount = (account) => {
    const cleaned = account.replace(/\s/g, "");
    return /^\d{20}$/.test(cleaned);
  };

  // Валидация МФО (ровно 5 цифр)
  const validateMFO = (mfo) => {
    const cleaned = mfo.replace(/\s/g, "");
    return /^\d{5}$/.test(cleaned);
  };

  // Валидация ИНН (ровно 9 цифр)
  const validateINN = (inn) => {
    const cleaned = inn.replace(/\s/g, "");
    return /^\d{9}$/.test(cleaned);
  };

  // Валидация стартового сальдо (число, можно отрицательное)
  const validateStartBalance = (balance) => {
    if (balance === "") return false;
    const num = parseFloat(balance);
    return !isNaN(num);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = "Введите наименование";
    if (!formData.region) newErrors.region = "Выберите область";
    if (!formData.startDate) newErrors.startDate = "Выберите стартовый месяц";

    if (!validateStartBalance(formData.startBalance)) {
      newErrors.startBalance = "Введите корректное сальдо";
    }

    if (formData.account && !validateAccount(formData.account)) {
      newErrors.account = "Расчетный счет должен содержать ровно 20 цифр";
    }

    if (formData.bank) {
      if (!validateMFO(formData.mfo)) {
        newErrors.mfo = "МФО должен содержать ровно 5 цифр";
      }
    } else if (formData.mfo && !validateMFO(formData.mfo)) {
      newErrors.mfo = "МФО должен содержать ровно 5 цифр";
    }

    if (formData.inn && !validateINN(formData.inn)) {
      newErrors.inn = "ИНН должен содержать ровно 9 цифр";
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);

    // Очищаем пробелы из чисел перед сохранением
    const cleanData = {
      ...formData,
      account: formData.account.replace(/\s/g, ""),
      mfo: formData.mfo.replace(/\s/g, ""),
      inn: formData.inn.replace(/\s/g, ""),
      startBalance: parseFloat(formData.startBalance),
    };

    const result = await addNewStation(cleanData);

    setSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setErrors({ submit: result.error || "Ошибка при сохранении" });
    }
  };

  // Форматирование расчетного счета (20 цифр с пробелами каждые 4)
  const formatAccount = (value) => {
    const cleaned = value.replace(/\D/g, "");
    let formatted = "";

    for (let i = 0; i < cleaned.length; i++) {
      if (i > 0 && i % 4 === 0) {
        formatted += " ";
      }
      if (i < 20) {
        formatted += cleaned[i];
      }
    }

    return formatted;
  };

  // Форматирование МФО (5 цифр)
  const formatMFO = (value) => {
    const cleaned = value.replace(/\D/g, "");
    return cleaned.slice(0, 5);
  };

  // Форматирование ИНН (9 цифр)
  const formatINN = (value) => {
    const cleaned = value.replace(/\D/g, "");
    return cleaned.slice(0, 9);
  };

  // Форматирование стартового сальдо для отображения
  const formatStartBalanceDisplay = (value) => {
    if (value === "") return "";

    const cleaned = value.replace(/[^\d.-]/g, "");
    const num = parseFloat(cleaned);
    if (isNaN(num)) return cleaned;

    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Парсинг стартового сальдо из отформатированного значения
  const parseStartBalance = (formattedValue) => {
    if (formattedValue === "") return "";

    const cleaned = formattedValue.replace(/\s/g, "");
    const isNegative = cleaned.startsWith("-");
    const numStr = isNegative ? cleaned.substring(1) : cleaned;

    const num = parseFloat(numStr);
    if (isNaN(num)) return formattedValue;

    return isNegative ? (-num).toString() : num.toString();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "bank") {
      const selectedBankObj = banks.find((bank) => bank.name === value);

      if (selectedBankObj) {
        setSelectedBank(selectedBankObj);
        const bankMFO = selectedBankObj.mfo || "";
        const formattedMFO = formatMFO(bankMFO);

        setFormData((prev) => ({
          ...prev,
          [name]: value,
          mfo: formattedMFO,
        }));
      } else {
        setSelectedBank(null);
        setFormData((prev) => ({
          ...prev,
          [name]: value,
          mfo: "",
        }));
      }
    } else if (name === "account") {
      const formatted = formatAccount(value);
      setFormData((prev) => ({
        ...prev,
        [name]: formatted,
      }));
    } else if (name === "mfo") {
      if (!selectedBank) {
        const formatted = formatMFO(value);
        setFormData((prev) => ({
          ...prev,
          [name]: formatted,
        }));
      }
    } else if (name === "inn") {
      const formatted = formatINN(value);
      setFormData((prev) => ({
        ...prev,
        [name]: formatted,
      }));
    } else if (name === "startBalance") {
      const displayValue = formatStartBalanceDisplay(value);
      setDisplayStartBalance(displayValue);

      const parsedValue = parseStartBalance(displayValue);
      setFormData((prev) => ({
        ...prev,
        [name]: parsedValue,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleMFOReset = () => {
    setSelectedBank(null);
    setFormData((prev) => ({
      ...prev,
      bank: "",
      mfo: "",
    }));
  };

  const generateDateOptions = () => {
    const options = [];
    const currentYear = new Date().getFullYear();

    for (let year = 2020; year <= currentYear + 5; year++) {
      for (let month = 1; month <= 12; month++) {
        const value = `${year}-${month.toString().padStart(2, "0")}`;
        const label = `${year} ${new Date(year, month - 1).toLocaleString("ru", { month: "long" })}`;
        options.push({ value, label });
      }
    }

    return options;
  };

  const getFieldHint = (fieldName) => {
    const hints = {
      account: "20 цифр (например: 1234 5678 9012 3456 7890)",
      mfo: selectedBank
        ? "Заполняется автоматически из выбранного банка"
        : "5 цифр (например: 12345)",
      inn: "9 цифр (например: 123456789)",
      startBalance: "Можно вводить отрицательные значения",
    };
    return hints[fieldName] || "";
  };

  const getMFOButtonText = () => {
    if (selectedBank) {
      return "Изменить МФО вручную";
    }
    return "";
  };

  if (!open) return null;

  const isLoading = hookLoading || submitting;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        >
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-white">
                Добавить новую заправку
              </h3>
              <button
                onClick={onClose}
                className="text-white hover:bg-blue-800 p-2 rounded-full transition-colors"
                disabled={isLoading}
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

          <form
            onSubmit={handleSubmit}
            className="p-6 overflow-y-auto max-h-[60vh]"
          >
            {errors.submit && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{errors.submit}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Наименование заправки *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.name ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Введите наименование"
                  disabled={isLoading}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ориентир
                </label>
                <input
                  type="text"
                  name="landmark"
                  value={formData.landmark}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Введите ориентир"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Область *
                </label>
                <select
                  name="region"
                  value={formData.region}
                  onChange={handleChange}
                  className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.region ? "border-red-500" : "border-gray-300"
                  }`}
                  disabled={isLoading}
                >
                  <option value="">Выберите область</option>
                  {regions.map((region) => (
                    <option key={region.id || region.name} value={region.name}>
                      {region.name}
                    </option>
                  ))}
                </select>
                {errors.region && (
                  <p className="mt-1 text-sm text-red-600">{errors.region}</p>
                )}
                {hookLoading && regions.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Загрузка областей...
                  </p>
                )}
                {!hookLoading && regions.length === 0 && (
                  <p className="mt-1 text-xs text-yellow-600">
                    Нет доступных областей. Проверьте коллекцию regions в
                    Firestore.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Адрес
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Введите адрес"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Банк
                </label>
                <select
                  name="bank"
                  value={formData.bank}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                >
                  <option value="">Выберите банк</option>
                  {banks.map((bank) => (
                    <option key={bank.id || bank.name} value={bank.name}>
                      {bank.name}
                      {bank.mfo ? ` (МФО: ${bank.mfo})` : ""}
                    </option>
                  ))}
                </select>
                {selectedBank && selectedBank.mfo && (
                  <div className="mt-2 flex items-center text-sm text-green-600">
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>МФО банка будет заполнено автоматически</span>
                  </div>
                )}
                {hookLoading && banks.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Загрузка банков...
                  </p>
                )}
                {!hookLoading && banks.length === 0 && (
                  <p className="mt-1 text-xs text-yellow-600">
                    Нет доступных банков. Проверьте коллекцию banks в Firestore.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Расчетный счет
                </label>
                <input
                  type="text"
                  name="account"
                  value={formData.account}
                  onChange={handleChange}
                  maxLength={24}
                  className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.account ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="1234 5678 9012 3456 7890"
                  disabled={isLoading}
                />
                {errors.account ? (
                  <p className="mt-1 text-sm text-red-600">{errors.account}</p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">
                    {getFieldHint("account")}
                  </p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    МФО
                  </label>
                  {selectedBank && (
                    <button
                      type="button"
                      onClick={handleMFOReset}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      disabled={isLoading}
                    >
                      {getMFOButtonText()}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  name="mfo"
                  value={formData.mfo}
                  onChange={handleChange}
                  maxLength={5}
                  className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.mfo ? "border-red-500" : "border-gray-300"
                  } ${selectedBank ? "bg-gray-50 cursor-not-allowed" : ""}`}
                  placeholder="12345"
                  disabled={isLoading || selectedBank}
                  readOnly={!!selectedBank}
                />
                {errors.mfo ? (
                  <p className="mt-1 text-sm text-red-600">{errors.mfo}</p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">
                    {getFieldHint("mfo")}
                  </p>
                )}
                {selectedBank && selectedBank.mfo && (
                  <div className="mt-1 text-xs text-gray-500">
                    Из банка: {selectedBank.name} ({selectedBank.mfo})
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ИНН
                </label>
                <input
                  type="text"
                  name="inn"
                  value={formData.inn}
                  onChange={handleChange}
                  maxLength={9}
                  className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.inn ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="123456789"
                  disabled={isLoading}
                />
                {errors.inn ? (
                  <p className="mt-1 text-sm text-red-600">{errors.inn}</p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">
                    {getFieldHint("inn")}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Стартовый месяц *
                </label>
                <select
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.startDate ? "border-red-500" : "border-gray-300"
                  }`}
                  disabled={isLoading}
                >
                  <option value="">Выберите месяц и год</option>
                  {generateDateOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.startDate && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.startDate}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Стартовое сальдо *
                </label>
                <input
                  type="text"
                  name="startBalance"
                  value={displayStartBalance}
                  onChange={handleChange}
                  className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.startBalance ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="0"
                  disabled={isLoading}
                />
                {errors.startBalance ? (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.startBalance}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">
                    {getFieldHint("startBalance")}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="text-blue-500 mt-0.5">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-blue-800 font-medium mb-1">
                    Требования к полям:
                  </p>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>
                      • Расчетный счет: ровно 20 цифр (автоматически
                      форматируется с пробелами)
                    </li>
                    <li>
                      • При выборе банка: МФО заполняется автоматически из
                      данных банка
                    </li>
                    <li>
                      • Без выбора банка: МФО вводится вручную (ровно 5 цифр)
                    </li>
                    <li>• ИНН: ровно 9 цифр</li>
                    <li>
                      • Стартовое сальдо: можно вводить отрицательные значения
                      (отображается с группировкой)
                    </li>
                    <li>• Поля с * обязательны для заполнения</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t">
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                disabled={isLoading}
              >
                Отмена
              </motion.button>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    Сохранение...
                  </div>
                ) : (
                  "Сохранить заправку"
                )}
              </motion.button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AddNewDataGasStation;
