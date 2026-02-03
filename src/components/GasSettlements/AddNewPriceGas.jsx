import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGasSettlements } from "../../hooks/useGasSettlements";

const AddNewPriceGas = ({ open, onClose, editingPrice }) => {
  const { priceOfGas, addNewPrice, reloadData } = useGasSettlements();
  const [formData, setFormData] = useState({
    price: "",
    startDate: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    if (editingPrice) {
      setFormData({
        price: editingPrice.price.toString(),
        startDate: editingPrice.startDate,
      });
    } else {
      setFormData({
        price: "",
        startDate: "",
      });
    }
    setErrors({});
    setSubmitSuccess(false);
  }, [editingPrice, open]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.price || parseFloat(formData.price) <= 0) {
      newErrors.price = "Введите корректную цену";
    }

    if (!formData.startDate) {
      newErrors.startDate = "Выберите дату начала действия";
    } else {
      const selectedDate = new Date(formData.startDate);

      if (priceOfGas.length > 0 && !editingPrice) {
        const lastPrice = priceOfGas[priceOfGas.length - 1];
        const lastStartDate = new Date(lastPrice.startDate);

        if (selectedDate <= lastStartDate) {
          newErrors.startDate = "Дата должна быть позже предыдущей цены";
        }
      }
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

    setLoading(true);

    const priceData = {
      price: parseFloat(formData.price),
      startDate: formData.startDate,
      endDate: null,
    };

    try {
      const success = await addNewPrice(priceData);

      if (success) {
        setSubmitSuccess(true);

        // Обновляем данные в родительском компоненте
        await reloadData();

        // Закрываем модальное окно через 1 секунду
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (error) {
      console.error("Error adding price:", error);
      setErrors({ submit: "Ошибка при сохранении цены" });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }

    if (errors.submit) {
      setErrors((prev) => ({
        ...prev,
        submit: "",
      }));
    }
  };

  const generateMonths = () => {
    const months = [];
    const currentYear = new Date().getFullYear();

    for (let year = 2023; year <= currentYear + 2; year++) {
      for (let month = 1; month <= 12; month++) {
        const date = `${year}-${month.toString().padStart(2, "0")}`;
        const label = new Date(year, month - 1).toLocaleString("ru", {
          month: "long",
          year: "numeric",
        });
        months.push({ value: date, label });
      }
    }

    return months;
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
        >
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-white">
                {editingPrice ? "Редактировать цену" : "Добавить новую цену"}
              </h3>
              <button
                onClick={onClose}
                className="text-white hover:bg-purple-800 p-2 rounded-full transition-colors"
                disabled={loading}
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

          <form onSubmit={handleSubmit} className="p-6">
            {submitSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-green-500"
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
                  <p className="text-green-600 text-sm font-medium">
                    Цена успешно сохранена!
                  </p>
                </div>
              </motion.div>
            )}

            {errors.submit && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-red-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <p className="text-red-600 text-sm">{errors.submit}</p>
                </div>
              </motion.div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Цена за 1 м³ газа (сум) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className={`w-full p-3 pl-12 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                      errors.price ? "border-red-500" : "border-gray-300"
                    }`}
                    placeholder="0.00"
                    disabled={loading}
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500">сум</span>
                  </div>
                </div>
                {errors.price && (
                  <p className="mt-1 text-sm text-red-600">{errors.price}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Дата начала действия *
                </label>
                <select
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                    errors.startDate ? "border-red-500" : "border-gray-300"
                  }`}
                  disabled={loading}
                >
                  <option value="">Выберите месяц и год</option>
                  {generateMonths().map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
                {errors.startDate && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.startDate}
                  </p>
                )}
                <p className="mt-2 text-sm text-gray-500">
                  {editingPrice
                    ? "Редактирование даты может повлиять на связанные данные"
                    : priceOfGas.length > 0
                      ? `Текущая цена действует до: ${new Date(priceOfGas[priceOfGas.length - 1].startDate).toLocaleDateString("ru-RU")}`
                      : "Это будет первая цена в системе"}
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="text-blue-500">
                    <svg
                      className="w-6 h-6"
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
                  <div>
                    <p className="text-sm text-blue-800 font-medium">
                      Важная информация
                    </p>
                    <p className="text-sm text-blue-700">
                      При добавлении новой цены, предыдущая цена автоматически
                      будет закрыта. Эта цена будет применяться ко всем новым
                      операциям.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-8 mt-6 border-t">
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Отмена
              </motion.button>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || submitSuccess}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    Сохранение...
                  </div>
                ) : submitSuccess ? (
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-white"
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
                    Успешно
                  </div>
                ) : editingPrice ? (
                  "Сохранить изменения"
                ) : (
                  "Добавить цену"
                )}
              </motion.button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AddNewPriceGas;
