import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase/config";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../lib/zustand";
import {
  Search,
  Filter,
  Download,
  Plus,
  X,
  Calendar,
  Hash,
  Building,
  Fuel,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import toast from "react-hot-toast";

// Вспомогательная функция для получения квартала по дате
const getQuarterFromDate = (dateString) => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;

  if (month >= 1 && month <= 3) return "I";
  if (month >= 4 && month <= 6) return "II";
  if (month >= 7 && month <= 9) return "III";
  if (month >= 10 && month <= 12) return "IV";

  return "I";
};

// Функция для получения имени коллекции по дате
const getCollectionNameByDate = (dateString) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const quarter = getQuarterFromDate(dateString);

  return `unifiedDailyReports_${quarter}_${year}`;
};

// Основной компонент страницы учета пломб
const Seal = () => {
  const [seals, setSeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stations, setStations] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedSeal, setSelectedSeal] = useState(null);

  // Фильтры
  const [filters, setFilters] = useState({
    stationId: "",
    year: "",
    month: "",
    sealNumber: "",
    installDate: "",
  });

  // Состояние для новой/редактируемой пломбы
  const [newSeal, setNewSeal] = useState({
    stationId: "",
    hose: "",
    sealNumber: "",
    installDate: new Date().toISOString().split("T")[0],
    notes: "",
    installedBy: auth?.currentUser?.email || "",
    status: "active", // active, removed
  });

  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Загружаем станции
        const stationsSnapshot = await getDocs(collection(db, "stations"));
        const stationsData = stationsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setStations(stationsData);

        // Загружаем все пломбы из коллекции seals
        const sealsSnapshot = await getDocs(collection(db, "seals"));
        const sealsData = sealsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Получаем дополнительные данные о шлангах из отчетов
        const enrichedSeals = await Promise.all(
          sealsData.map(async (seal) => {
            try {
              // Получаем данные станции
              const station = stationsData.find((s) => s.id === seal.stationId);

              // Если есть дата установки, ищем информацию о шланге в отчетах
              let hoseInfo = null;
              if (seal.installDate) {
                const collectionName = getCollectionNameByDate(
                  seal.installDate
                );

                try {
                  const reportsQuery = query(
                    collection(db, collectionName),
                    where("stationId", "==", seal.stationId),
                    where("reportDate", "==", seal.installDate)
                  );

                  const reportsSnapshot = await getDocs(reportsQuery);
                  if (!reportsSnapshot.empty) {
                    const report = reportsSnapshot.docs[0].data();
                    // Находим информацию о шланге
                    const hoseData = report.hoseData?.find(
                      (h) => h.hose === seal.hose
                    );
                    if (hoseData) {
                      hoseInfo = {
                        currentReading: hoseData.current,
                        prevReading: hoseData.prev,
                        diff: hoseData.diff,
                      };
                    }
                  }
                } catch (error) {
                  // Если коллекция не существует, игнорируем ошибку
                }
              }

              return {
                ...seal,
                stationName: station?.stationName || "Неизвестная станция",
                hoseInfo,
              };
            } catch (error) {
              console.error("Error enriching seal data:", error);
              return {
                ...seal,
                stationName: "Неизвестная станция",
                hoseInfo: null,
              };
            }
          })
        );

        setSeals(enrichedSeals);
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Маълумотларни юклашда хатолик");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Получение списка доступных шлангов для выбранной станции
  const getAvailableHosesForStation = useCallback(
    async (stationId, installDate) => {
      if (!stationId || !installDate) return [];

      try {
        const collectionName = getCollectionNameByDate(installDate);

        // Пытаемся получить отчеты для выбранной даты
        const reportsQuery = query(
          collection(db, collectionName),
          where("stationId", "==", stationId),
          where("reportDate", "==", installDate)
        );

        const reportsSnapshot = await getDocs(reportsQuery);
        if (!reportsSnapshot.empty) {
          const report = reportsSnapshot.docs[0].data();
          return report.hoseData?.map((h) => h.hose) || [];
        }

        // Если отчетов нет, пробуем найти отчеты за последние 30 дней
        const date = new Date(installDate);
        const pastDate = new Date(date);
        pastDate.setDate(pastDate.getDate() - 30);

        const allHoses = [];

        // Проверяем несколько квартальных коллекций
        for (let i = 0; i < 4; i++) {
          const currentDate = new Date(date);
          currentDate.setDate(currentDate.getDate() - i * 7);

          const quarterCollection = getCollectionNameByDate(
            currentDate.toISOString().split("T")[0]
          );

          try {
            const pastReportsQuery = query(
              collection(db, quarterCollection),
              where("stationId", "==", stationId)
            );

            const pastSnapshot = await getDocs(pastReportsQuery);
            pastSnapshot.docs.forEach((doc) => {
              const reportData = doc.data();
              if (reportData.hoseData) {
                reportData.hoseData.forEach((hose) => {
                  if (!allHoses.includes(hose.hose)) {
                    allHoses.push(hose.hose);
                  }
                });
              }
            });
          } catch (error) {
            // Игнорируем ошибки доступа к коллекциям
            continue;
          }
        }

        return allHoses;
      } catch (error) {
        console.error("Error getting hoses:", error);
        return [];
      }
    },
    []
  );

  // Получение предыдущей пломбы для выбранного шланга
  const getPreviousSealForHose = useCallback(
    async (stationId, hose, installDate) => {
      if (!stationId || !hose || !installDate) return null;

      try {
        const sealsQuery = query(
          collection(db, "seals"),
          where("stationId", "==", stationId),
          where("hose", "==", hose),
          where("status", "==", "active"),
          orderBy("installDate", "desc")
        );

        const sealsSnapshot = await getDocs(sealsQuery);

        if (!sealsSnapshot.empty) {
          const previousSeal = sealsSnapshot.docs[0];
          const data = previousSeal.data();

          // Проверяем, что найденная пломба была установлена раньше текущей даты
          if (data.installDate < installDate) {
            return {
              id: previousSeal.id,
              ...data,
            };
          }
        }

        return null;
      } catch (error) {
        console.error("Error getting previous seal:", error);
        return null;
      }
    },
    []
  );

  // Обработчик изменения фильтров
  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Применение фильтров
  const filteredSeals = useMemo(() => {
    return seals.filter((seal) => {
      // Фильтр по станции
      if (filters.stationId && seal.stationId !== filters.stationId) {
        return false;
      }

      // Фильтр по году
      if (filters.year) {
        const sealYear = new Date(seal.installDate).getFullYear().toString();
        if (sealYear !== filters.year) {
          return false;
        }
      }

      // Фильтр по месяцу
      if (filters.month) {
        const sealMonth = (
          new Date(seal.installDate).getMonth() + 1
        ).toString();
        if (sealMonth !== filters.month) {
          return false;
        }
      }

      // Фильтр по номеру пломбы
      if (
        filters.sealNumber &&
        !seal.sealNumber
          .toLowerCase()
          .includes(filters.sealNumber.toLowerCase())
      ) {
        return false;
      }

      // Фильтр по дате установки
      if (filters.installDate && seal.installDate !== filters.installDate) {
        return false;
      }

      return true;
    });
  }, [seals, filters]);

  // Получение уникальных годов из данных
  const availableYears = useMemo(() => {
    const years = new Set();
    seals.forEach((seal) => {
      if (seal.installDate) {
        const year = new Date(seal.installDate).getFullYear();
        years.add(year.toString());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [seals]);

  // Получение уникальных месяцев из данных
  const availableMonths = useMemo(() => {
    const months = [
      { value: "1", label: "Январь" },
      { value: "2", label: "Февраль" },
      { value: "3", label: "Март" },
      { value: "4", label: "Апрель" },
      { value: "5", label: "Май" },
      { value: "6", label: "Июнь" },
      { value: "7", label: "Июль" },
      { value: "8", label: "Август" },
      { value: "9", label: "Сентябрь" },
      { value: "10", label: "Октябрь" },
      { value: "11", label: "Ноябрь" },
      { value: "12", label: "Декабрь" },
    ];

    if (filters.year) {
      const filteredMonths = months.filter((month) => {
        const hasSealInMonth = seals.some((seal) => {
          if (!seal.installDate) return false;
          const sealDate = new Date(seal.installDate);
          return (
            sealDate.getFullYear().toString() === filters.year &&
            (sealDate.getMonth() + 1).toString() === month.value
          );
        });
        return hasSealInMonth;
      });
      return filteredMonths;
    }

    return months;
  }, [seals, filters.year]);

  // Обработчик открытия модального окна для создания новой пломбы
  const handleCreateSeal = () => {
    setNewSeal({
      stationId: "",
      hose: "",
      sealNumber: "",
      installDate: new Date().toISOString().split("T")[0],
      notes: "",
      installedBy: auth?.currentUser?.email || "",
      status: "active",
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  // Обработчик открытия модального окна для редактирования пломбы
  const handleEditSeal = (seal) => {
    setSelectedSeal(seal);
    setNewSeal({
      stationId: seal.stationId,
      hose: seal.hose,
      sealNumber: seal.sealNumber,
      installDate: seal.installDate,
      notes: seal.notes || "",
      installedBy: seal.installedBy,
      status: seal.status,
    });
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  // Обработчик закрытия модального окна
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setSelectedSeal(null);
    setNewSeal({
      stationId: "",
      hose: "",
      sealNumber: "",
      installDate: new Date().toISOString().split("T")[0],
      notes: "",
      installedBy: auth?.currentUser?.email || "",
      status: "active",
    });
  };

  // Обработчик сохранения пломбы
  const handleSaveSeal = async () => {
    try {
      // Валидация
      if (
        !newSeal.stationId ||
        !newSeal.hose ||
        !newSeal.sealNumber ||
        !newSeal.installDate
      ) {
        toast.error("Барча мажбурий майдонларни тўлдиринг");
        return;
      }

      if (newSeal.notes && newSeal.notes.length > 250) {
        toast.error("Изох 250 та белгидан ошмаслиги керак");
        return;
      }

      // Проверяем, существует ли уже активная пломба на этот шланг
      if (newSeal.status === "active") {
        const existingSealQuery = query(
          collection(db, "seals"),
          where("stationId", "==", newSeal.stationId),
          where("hose", "==", newSeal.hose),
          where("status", "==", "active")
        );

        const existingSnapshot = await getDocs(existingSealQuery);

        if (!existingSnapshot.empty) {
          const existingSeal = existingSnapshot.docs[0];
          // Если редактируем ту же пломбу, пропускаем проверку
          if (
            !isEditMode ||
            (isEditMode && existingSeal.id !== selectedSeal?.id)
          ) {
            toast.error("Бу шлангга аллакачон фаол пломба ўрнатилган");
            return;
          }
        }
      }

      const sealData = {
        ...newSeal,
        updatedAt: serverTimestamp(),
        updatedBy: auth?.currentUser?.email,
      };

      if (isEditMode && selectedSeal) {
        // Обновляем существующую пломбу
        await updateDoc(doc(db, "seals", selectedSeal.id), sealData);
        toast.success("Пломба мувафақиятли янгиланди");
      } else {
        // Создаем новую пломбу
        sealData.createdAt = serverTimestamp();
        sealData.createdBy = auth?.currentUser?.email;

        await addDoc(collection(db, "seals"), sealData);
        toast.success("Пломба мувафақиятли қўшилди");
      }

      // Перезагружаем данные
      const sealsSnapshot = await getDocs(collection(db, "seals"));
      const sealsData = sealsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Обогащаем данные
      const enrichedSeals = await Promise.all(
        sealsData.map(async (seal) => {
          const station = stations.find((s) => s.id === seal.stationId);
          return {
            ...seal,
            stationName: station?.stationName || "Неизвестная станция",
            hoseInfo: null, // Можно добавить логику для получения hoseInfo если нужно
          };
        })
      );

      setSeals(enrichedSeals);
      handleCloseModal();
    } catch (error) {
      console.error("Error saving seal:", error);
      toast.error("Пломбани сақлашда хатолик");
    }
  };

  // Обработчик удаления пломбы (установка статуса "removed")
  const handleRemoveSeal = async (seal) => {
    if (!window.confirm("Пломбани ўчиришни тасдиқлайсизми?")) {
      return;
    }

    try {
      await updateDoc(doc(db, "seals", seal.id), {
        status: "removed",
        removedAt: serverTimestamp(),
        removedBy: auth?.currentUser?.email,
        updatedAt: serverTimestamp(),
        updatedBy: auth?.currentUser?.email,
      });

      toast.success("Пломба мувафақиятли ўчирилди");

      // Обновляем локальное состояние
      setSeals((prev) =>
        prev.map((s) =>
          s.id === seal.id
            ? { ...s, status: "removed", removedAt: new Date().toISOString() }
            : s
        )
      );
    } catch (error) {
      console.error("Error removing seal:", error);
      toast.error("Пломбани ўчиришда хатолик");
    }
  };

  // Экспорт данных в CSV
  const handleExportToCSV = () => {
    const headers = [
      "№",
      "Заправка номи",
      "Шланг",
      "Жорий урнатилган пломба раками",
      "Пломба урнатилган сана",
      "Изох",
      "Ҳолати",
    ];

    const csvData = filteredSeals.map((seal, index) => [
      index + 1,
      seal.stationName,
      seal.hose,
      seal.sealNumber,
      new Date(seal.installDate).toLocaleDateString("ru-RU"),
      seal.notes || "",
      seal.status === "active" ? "Фаол" : "Ўчирилган",
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `пломбалар_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Компонент модального окна для установки/редактирования пломбы
  const SealModal = () => {
    const [availableHoses, setAvailableHoses] = useState([]);
    const [previousSeal, setPreviousSeal] = useState(null);
    const [loadingHoses, setLoadingHoses] = useState(false);
    const [loadingPreviousSeal, setLoadingPreviousSeal] = useState(false);

    // Загружаем доступные шланги при изменении станции или даты
    useEffect(() => {
      const loadHoses = async () => {
        if (!newSeal.stationId || !newSeal.installDate) {
          setAvailableHoses([]);
          return;
        }

        setLoadingHoses(true);
        try {
          const hoses = await getAvailableHosesForStation(
            newSeal.stationId,
            newSeal.installDate
          );
          setAvailableHoses(hoses);
        } catch (error) {
          console.error("Error loading hoses:", error);
          setAvailableHoses([]);
        } finally {
          setLoadingHoses(false);
        }
      };

      loadHoses();
    }, [newSeal.stationId, newSeal.installDate, getAvailableHosesForStation]);

    // Загружаем предыдущую пломбу при изменении шланга
    useEffect(() => {
      const loadPreviousSeal = async () => {
        if (!newSeal.stationId || !newSeal.hose || !newSeal.installDate) {
          setPreviousSeal(null);
          return;
        }

        setLoadingPreviousSeal(true);
        try {
          const prevSeal = await getPreviousSealForHose(
            newSeal.stationId,
            newSeal.hose,
            newSeal.installDate
          );
          setPreviousSeal(prevSeal);
        } catch (error) {
          console.error("Error loading previous seal:", error);
          setPreviousSeal(null);
        } finally {
          setLoadingPreviousSeal(false);
        }
      };

      loadPreviousSeal();
    }, [
      newSeal.stationId,
      newSeal.hose,
      newSeal.installDate,
      getPreviousSealForHose,
    ]);

    // Обработчик изменения данных в форме
    const handleInputChange = (field, value) => {
      setNewSeal((prev) => ({ ...prev, [field]: value }));
    };

    // Валидация формы
    const isFormValid = () => {
      return (
        newSeal.stationId &&
        newSeal.hose &&
        newSeal.sealNumber &&
        newSeal.installDate &&
        (!newSeal.notes || newSeal.notes.length <= 250)
      );
    };

    return (
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseModal}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Заголовок модального окна */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">
                    {isEditMode ? "Пломбани таҳрирлаш" : "Пломба урнатиш"}
                  </h2>
                  <motion.button
                    onClick={handleCloseModal}
                    className="w-8 h-8 rounded-full bg-white bg-opacity-20 flex items-center justify-center hover:bg-opacity-30 transition-all"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X size={18} />
                  </motion.button>
                </div>
              </div>

              {/* Форма */}
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                <div className="space-y-6">
                  {/* Выбор заправки */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Заправка номи *
                    </label>
                    <select
                      value={newSeal.stationId}
                      onChange={(e) =>
                        handleInputChange("stationId", e.target.value)
                      }
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    >
                      <option value="">Заправкани танланг</option>
                      {stations.map((station) => (
                        <option key={station.id} value={station.id}>
                          {station.stationName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Дата установки */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Пломба урнатилган сана *
                    </label>
                    <input
                      type="date"
                      value={newSeal.installDate}
                      onChange={(e) =>
                        handleInputChange("installDate", e.target.value)
                      }
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      max={new Date().toISOString().split("T")[0]}
                    />
                  </div>

                  {/* Выбор шланга */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Шланг *
                    </label>
                    <div className="relative">
                      <select
                        value={newSeal.hose}
                        onChange={(e) =>
                          handleInputChange("hose", e.target.value)
                        }
                        disabled={!newSeal.stationId || loadingHoses}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
                      >
                        <option value="">Шлангни танланг</option>
                        {loadingHoses ? (
                          <option value="" disabled>
                            Шланглар юкланмоқда...
                          </option>
                        ) : availableHoses.length > 0 ? (
                          availableHoses.map((hose) => (
                            <option key={hose} value={hose}>
                              {hose}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>
                            Шланглар топилмади
                          </option>
                        )}
                      </select>
                      {loadingHoses && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    {!newSeal.stationId && (
                      <p className="mt-1 text-sm text-gray-500">
                        Илтимос, аввал заправкани танланг
                      </p>
                    )}
                  </div>

                  {/* Информация о предыдущей пломбе */}
                  {newSeal.hose && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-yellow-800 flex items-center gap-2">
                          <AlertCircle size={16} />
                          Олдинги пломба ҳақида маълумот
                        </h4>
                        {loadingPreviousSeal && (
                          <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                        )}
                      </div>

                      {previousSeal ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-600">
                                Пломба раками:
                              </span>
                              <div className="font-semibold">
                                {previousSeal.sealNumber}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600">
                                Урнатилган сана:
                              </span>
                              <div className="font-semibold">
                                {new Date(
                                  previousSeal.installDate
                                ).toLocaleDateString("ru-RU")}
                              </div>
                            </div>
                          </div>
                          {previousSeal.notes && (
                            <div>
                              <span className="text-gray-600">Изох:</span>
                              <div className="text-sm">
                                {previousSeal.notes}
                              </div>
                            </div>
                          )}
                          <div className="text-xs text-yellow-700 mt-2">
                            ⚠️ Бу шлангга олдин пломба ўрнатилган. Янги пломба
                            ўрнатсангиз, олдингиси автоматик равишда ўчирилади.
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-2">
                          <CheckCircle
                            className="mx-auto text-green-500 mb-2"
                            size={24}
                          />
                          <p className="text-green-700 font-medium">
                            Бу шлангга олдинги пломба топилмади
                          </p>
                          <p className="text-sm text-green-600 mt-1">
                            Янги пломбани хавфсиз ўрнатишингиз мумкин
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Номер новой пломбы */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Янги пломба раками *
                    </label>
                    <input
                      type="text"
                      value={newSeal.sealNumber}
                      onChange={(e) =>
                        handleInputChange("sealNumber", e.target.value)
                      }
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Пломба ракамини киритинг"
                    />
                  </div>

                  {/* Примечание */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Изох (ихтиёрий)
                    </label>
                    <textarea
                      value={newSeal.notes || ""}
                      onChange={(e) =>
                        handleInputChange("notes", e.target.value)
                      }
                      maxLength={250}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                      placeholder="Изох киритинг (максимум 250 та белги)"
                    />
                    <div className="flex justify-between items-center mt-1">
                      <div className="text-sm text-gray-500">
                        {newSeal.notes?.length || 0}/250
                      </div>
                      {newSeal.notes && newSeal.notes.length > 250 && (
                        <div className="text-red-600 text-sm flex items-center gap-1">
                          <X size={14} />
                          Ҳаддан ортиқ белги
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Информация о сохранении */}
                  {isEditMode && selectedSeal && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="text-sm text-blue-800">
                        <div className="font-semibold mb-1">Маълумот:</div>
                        <div>
                          Яратилган:{" "}
                          {new Date(
                            selectedSeal.createdAt?.toDate?.() ||
                              selectedSeal.createdAt
                          ).toLocaleString("ru-RU")}
                        </div>
                        <div>Яратган: {selectedSeal.createdBy}</div>
                        {selectedSeal.updatedAt && (
                          <div>
                            Сўнгги янгиланган:{" "}
                            {new Date(
                              selectedSeal.updatedAt?.toDate?.() ||
                                selectedSeal.updatedAt
                            ).toLocaleString("ru-RU")}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Кнопки */}
              <div className="border-t px-6 py-4 bg-gray-50">
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <motion.button
                      onClick={handleCloseModal}
                      className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors w-full sm:w-auto"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Бекор
                    </motion.button>
                    <motion.button
                      onClick={handleSaveSeal}
                      disabled={!isFormValid()}
                      className={`px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2 justify-center w-full sm:w-auto ${
                        isFormValid()
                          ? "bg-blue-500 text-white hover:bg-blue-600 cursor-pointer"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                      whileHover={isFormValid() ? { scale: 1.02 } : {}}
                      whileTap={isFormValid() ? { scale: 0.98 } : {}}
                    >
                      Сақлаш
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 flex items-center justify-center">
        <motion.div
          className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 p-4 lg:p-8">
      {/* Заголовок и кнопки */}
      <motion.div
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
            Пломбалар ҳисоби
          </h1>
          <p className="text-gray-600">
            Заправка шлангларига ўрнатилган пломбаларни бошқариш
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <motion.button
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 justify-center"
            onClick={handleCreateSeal}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus size={20} />
            Пломба урнатиш
          </motion.button>
          <motion.button
            className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 justify-center"
            onClick={handleExportToCSV}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Download size={20} />
            Экспорт (CSV)
          </motion.button>
        </div>
      </motion.div>

      {/* Фильтры */}
      <motion.div
        className="bg-white rounded-2xl shadow-sm p-6 mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
          <Filter size={20} />
          Фильтрлар
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Фильтр по заправке */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Заправка номи
            </label>
            <select
              value={filters.stationId}
              onChange={(e) => handleFilterChange("stationId", e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">Барча заправкалар</option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.stationName}
                </option>
              ))}
            </select>
          </div>

          {/* Фильтр по году */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Йил
            </label>
            <select
              value={filters.year}
              onChange={(e) => handleFilterChange("year", e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">Барча йиллар</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Фильтр по месяцу */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Ой
            </label>
            <select
              value={filters.month}
              onChange={(e) => handleFilterChange("month", e.target.value)}
              disabled={!filters.year}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="">Барча ойлар</option>
              {availableMonths.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          {/* Фильтр по номеру пломбы */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Пломба раками
            </label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                value={filters.sealNumber}
                onChange={(e) =>
                  handleFilterChange("sealNumber", e.target.value)
                }
                placeholder="Пломба ракамини киритинг"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Фильтр по дате установки */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Пломба урнатилган сана
            </label>
            <input
              type="date"
              value={filters.installDate}
              onChange={(e) =>
                handleFilterChange("installDate", e.target.value)
              }
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Кнопка сброса фильтров */}
        {(filters.stationId ||
          filters.year ||
          filters.month ||
          filters.sealNumber ||
          filters.installDate) && (
          <div className="mt-4">
            <button
              onClick={() =>
                setFilters({
                  stationId: "",
                  year: "",
                  month: "",
                  sealNumber: "",
                  installDate: "",
                })
              }
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
            >
              <X size={14} />
              Фильтрларни тозалаш
            </button>
          </div>
        )}
      </motion.div>

      {/* Таблица пломб */}
      <motion.div
        className="bg-white rounded-2xl shadow-sm overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <th className="px-6 py-4 text-left font-semibold">№</th>
                <th className="px-6 py-4 text-left font-semibold">
                  Заправка номи
                </th>
                <th className="px-6 py-4 text-left font-semibold">Шланг</th>
                <th className="px-6 py-4 text-left font-semibold">
                  Жорий урнатилган пломба раками
                </th>
                <th className="px-6 py-4 text-left font-semibold">
                  Пломба урнатилган сана
                </th>
                <th className="px-6 py-4 text-left font-semibold">Изох</th>
                <th className="px-6 py-4 text-left font-semibold">Ҳолати</th>
                <th className="px-6 py-4 text-left font-semibold">
                  Ҳаракатлар
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSeals.length > 0 ? (
                filteredSeals.map((seal, index) => (
                  <motion.tr
                    key={seal.id}
                    className={`hover:bg-blue-50 transition-colors duration-200 ${
                      seal.status === "removed" ? "bg-gray-50" : ""
                    }`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-800">
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building className="text-blue-600" size={20} />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800">
                            {seal.stationName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Fuel className="text-green-500" size={16} />
                        <span className="font-medium text-gray-700">
                          {seal.hose}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Hash className="text-purple-500" size={16} />
                        <span className="font-semibold text-gray-800">
                          {seal.sealNumber}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="text-orange-500" size={16} />
                        <span className="font-medium text-gray-700">
                          {new Date(seal.installDate).toLocaleDateString(
                            "ru-RU"
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-xs">
                        <span className="text-gray-600 text-sm">
                          {seal.notes || "Изох мавжуд эмас"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          seal.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {seal.status === "active" ? (
                          <>
                            <CheckCircle size={14} className="mr-1" />
                            Фаол
                          </>
                        ) : (
                          <>
                            <AlertCircle size={14} className="mr-1" />
                            Ўчирилган
                          </>
                        )}
                      </div>
                      {seal.removedAt && (
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(
                            seal.removedAt?.toDate?.() || seal.removedAt
                          ).toLocaleDateString("ru-RU")}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {seal.status === "active" && (
                          <>
                            <motion.button
                              onClick={() => handleEditSeal(seal)}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              title="Таҳрирлаш"
                            >
                              <Edit size={16} />
                            </motion.button>
                            <motion.button
                              onClick={() => handleRemoveSeal(seal)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              title="Ўчириш"
                            >
                              <Trash2 size={16} />
                            </motion.button>
                          </>
                        )}
                        {seal.status === "removed" && (
                          <span className="text-sm text-gray-500">
                            Ҳаракатлар чекланган
                          </span>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <AlertCircle className="text-gray-400 mb-4" size={48} />
                      <h3 className="text-lg font-semibold text-gray-600 mb-2">
                        {Object.values(filters).some((f) => f)
                          ? "Фильтр бўйича пломбалар топилмади"
                          : "Пломбалар мавжуд эмас"}
                      </h3>
                      <p className="text-gray-500 mb-4">
                        {Object.values(filters).some((f) => f)
                          ? "Фильтр параметрларини ўзгартириб кўринг"
                          : "Биринчи пломбани қўшиш учун 'Пломба урнатиш' тугмасини босинг"}
                      </p>
                      {!Object.values(filters).some((f) => f) && (
                        <button
                          onClick={handleCreateSeal}
                          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          Пломба урнатиш
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Пагинация/информация */}
        {filteredSeals.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-center">
            <div className="text-sm text-gray-600 mb-2 sm:mb-0">
              Жами: {filteredSeals.length} пломба
              {filters.stationId &&
                `, ${
                  stations.find((s) => s.id === filters.stationId)?.stationName
                }`}
              {filters.year && `, ${filters.year} йил`}
              {filters.month &&
                `, ${
                  availableMonths.find((m) => m.value === filters.month)?.label
                }`}
            </div>
            <div className="text-sm text-gray-600">
              {seals.length} дан {filteredSeals.length} таси кўрсатилмоқда
            </div>
          </div>
        )}
      </motion.div>

      {/* Модальное окно */}
      <SealModal />
    </div>
  );
};

export default Seal;
