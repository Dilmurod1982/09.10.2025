import React, { useState } from "react";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

const AddPartnerModal = ({ onClose, banks }) => {
  const [name, setName] = useState("");
  const [inn, setInn] = useState("");
  const [director, setDirector] = useState("");
  const [bank, setBank] = useState("");
  const [shxr, setShxr] = useState("");
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(false);
  const [innError, setInnError] = useState("");

  const handleAddPartner = async () => {
    try {
      setLoading(true);

      // Проверяем уникальность ИНН
      const q = query(collection(db, "partners"), where("inn", "==", inn));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setInnError("Партнёр с таким ИНН уже существует!");
        setLoading(false);
        return;
      }

      // Сохраняем партнера и получаем его ID
      const docRef = await addDoc(collection(db, "partners"), {
        name,
        inn,
        director,
        bank,
        shxr,
        account,
        createdAt: new Date(),
      });

      console.log("✅ Партнер добавлен с ID:", docRef.id);

      toast.success("Партнёр успешно добавлен!");

      // Возвращаем ID созданного партнера через callback
      if (onClose) {
        onClose(docRef.id, name); // Передаем ID и имя партнера
      }
    } catch (err) {
      toast.error("Ошибка при добавлении партнёра");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const onlyDigits = (value, maxLength) =>
    value.replace(/\D/g, "").slice(0, maxLength);

  const isValid =
    name.trim() !== "" && inn.length === 9 && director.trim() !== "" && bank;

  return (
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
          Добавить партнёра
        </h3>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Наименование *"
            className="w-full border p-3 rounded-xl"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            type="text"
            placeholder="ИНН (9 цифр) *"
            className={`w-full border p-3 rounded-xl ${
              innError ? "border-red-500" : ""
            }`}
            value={inn}
            onChange={(e) => {
              setInnError("");
              setInn(onlyDigits(e.target.value, 9));
            }}
          />
          {innError && <p className="text-red-500 text-sm">{innError}</p>}

          <input
            type="text"
            placeholder="ФИО руководителя *"
            className="w-full border p-3 rounded-xl"
            value={director}
            onChange={(e) => setDirector(e.target.value)}
          />

          <select
            className="w-full border p-3 rounded-xl"
            value={bank}
            onChange={(e) => setBank(e.target.value)}>
            <option value="">Выберите банк *</option>
            {banks.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="ШХР (до 25 цифр)"
            className="w-full border p-3 rounded-xl"
            value={shxr}
            onChange={(e) => setShxr(onlyDigits(e.target.value, 25))}
          />

          <input
            type="text"
            placeholder="Расчётный счёт (20 цифр)"
            className="w-full border p-3 rounded-xl"
            value={account}
            onChange={(e) => setAccount(onlyDigits(e.target.value, 20))}
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => onClose && onClose()} // Просто закрываем без данных
            className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100">
            Отмена
          </button>
          <button
            onClick={handleAddPartner}
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
  );
};

export default AddPartnerModal;
