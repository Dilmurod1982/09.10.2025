import React, { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  query,
  orderBy,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
  const [nextContractNumber, setNextContractNumber] = useState(1);

  const [partner, setPartner] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [station, setStation] = useState("");
  const [stationId, setStationId] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

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

  // Устанавливаем автоматический номер при открытии модалки
  useEffect(() => {
    if (isModalOpen) {
      setContractNumber(nextContractNumber.toString());
    }
  }, [isModalOpen, nextContractNumber]);

  const handleAddContract = async () => {
    if (
      !partner ||
      !contractNumber ||
      !contractDate ||
      !contractEndDate ||
      !station ||
      !stationId
    ) {
      toast.error("Заполните все обязательные поля");
      return;
    }

    try {
      setLoading(true);
      console.log("🚀 Начинаем добавление договора...");

      let fileUrl = "";
      if (file) {
        console.log("📎 Загружаем файл...");
        const storage = getStorage();
        const fileRef = ref(storage, `contracts/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        fileUrl = await getDownloadURL(fileRef);
        console.log("✅ Файл загружен:", fileUrl);
      }

      const selectedStation = stations.find((s) => s.id === stationId);
      const stationName = selectedStation
        ? selectedStation.stationName
        : station;

      // Находим партнера по имени чтобы получить его ID
      const selectedPartner = partners.find((p) => p.name === partner);
      const partnerId = selectedPartner ? selectedPartner.id : null;

      const contractData = {
        partner,
        partnerId,
        contractNumber,
        autoId: nextContractNumber, // ✅ Уникальный порядковый номер
        contractDate,
        contractEndDate,
        station: stationName,
        stationId: stationId,
        fileUrl,
        createdAt: new Date(),
      };

      console.log("📝 Данные для сохранения:", contractData);

      const docRef = await addDoc(collection(db, "contracts"), contractData);
      console.log("✅ Договор добавлен с ID:", docRef.id);
      console.log("✅ Авто-номер договора:", nextContractNumber);

      toast.success("Договор успешно добавлен!");
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error("❌ Ошибка при добавлении договора:", err);
      toast.error("Ошибка при добавлении договора");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPartner("");
    setContractNumber("");
    setContractDate("");
    setContractEndDate("");
    setStation("");
    setStationId("");
    setFile(null);
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
      // Если партнер был создан, устанавливаем его в форму
      setPartner(newPartnerName);
      // Обновляем список партнеров
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

  // Функция для форматирования даты
  const formatDate = (dateString) => {
    if (!dateString) return "—";
    // Если это Timestamp из Firestore
    if (dateString.toDate) {
      return dateString.toDate().toLocaleDateString("ru-RU");
    }
    // Если это строка
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU");
  };

  // Функция для проверки просроченных договоров
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

  const isValid =
    partner.trim() !== "" &&
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
    <div className="p-6 max-w-6xl mx-auto">
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

      {/* Отладочная информация */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs">
        <div>
          Роль: <strong>{role}</strong>
        </div>
        <div>
          Доступные станции: <strong>{availableStations.length}</strong>
        </div>
        <div>
          Всего договоров: <strong>{contracts.length}</strong>
        </div>
        <div>
          Следующий номер договора: <strong>{nextContractNumber}</strong>
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
                <th className="p-3 text-left">ID станции</th>
                <th className="p-3 text-left">Файл</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c, idx) => (
                <tr
                  key={c.id}
                  className={`border-t hover:bg-gray-50 ${
                    isContractExpired(c.contractEndDate)
                      ? "bg-red-50 hover:bg-red-100"
                      : ""
                  }`}>
                  <td className="p-3">{idx + 1}</td>
                  <td className="p-3 text-xs text-gray-500 font-mono">
                    {c.autoId || "—"}
                  </td>
                  <td className="p-3">{c.partner}</td>
                  <td className="p-3">{c.contractNumber}</td>
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
                  <td className="p-3 text-xs text-gray-500 font-mono">
                    {c.stationId || "—"}
                  </td>
                  <td className="p-3">
                    {c.fileUrl ? (
                      <a
                        href={c.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline hover:text-blue-800">
                        Открыть
                      </a>
                    ) : (
                      "—"
                    )}
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
              className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md"
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
                    </option>
                  ))}
                </select>

                {/* Номер договора (автоматический) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Номер договора *
                  </label>
                  <input
                    type="text"
                    className="w-full border p-3 rounded-xl bg-gray-50"
                    value={contractNumber}
                    readOnly
                    disabled
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Номер устанавливается автоматически: {nextContractNumber}
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

                {/* Файл договора */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Файл договора (опционально)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.png"
                    className="w-full border p-3 rounded-xl"
                    onChange={(e) => setFile(e.target.files[0])}
                  />
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
