import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGasSettlements } from "../hooks/useGasSettlements";
import AddNewPriceGas from "../components/GasSettlements/AddNewPriceGas";

const PriceOfGasPage = () => {
  const { priceOfGas, loading, error, reloadData, deletePrice } =
    useGasSettlements();

  const [openModal, setOpenModal] = useState(false);
  const [editingPrice, setEditingPrice] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Функция для принудительного обновления данных
  const refreshData = async () => {
    await reloadData();
    setRefreshTrigger((prev) => prev + 1);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Настоящее время";
    try {
      const [year, month] = dateString.split("-");
      const date = new Date(year, month - 1, 1);
      return date.toLocaleDateString("ru-RU", {
        month: "long",
        year: "numeric",
      });
    } catch (err) {
      console.error("Error formatting date:", dateString, err);
      return dateString;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "UZS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const filteredPrices = priceOfGas.filter(
    (price) =>
      formatCurrency(price.price || 0)
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      formatDate(price.startDate || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (price.endDate &&
        formatDate(price.endDate)
          .toLowerCase()
          .includes(searchTerm.toLowerCase())),
  );

  // Обновляем данные при каждом изменении триггера
  useEffect(() => {
    console.log(
      "PriceOfGasPage: priceOfGas updated",
      priceOfGas.length,
      "items",
      priceOfGas,
    );
  }, [priceOfGas, refreshTrigger]);

  const handleDelete = async (startDate) => {
    if (!startDate) {
      console.error("No startDate provided for deletion");
      return;
    }

    if (window.confirm("Вы уверены, что хотите удалить эту цену?")) {
      const success = await deletePrice(startDate);
      if (success) {
        console.log("Price deleted successfully");
        // Обновляем данные после удаления
        await refreshData();
      } else {
        console.error("Failed to delete price");
      }
    }
  };

  const handleModalClose = async () => {
    setOpenModal(false);
    setEditingPrice(null);
    // Обновляем данные после закрытия модального окна
    await refreshData();
  };

  if (loading && priceOfGas.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error && priceOfGas.length === 0) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-red-500">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-red-800">
              Ошибка загрузки данных
            </h3>
          </div>
          <p className="text-red-700">{error}</p>
          <button
            onClick={refreshData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Повторить загрузку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-1">
            Цены на газ
          </h2>
          <p className="text-gray-600">Управление ценами на природный газ</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-gray-500">
              Всего цен: {priceOfGas.length}
            </span>
            <button
              onClick={refreshData}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              title="Обновить данные"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Обновить
            </button>
          </div>
        </div>
        <motion.button
          onClick={() => {
            setEditingPrice(null);
            setOpenModal(true);
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-5 py-2.5 rounded-xl shadow-md hover:from-purple-700 hover:to-purple-800 transition-all flex items-center gap-2"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          Добавить новую цену
        </motion.button>
      </div>

      <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Поиск по цене или дате..."
            className="w-full pl-10 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-md overflow-hidden">
        {loading && priceOfGas.length > 0 && (
          <div className="p-4 bg-blue-50 border-b border-blue-200">
            <div className="flex items-center gap-2 text-blue-700">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
              <span className="text-sm">Обновление данных...</span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gradient-to-r from-purple-50 to-purple-100">
              <tr>
                <th className="p-4 text-left font-semibold text-gray-700">
                  Цена за 1 м³ газа
                </th>
                <th className="p-4 text-left font-semibold text-gray-700">
                  Действует с
                </th>
                <th className="p-4 text-left font-semibold text-gray-700">
                  Действует по
                </th>
                <th className="p-4 text-left font-semibold text-gray-700">
                  Период действия
                </th>
                <th className="p-4 text-left font-semibold text-gray-700">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPrices.length > 0 ? (
                filteredPrices.map((price, index) => (
                  <motion.tr
                    key={`${price.startDate}-${price.price}-${index}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className={`border-t hover:bg-purple-50 transition-colors ${
                      index % 2 === 0 ? "bg-gray-50" : "bg-white"
                    }`}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xl text-purple-600">
                          {formatCurrency(price.price || 0)}
                        </span>
                        <span className="text-gray-500 text-sm">/м³</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="font-medium">
                          {formatDate(price.startDate || "")}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="font-medium">
                          {formatDate(price.endDate || "")}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800">
                        {formatDate(price.startDate || "")} →{" "}
                        {formatDate(price.endDate || "")}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            setEditingPrice(price);
                            setOpenModal(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Редактировать"
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
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDelete(price.startDate)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Удалить"
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </motion.button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <div className="text-gray-400 mb-4">
                      <svg
                        className="w-16 h-16 mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-600 mb-2">
                      {searchTerm
                        ? "По вашему запросу ничего не найдено"
                        : "Нет данных о ценах"}
                    </h3>
                    <p className="text-gray-400 mb-4">
                      {searchTerm
                        ? "Попробуйте изменить поисковый запрос"
                        : "Добавьте первую цену для начала работы"}
                    </p>
                    {!searchTerm && (
                      <motion.button
                        onClick={() => setOpenModal(true)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        Добавить первую цену
                      </motion.button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredPrices.length > 0 && (
          <div className="bg-gray-50 px-6 py-4 border-t flex justify-between items-center text-sm text-gray-600">
            <div>
              <span className="font-medium">Показано:</span>{" "}
              {filteredPrices.length} из {priceOfGas.length} цен
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span>Дата начала</span>
              </div>
              <div className="flex items-center ml-4">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                <span>Дата окончания</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {openModal && (
          <AddNewPriceGas
            open={openModal}
            onClose={handleModalClose}
            editingPrice={editingPrice}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default PriceOfGasPage;
