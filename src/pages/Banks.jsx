import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  X,
  Edit,
  Save,
  Building,
  MapPin,
  User,
  Phone,
  Search,
  Filter,
} from "lucide-react";

const Banks = () => {
  const [banks, setBanks] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Данные для нового банка
  const [newBank, setNewBank] = useState({
    name: "",
    mfo: "",
    city: "",
    street: "",
    building: "",
    directorName: "",
    directorPhone: "",
  });

  // Загрузка банков из Firestore
  const loadBanks = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "banks"));
      const banksData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setBanks(banksData);
    } catch (error) {
      console.error("Error loading banks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBanks();
  }, []);

  // Фильтрация банков по поиску
  const filteredBanks = banks.filter(
    (bank) =>
      bank.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bank.mfo?.includes(searchTerm) ||
      bank.directorName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Открытие модального окна для просмотра банка
  const handleBankClick = (bank) => {
    setSelectedBank(bank);
    setIsModalOpen(true);
    setIsEditMode(false);
  };

  // Открытие модального окна для создания банка
  const handleCreateBank = () => {
    setIsCreating(true);
    setIsModalOpen(true);
    setNewBank({
      name: "",
      mfo: "",
      city: "",
      street: "",
      building: "",
      directorName: "",
      directorPhone: "",
    });
  };

  // Закрытие модального окна
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setIsCreating(false);
    setSelectedBank(null);
  };

  // Редактирование банка
  const handleEdit = () => {
    setIsEditMode(true);
  };

  // Сохранение изменений
  const handleSave = async () => {
    try {
      if (isCreating) {
        // Создание нового банка
        await addDoc(collection(db, "banks"), {
          ...newBank,
          createdAt: new Date(),
        });
      } else {
        // Обновление существующего банка
        await updateDoc(doc(db, "banks", selectedBank.id), {
          ...selectedBank,
        });
      }

      await loadBanks();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving bank:", error);
    }
  };

  // Отмена редактирования
  const handleCancel = () => {
    if (isCreating) {
      handleCloseModal();
    } else {
      setIsEditMode(false);
      // Восстанавливаем исходные данные
      setSelectedBank(banks.find((bank) => bank.id === selectedBank.id));
    }
  };

  // Обработчик изменения полей
  const handleInputChange = (field, value) => {
    if (isCreating) {
      setNewBank((prev) => ({ ...prev, [field]: value }));
    } else {
      setSelectedBank((prev) => ({ ...prev, [field]: value }));
    }
  };

  // Анимации
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <motion.div
          className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 lg:p-8">
      {/* Заголовок и кнопка добавления */}
      <motion.div
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}>
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
            Банклар
          </h1>
          <p className="text-gray-600">Банклар бошқариш сахифаси</p>
        </div>

        <motion.button
          className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 w-full lg:w-auto justify-center"
          onClick={handleCreateBank}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}>
          <Plus size={20} />
          Банк қўшиш
        </motion.button>
      </motion.div>

      {/* Поиск и фильтры */}
      <motion.div
        className="bg-white rounded-2xl shadow-sm p-4 mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}>
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Банк номи, МФО ёки бошқарувчи номи бўйича қидириш..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
            />
          </div>
          <button className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-300 flex items-center gap-2 justify-center">
            <Filter size={20} />
            <span className="hidden lg:inline">Фильтрлар</span>
          </button>
        </div>
      </motion.div>

      {/* Таблица банков */}
      <motion.div
        className="bg-white rounded-2xl shadow-sm overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        variants={containerVariants}
        initial="hidden"
        animate="visible">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                <th className="px-4 py-4 text-left font-semibold">Банк номи</th>
                <th className="px-4 py-4 text-left font-semibold hidden md:table-cell">
                  МФО
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden lg:table-cell">
                  Шаҳар
                </th>
                <th className="px-4 py-4 text-left font-semibold">
                  Бошқарувчи
                </th>
                <th className="px-4 py-4 text-left font-semibold hidden sm:table-cell">
                  Телефон
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBanks.map((bank, index) => (
                <motion.tr
                  key={bank.id}
                  onClick={() => handleBankClick(bank)}
                  className="hover:bg-indigo-50 transition-colors duration-200 cursor-pointer group"
                  variants={itemVariants}
                  whileHover={{ scale: 1.01 }}>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                        <Building className="text-indigo-600" size={20} />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">
                          {bank.name}
                        </div>
                        <div className="text-sm text-gray-500 md:hidden">
                          МФО: {bank.mfo}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden md:table-cell">
                    {bank.mfo}
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden lg:table-cell">
                    {bank.city}
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-gray-800">
                      {bank.directorName}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 hidden sm:table-cell">
                    {bank.directorPhone}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredBanks.length === 0 && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}>
            <Building className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              {searchTerm ? "Банклар топилмади" : "Банклар қўшилмаган"}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm
                ? "Қидириш шартларни ўзгартириб кўринг"
                : "Биринчи банкни қўшишни бошланг"}
            </p>
            {!searchTerm && (
              <button
                onClick={handleCreateBank}
                className="bg-indigo-500 text-white px-6 py-2 rounded-lg hover:bg-indigo-600 transition-colors">
                Банк қўшиш
              </button>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Модальное окно */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseModal}>
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}>
              {/* Заголовок модального окна */}
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">
                    {isCreating
                      ? "Банк яратиш"
                      : isEditMode
                      ? "Банк маълумотларини таҳрирлаш"
                      : "Банк ҳақида маълумот"}
                  </h2>
                  <motion.button
                    onClick={handleCloseModal}
                    className="w-8 h-8 rounded-full bg-white bg-opacity-20 flex items-center justify-center hover:bg-opacity-30 transition-all"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}>
                    <X size={18} />
                  </motion.button>
                </div>
              </div>

              {/* Форма */}
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                <div className="space-y-6">
                  {/* Наименование банка */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <Building size={16} />
                      Банк номи
                    </label>
                    <input
                      type="text"
                      value={
                        isCreating ? newBank.name : selectedBank?.name || ""
                      }
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      disabled={!isCreating && !isEditMode}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  {/* МФО */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      МФО
                    </label>
                    <input
                      type="text"
                      value={isCreating ? newBank.mfo : selectedBank?.mfo || ""}
                      onChange={(e) => handleInputChange("mfo", e.target.value)}
                      disabled={!isCreating && !isEditMode}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  {/* Адрес организации */}
                  <div className="border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
                      <MapPin size={18} />
                      Банк манзили
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Шаҳар
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating ? newBank.city : selectedBank?.city || ""
                          }
                          onChange={(e) =>
                            handleInputChange("city", e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Кўча
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newBank.street
                              : selectedBank?.street || ""
                          }
                          onChange={(e) =>
                            handleInputChange("street", e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Уй
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newBank.building
                              : selectedBank?.building || ""
                          }
                          onChange={(e) =>
                            handleInputChange("building", e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Директор */}
                  <div className="border-t pt-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
                      <User size={18} />
                      Бошқарувчи
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Бошқарувчи ФИШ
                        </label>
                        <input
                          type="text"
                          value={
                            isCreating
                              ? newBank.directorName
                              : selectedBank?.directorName || ""
                          }
                          onChange={(e) =>
                            handleInputChange("directorName", e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </div>
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                          <Phone size={16} />
                          Бошқарувчи тел.
                        </label>
                        <input
                          type="tel"
                          value={
                            isCreating
                              ? newBank.directorPhone
                              : selectedBank?.directorPhone || ""
                          }
                          onChange={(e) =>
                            handleInputChange("directorPhone", e.target.value)
                          }
                          disabled={!isCreating && !isEditMode}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Кнопки */}
              <div className="border-t px-6 py-4 bg-gray-50">
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
                  {!isCreating && !isEditMode && (
                    <motion.button
                      onClick={handleEdit}
                      className="w-full sm:w-auto bg-indigo-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-600 transition-colors flex items-center gap-2 justify-center"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}>
                      <Edit size={16} />
                      Таҳрирлаш
                    </motion.button>
                  )}

                  {(isCreating || isEditMode) && (
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                      <motion.button
                        onClick={handleCancel}
                        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}>
                        Бекор
                      </motion.button>
                      <motion.button
                        onClick={handleSave}
                        className="bg-green-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-600 transition-colors flex items-center gap-2 justify-center"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}>
                        <Save size={16} />
                        Сақлаш
                      </motion.button>
                    </div>
                  )}

                  {!isCreating && !isEditMode && (
                    <motion.button
                      onClick={handleCloseModal}
                      className="w-full sm:w-auto px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}>
                      Ёпиш
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Banks;
