import React, { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import AddPartnerModal from "../components/AddPartnerModal";
import { useAppStore } from "../lib/zustand";

const PartnersList = () => {
  const [partners, setPartners] = useState([]);
  const [stations, setStations] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [nextContractNumber, setNextContractNumber] = useState(1);

  const [partner, setPartner] = useState("");
  const [contractId, setContractId] = useState(""); // Автоматический ID договора
  const [contractNumber, setContractNumber] = useState(""); // Ручной номер договора
  const [contractDate, setContractDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [station, setStation] = useState("");
  const [stationId, setStationId] = useState("");
  const [files, setFiles] = useState([]);
  const [carLists, setCarLists] = useState([]);
  const [startBalance, setStartBalance] = useState("");
  const [startBalanceDate, setStartBalanceDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);

  // Константа для ограничения размера файла (2 MB)
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB в байтах

  // Получаем данные пользователя из Zustand
  const userData = useAppStore((state) => state.userData);
  const role = userData?.role;
  const userStations = userData?.stations || [];

  // Firestore слушатели
  useEffect(() => {
    const unsubPartners = onSnapshot(collection(db, "partners"), (snapshot) => {
      const partnersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPartners(partnersData);
    });

    const unsubStations = onSnapshot(collection(db, "stations"), (snapshot) => {
      const stationsData = snapshot.docs.map((doc) => {
        const data = doc.data();
        let stationName = data.stationName;
        if (
          !stationName &&
          Array.isArray(data.staff) &&
          data.staff.length > 0
        ) {
          stationName = data.staff[0]?.stationName || "Без названия";
        }
        return { id: doc.id, stationName, ...data };
      });
      setStations(stationsData);
    });

    // Создаем запрос для договоров
    let contractsQuery;
    if (role === "buxgalter" && userStations.length > 0) {
      contractsQuery = query(
        collection(db, "contracts"),
        where("stationId", "in", userStations),
        orderBy("autoId", "desc")
      );
    } else {
      contractsQuery = query(
        collection(db, "contracts"),
        orderBy("autoId", "desc")
      );
    }

    const unsubContracts = onSnapshot(
      contractsQuery,
      (snapshot) => {
        const contractsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setContracts(contractsData);

        // Определяем следующий номер договора
        if (contractsData.length > 0) {
          const lastContract = contractsData[0];
          setNextContractNumber((lastContract.autoId || 0) + 1);
        } else {
          setNextContractNumber(1);
        }
      },
      (error) => {
        console.error("❌ Ошибка подписки на договоры:", error);
      }
    );

    return () => {
      unsubPartners();
      unsubStations();
      unsubContracts();
    };
  }, [role, userStations]);

  // Устанавливаем автоматический ID при открытии модалки
  useEffect(() => {
    if (isModalOpen) {
      setContractId(nextContractNumber.toString());
    }
  }, [isModalOpen, nextContractNumber]);

  // Функция для проверки размера файла
  const validateFileSize = (file) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Файл "${file.name}" превышает лимит 2 MB`);
      return false;
    }
    return true;
  };

  // Функция для проверки массива файлов
  const validateFiles = (fileList) => {
    for (const file of fileList) {
      if (!validateFileSize(file)) {
        return false;
      }
    }
    return true;
  };

  // Обработчик выбора файлов договоров с проверкой размера
  const handleFilesChange = (e) => {
    const selectedFiles = Array.from(e.target.files);

    if (!validateFiles(selectedFiles)) {
      e.target.value = ""; // Сбрасываем input
      return;
    }

    setFiles(selectedFiles);
    if (selectedFiles.length > 0) {
      toast.success(`Выбрано файлов договоров: ${selectedFiles.length}`);
    }
  };

  // Обработчик выбора списков машин с проверкой размера
  const handleCarListsChange = (e) => {
    const selectedFiles = Array.from(e.target.files);

    if (!validateFiles(selectedFiles)) {
      e.target.value = ""; // Сбрасываем input
      return;
    }

    setCarLists(selectedFiles);
    if (selectedFiles.length > 0) {
      toast.success(`Выбрано списков машин: ${selectedFiles.length}`);
    }
  };

  // Обработчик выбора новых файлов в режиме редактирования
  const handleNewFilesChange = (e, setFilesFunction) => {
    const selectedFiles = Array.from(e.target.files);

    if (!validateFiles(selectedFiles)) {
      e.target.value = ""; // Сбрасываем input
      return;
    }

    setFilesFunction(selectedFiles);
    if (selectedFiles.length > 0) {
      toast.success(`Добавлено новых файлов: ${selectedFiles.length}`);
    }
  };

  const handleAddContract = async () => {
    if (
      !partner ||
      !contractId ||
      !contractNumber ||
      !contractDate ||
      !contractEndDate ||
      !station ||
      !stationId
    ) {
      toast.error("Заполните все обязательные поля");
      return;
    }

    // Проверяем размеры файлов перед загрузкой
    if (files.length > 0 && !validateFiles(files)) return;
    if (carLists.length > 0 && !validateFiles(carLists)) return;

    try {
      setLoading(true);

      // Загружаем файлы договоров
      const uploadedFiles = [];
      for (const file of files) {
        const storage = getStorage();
        const fileRef = ref(storage, `contracts/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        const fileUrl = await getDownloadURL(fileRef);
        uploadedFiles.push({
          name: file.name,
          url: fileUrl,
          type: "contract",
          uploadedAt: new Date(),
          size: file.size, // Сохраняем размер файла
        });
      }

      // Загружаем списки машин
      const uploadedCarLists = [];
      for (const file of carLists) {
        const storage = getStorage();
        const fileRef = ref(storage, `car_lists/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        const fileUrl = await getDownloadURL(fileRef);
        uploadedCarLists.push({
          name: file.name,
          url: fileUrl,
          type: "car_list",
          uploadedAt: new Date(),
          size: file.size, // Сохраняем размер файла
        });
      }

      const selectedStation = stations.find((s) => s.id === stationId);
      const stationName = selectedStation
        ? selectedStation.stationName
        : station;

      // Находим партнера по имени чтобы получить его ID
      const selectedPartner = partners.find((p) => p.name === partner);
      const partnerId = selectedPartner ? selectedPartner.id : null;

      // Преобразуем начальное сальдо в число (поддерживаем отрицательные значения)
      const balanceValue = startBalance
        ? parseFloat(startBalance.replace(",", "."))
        : 0;

      const contractData = {
        partner,
        partnerId,
        contractId: contractId, // Автоматический ID
        contractNumber: contractNumber, // Ручной номер договора
        autoId: nextContractNumber,
        contractDate,
        contractEndDate,
        station: stationName,
        stationId: stationId,
        startBalance: balanceValue,
        startBalanceDate: startBalanceDate || null,
        files: uploadedFiles,
        carLists: uploadedCarLists,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addDoc(collection(db, "contracts"), contractData);

      toast.success("Договор успешно добавлен!");
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error("Ошибка при добавлении договора:", err);
      toast.error("Ошибка при добавлении договора");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateContract = async () => {
    if (!selectedContract) return;

    // Проверяем размеры новых файлов перед загрузкой
    if (files.length > 0 && !validateFiles(files)) return;
    if (carLists.length > 0 && !validateFiles(carLists)) return;

    try {
      setLoading(true);

      const updatedFiles = [...(selectedContract.files || [])];
      const updatedCarLists = [...(selectedContract.carLists || [])];

      // Загружаем новые файлы договоров
      for (const file of files) {
        const storage = getStorage();
        const fileRef = ref(storage, `contracts/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        const fileUrl = await getDownloadURL(fileRef);
        updatedFiles.push({
          name: file.name,
          url: fileUrl,
          type: "contract",
          uploadedAt: new Date(),
          size: file.size,
        });
      }

      // Загружаем новые списки машин
      for (const file of carLists) {
        const storage = getStorage();
        const fileRef = ref(storage, `car_lists/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        const fileUrl = await getDownloadURL(fileRef);
        updatedCarLists.push({
          name: file.name,
          url: fileUrl,
          type: "car_list",
          uploadedAt: new Date(),
          size: file.size,
        });
      }

      const contractRef = doc(db, "contracts", selectedContract.id);
      await updateDoc(contractRef, {
        contractEndDate,
        files: updatedFiles,
        carLists: updatedCarLists,
        updatedAt: new Date(),
      });

      toast.success("Договор успешно обновлен!");
      setIsEditMode(false);
      setFiles([]);
      setCarLists([]);
    } catch (err) {
      console.error("Ошибка при обновлении договора:", err);
      toast.error("Ошибка при обновлении договора");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (file, fileType) => {
    if (!selectedContract) return;

    if (!confirm(`Вы уверены, что хотите удалить файл "${file.name}"?`)) {
      return;
    }

    try {
      // Удаляем файл из хранилища
      const storage = getStorage();
      const fileRef = ref(storage, file.url);
      await deleteObject(fileRef);

      // Обновляем документ в Firestore
      const contractRef = doc(db, "contracts", selectedContract.id);

      if (fileType === "contract") {
        const updatedFiles = selectedContract.files.filter(
          (f) => f.url !== file.url
        );
        await updateDoc(contractRef, {
          files: updatedFiles,
          updatedAt: new Date(),
        });
      } else {
        const updatedCarLists = selectedContract.carLists.filter(
          (f) => f.url !== file.url
        );
        await updateDoc(contractRef, {
          carLists: updatedCarLists,
          updatedAt: new Date(),
        });
      }

      toast.success("Файл удален");
    } catch (err) {
      console.error("Ошибка при удалении файла:", err);
      toast.error("Ошибка при удалении файла");
    }
  };

  const resetForm = () => {
    setPartner("");
    setContractId("");
    setContractNumber("");
    setContractDate("");
    setContractEndDate("");
    setStation("");
    setStationId("");
    setFiles([]);
    setCarLists([]);
    setStartBalance("");
    setStartBalanceDate("");
  };

  const handleStationChange = (e) => {
    const selectedStationId = e.target.value;
    setStationId(selectedStationId);

    const selectedStation = stations.find((s) => s.id === selectedStationId);
    if (selectedStation) {
      setStation(selectedStation.stationName);
    }
  };

  const handlePartnerModalClose = (newPartnerId, newPartnerName) => {
    if (newPartnerId && newPartnerName) {
      setPartner(newPartnerName);
      const unsub = onSnapshot(collection(db, "partners"), (snapshot) => {
        const partnersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setPartners(partnersData);
        unsub();
      });
    }
    setIsAddPartnerOpen(false);
  };

  const handleContractClick = (contract) => {
    setSelectedContract(contract);
    setContractEndDate(contract.contractEndDate);
    setIsContractModalOpen(true);
    setIsEditMode(false);
    setFiles([]);
    setCarLists([]);
  };

  const handleBalanceChange = (value) => {
    // Разрешаем минус в начале, цифры, точку и запятую
    const cleanedValue = value.replace(/[^\d.,-]/g, "");

    // Убедимся, что минус только в начале
    let formattedValue = cleanedValue;
    if (cleanedValue.includes("-") && cleanedValue.indexOf("-") > 0) {
      formattedValue = cleanedValue.replace(/-/g, "");
    }

    // Заменяем запятую на точку
    formattedValue = formattedValue.replace(",", ".");

    const parts = formattedValue.split(".");
    if (parts.length > 2) return;

    if (parts.length === 2 && parts[1].length > 2) {
      setStartBalance(`${parts[0]}.${parts[1].slice(0, 2)}`);
    } else {
      setStartBalance(formattedValue);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    if (dateString.toDate) {
      return dateString.toDate().toLocaleDateString("ru-RU");
    }
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU");
  };

  // Функция для форматирования размера файла
  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatBalance = (balance) => {
    if (balance === undefined || balance === null || balance === 0) return "—";
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(balance);
  };

  const isContractExpired = (endDate) => {
    if (!endDate) return false;
    let dateToCheck;
    if (endDate.toDate) {
      dateToCheck = endDate.toDate();
    } else {
      dateToCheck = new Date(endDate);
    }
    return dateToCheck < new Date();
  };

  const getCurrentDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const isValid =
    partner.trim() !== "" &&
    contractId.trim() !== "" &&
    contractNumber.trim() !== "" &&
    contractDate.trim() !== "" &&
    contractEndDate.trim() !== "" &&
    station.trim() !== "" &&
    stationId.trim() !== "";

  const availableStations =
    role === "buxgalter"
      ? stations.filter((s) => userStations.includes(s.id))
      : stations;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">
          Список договоров партнёров
          <span className="text-sm text-gray-500 ml-2">
            ({contracts.length} шт.)
          </span>
        </h2>
        {(role === "admin" ||
          (role === "buxgalter" && availableStations.length > 0)) && (
          <motion.button
            onClick={() => setIsModalOpen(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-blue-600 text-white px-5 py-2 rounded-xl shadow-md hover:bg-blue-700">
            + Новый договор
          </motion.button>
        )}
      </div>

      {/* Информация о лимите файлов */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-blue-600">💡</span>
          <span>
            <strong>Ограничение размера файлов:</strong> каждый файл не более 2
            MB
          </span>
        </div>
      </div>

      {/* Таблица */}
      <div className="overflow-x-auto bg-white rounded-2xl shadow-md">
        {contracts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {role === "buxgalter" && availableStations.length === 0
              ? "У вас нет доступа к станциям для просмотра договоров"
              : "Договоры не найдены"}
          </div>
        ) : (
          <table className="w-full border-collapse text-sm sm:text-base">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">#</th>
                <th className="p-3 text-left">ID</th>
                <th className="p-3 text-left">Партнёр</th>
                <th className="p-3 text-left">№ договора</th>
                <th className="p-3 text-left">Дата договора</th>
                <th className="p-3 text-left">Дата окончания</th>
                <th className="p-3 text-left">Станция</th>
                <th className="p-3 text-left">Начальное сальдо</th>
                <th className="p-3 text-left">Дата сальдо</th>
                <th className="p-3 text-left">Файлы</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c, idx) => (
                <tr
                  key={c.id}
                  onClick={() => handleContractClick(c)}
                  className={`border-t hover:bg-gray-50 cursor-pointer ${
                    isContractExpired(c.contractEndDate)
                      ? "bg-red-50 hover:bg-red-100"
                      : ""
                  }`}>
                  <td className="p-3">{idx + 1}</td>
                  <td className="p-3 text-xs text-gray-500 font-mono">
                    {c.autoId || "—"}
                  </td>
                  <td className="p-3">{c.partner}</td>
                  <td className="p-3">{c.contractNumber || "—"}</td>
                  <td className="p-3">{formatDate(c.contractDate)}</td>
                  <td className="p-3">
                    <span
                      className={`font-medium ${
                        isContractExpired(c.contractEndDate)
                          ? "text-red-600"
                          : "text-gray-700"
                      }`}>
                      {formatDate(c.contractEndDate)}
                      {isContractExpired(c.contractEndDate) && (
                        <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                          Просрочен
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="p-3">{c.station}</td>
                  <td className="p-3 text-right font-mono">
                    {c.startBalance ? formatBalance(c.startBalance) : "—"}
                  </td>
                  <td className="p-3">
                    {c.startBalanceDate ? formatDate(c.startBalanceDate) : "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1">
                      {c.files && c.files.length > 0 && (
                        <div className="text-xs">
                          <strong>Договоры:</strong> {c.files.length} файл(ов)
                        </div>
                      )}
                      {c.carLists && c.carLists.length > 0 && (
                        <div className="text-xs">
                          <strong>Списки машин:</strong> {c.carLists.length}{" "}
                          файл(ов)
                        </div>
                      )}
                      {(!c.files || c.files.length === 0) &&
                        (!c.carLists || c.carLists.length === 0) &&
                        "—"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Модальное окно добавления договора */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex justify-center items-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}>
            <motion.div
              className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}>
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Добавить договор
              </h3>

              <div className="space-y-3">
                {/* Партнёр */}
                <select
                  className="w-full border p-3 rounded-xl"
                  value={partner}
                  onChange={(e) => {
                    if (e.target.value === "new") {
                      setIsAddPartnerOpen(true);
                      return;
                    }
                    setPartner(e.target.value);
                  }}>
                  <option value="">Выберите партнёра *</option>
                  <option value="new" className="text-blue-600 font-semibold">
                    ➕ Добавить нового партнёра
                  </option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                      {p.startBalance &&
                        ` (сальдо: ${formatBalance(p.startBalance)})`}
                    </option>
                  ))}
                </select>

                {/* ID договора (автоматический) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID договора *
                  </label>
                  <input
                    type="text"
                    className="w-full border p-3 rounded-xl bg-gray-50"
                    value={contractId}
                    readOnly
                    disabled
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ID устанавливается автоматически: {nextContractNumber}
                  </p>
                </div>

                {/* Номер договора (ручной ввод) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Номер договора *
                  </label>
                  <input
                    type="text"
                    placeholder="Введите номер договора"
                    className="w-full border p-3 rounded-xl"
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Например: ДГ-2024-001, №123/2024 и т.д.
                  </p>
                </div>

                {/* Дата договора */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Дата договора *
                  </label>
                  <input
                    type="date"
                    className="w-full border p-3 rounded-xl"
                    value={contractDate}
                    onChange={(e) => setContractDate(e.target.value)}
                  />
                </div>

                {/* Дата окончания договора */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Дата окончания договора *
                  </label>
                  <input
                    type="date"
                    className="w-full border p-3 rounded-xl"
                    value={contractEndDate}
                    onChange={(e) => setContractEndDate(e.target.value)}
                  />
                </div>

                {/* Станция */}
                <select
                  className="w-full border p-3 rounded-xl"
                  value={stationId}
                  onChange={handleStationChange}>
                  <option value="">Выберите станцию *</option>
                  {availableStations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.stationName}
                    </option>
                  ))}
                </select>

                {/* Начальное сальдо договора */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Начальное сальдо
                    </label>
                    <input
                      type="text"
                      placeholder="0.00 (можно отрицательное)"
                      className="w-full border p-3 rounded-xl"
                      value={startBalance}
                      onChange={(e) => handleBalanceChange(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Например: 1500.75 или -500.25
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Дата сальдо
                    </label>
                    <input
                      type="date"
                      className="w-full border p-3 rounded-xl"
                      value={startBalanceDate}
                      onChange={(e) => setStartBalanceDate(e.target.value)}
                      max={getCurrentDate()}
                    />
                  </div>
                </div>

                {/* Файлы договоров */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Файлы договоров (можно выбрать несколько) *
                    <span className="text-xs text-gray-500 ml-1">
                      макс. 2 MB на файл
                    </span>
                  </label>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.png"
                    className="w-full border p-3 rounded-xl"
                    onChange={handleFilesChange}
                  />
                  {files.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      Выбрано файлов: {files.length}
                      {files.map((file, index) => (
                        <div key={index} className="text-xs text-green-600">
                          ✓ {file.name} ({formatFileSize(file.size)})
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Списки машин */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Списки машин (можно выбрать несколько)
                    <span className="text-xs text-gray-500 ml-1">
                      макс. 2 MB на файл
                    </span>
                  </label>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
                    className="w-full border p-3 rounded-xl"
                    onChange={handleCarListsChange}
                  />
                  {carLists.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      Выбрано файлов: {carLists.length}
                      {carLists.map((file, index) => (
                        <div key={index} className="text-xs text-green-600">
                          ✓ {file.name} ({formatFileSize(file.size)})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Кнопки */}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100">
                  Отмена
                </button>
                <button
                  onClick={handleAddContract}
                  disabled={!isValid || loading}
                  className={`px-5 py-2 rounded-xl text-white font-semibold ${
                    isValid
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-gray-400 cursor-not-allowed"
                  }`}>
                  {loading ? "Добавление..." : "Добавить"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модальное окно просмотра договора */}
      <AnimatePresence>
        {isContractModalOpen && selectedContract && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex justify-center items-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}>
            <motion.div
              className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  {isEditMode
                    ? "Редактирование договора"
                    : `Договор ${
                        selectedContract.contractNumber ||
                        selectedContract.contractId
                      }`}
                </h3>
                <div className="flex gap-2">
                  {!isEditMode &&
                    (role === "admin" || role === "buxgalter") && (
                      <button
                        onClick={() => setIsEditMode(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
                        Редактировать
                      </button>
                    )}
                  <button
                    onClick={() => {
                      setIsContractModalOpen(false);
                      setIsEditMode(false);
                      setFiles([]);
                      setCarLists([]);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100">
                    Закрыть
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Основная информация */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg border-b pb-2">
                    Основная информация
                  </h4>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Партнёр
                    </label>
                    <p className="mt-1 p-2 bg-gray-50 rounded-lg">
                      {selectedContract.partner}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      ID договора
                    </label>
                    <p className="mt-1 p-2 bg-gray-50 rounded-lg font-mono">
                      {selectedContract.autoId || selectedContract.contractId}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Номер договора
                    </label>
                    <p className="mt-1 p-2 bg-gray-50 rounded-lg">
                      {selectedContract.contractNumber || "—"}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Дата договора
                    </label>
                    <p className="mt-1 p-2 bg-gray-50 rounded-lg">
                      {formatDate(selectedContract.contractDate)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Дата окончания договора {isEditMode && "*"}
                    </label>
                    {isEditMode ? (
                      <input
                        type="date"
                        className="w-full border p-3 rounded-xl mt-1"
                        value={contractEndDate}
                        onChange={(e) => setContractEndDate(e.target.value)}
                      />
                    ) : (
                      <p
                        className={`mt-1 p-2 rounded-lg font-medium ${
                          isContractExpired(selectedContract.contractEndDate)
                            ? "bg-red-50 text-red-700"
                            : "bg-gray-50"
                        }`}>
                        {formatDate(selectedContract.contractEndDate)}
                        {isContractExpired(
                          selectedContract.contractEndDate
                        ) && (
                          <span className="ml-2 text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full">
                            Просрочен
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Станция
                    </label>
                    <p className="mt-1 p-2 bg-gray-50 rounded-lg">
                      {selectedContract.station}
                    </p>
                  </div>

                  {selectedContract.startBalance && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Начальное сальдо
                      </label>
                      <p
                        className={`mt-1 p-2 rounded-lg font-mono ${
                          selectedContract.startBalance < 0
                            ? "bg-red-50 text-red-700"
                            : "bg-gray-50"
                        }`}>
                        {formatBalance(selectedContract.startBalance)}
                      </p>
                    </div>
                  )}

                  {selectedContract.startBalanceDate && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Дата сальдо
                      </label>
                      <p className="mt-1 p-2 bg-gray-50 rounded-lg">
                        {formatDate(selectedContract.startBalanceDate)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Файлы */}
                <div className="space-y-6">
                  {/* Файлы договоров */}
                  <div>
                    <h4 className="font-semibold text-lg border-b pb-2 mb-4">
                      Файлы договоров
                    </h4>
                    {selectedContract.files &&
                    selectedContract.files.length > 0 ? (
                      <div className="space-y-2">
                        {selectedContract.files.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline">
                                {file.name}
                              </a>
                              <div className="text-xs text-gray-500">
                                <div>{formatDate(file.uploadedAt)}</div>
                                <div>{formatFileSize(file.size)}</div>
                              </div>
                            </div>
                            {isEditMode && (
                              <button
                                onClick={() =>
                                  handleDeleteFile(file, "contract")
                                }
                                className="text-red-600 hover:text-red-800 p-1">
                                🗑️
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">Нет файлов договоров</p>
                    )}

                    {isEditMode && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Добавить новые файлы договоров
                          <span className="text-xs text-gray-500 ml-1">
                            макс. 2 MB на файл
                          </span>
                        </label>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.jpg,.png"
                          className="w-full border p-3 rounded-xl"
                          onChange={(e) => handleNewFilesChange(e, setFiles)}
                        />
                        {files.length > 0 && (
                          <div className="mt-2 text-sm text-gray-600">
                            Выбрано новых файлов: {files.length}
                            {files.map((file, index) => (
                              <div
                                key={index}
                                className="text-xs text-green-600">
                                ✓ {file.name} ({formatFileSize(file.size)})
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Списки машин */}
                  <div>
                    <h4 className="font-semibold text-lg border-b pb-2 mb-4">
                      Списки машин
                    </h4>
                    {selectedContract.carLists &&
                    selectedContract.carLists.length > 0 ? (
                      <div className="space-y-2">
                        {selectedContract.carLists.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline">
                                {file.name}
                              </a>
                              <div className="text-xs text-gray-500">
                                <div>{formatDate(file.uploadedAt)}</div>
                                <div>{formatFileSize(file.size)}</div>
                              </div>
                            </div>
                            {isEditMode && (
                              <button
                                onClick={() =>
                                  handleDeleteFile(file, "car_list")
                                }
                                className="text-red-600 hover:text-red-800 p-1">
                                🗑️
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">Нет списков машин</p>
                    )}

                    {isEditMode && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Добавить новые списки машин
                          <span className="text-xs text-gray-500 ml-1">
                            макс. 2 MB на файл
                          </span>
                        </label>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
                          className="w-full border p-3 rounded-xl"
                          onChange={(e) => handleNewFilesChange(e, setCarLists)}
                        />
                        {carLists.length > 0 && (
                          <div className="mt-2 text-sm text-gray-600">
                            Выбрано новых файлов: {carLists.length}
                            {carLists.map((file, index) => (
                              <div
                                key={index}
                                className="text-xs text-green-600">
                                ✓ {file.name} ({formatFileSize(file.size)})
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Кнопки редактирования */}
              {isEditMode && (
                <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
                  <button
                    onClick={() => {
                      setIsEditMode(false);
                      setFiles([]);
                      setCarLists([]);
                      setContractEndDate(selectedContract.contractEndDate);
                    }}
                    className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100">
                    Отмена
                  </button>
                  <button
                    onClick={handleUpdateContract}
                    disabled={loading}
                    className="px-5 py-2 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700">
                    {loading ? "Сохранение..." : "Сохранить"}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модалка добавления партнёра */}
      <AnimatePresence>
        {isAddPartnerOpen && (
          <AddPartnerModal onClose={handlePartnerModalClose} banks={[]} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default PartnersList;
