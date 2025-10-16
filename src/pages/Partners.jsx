import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { motion, AnimatePresence } from "framer-motion";
import { AddPartnerModal } from "../components";

const Partners = () => {
  const [partners, setPartners] = useState([]);
  const [banks, setBanks] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const unsubPartners = onSnapshot(collection(db, "partners"), (snapshot) => {
      setPartners(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const unsubBanks = onSnapshot(collection(db, "banks"), (snapshot) => {
      setBanks(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubPartners();
      unsubBanks();
    };
  }, []);

  const filteredPartners = partners.filter((p) =>
    [p.name, p.inn, p.director].some((field) =>
      field?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Партнёры</h2>
        <motion.button
          onClick={() => setIsModalOpen(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-blue-600 text-white px-5 py-2 rounded-xl shadow-md hover:bg-blue-700">
          + Добавить партнёра
        </motion.button>
      </div>

      <input
        type="text"
        placeholder="Поиск по названию, ИНН или руководителю..."
        className="w-full mb-4 p-3 border rounded-xl focus:ring focus:ring-blue-300"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="overflow-x-auto bg-white rounded-2xl shadow-md">
        <table className="w-full border-collapse text-sm sm:text-base">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">#</th>
              <th className="p-3 text-left">Наименование</th>
              <th className="p-3 text-left">ИНН</th>
              <th className="p-3 text-left">ФИО руководителя</th>
              <th className="p-3 text-left">Банк</th>
              <th className="p-3 text-left">ШХР</th>
              <th className="p-3 text-left">Р/счет</th>
            </tr>
          </thead>
          <tbody>
            {filteredPartners.map((p, idx) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="p-3">{idx + 1}</td>
                <td className="p-3">{p.name}</td>
                <td className="p-3">{p.inn}</td>
                <td className="p-3">{p.director}</td>
                <td className="p-3">{p.bank}</td>
                <td className="p-3">{p.shxr}</td>
                <td className="p-3">{p.account}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <AddPartnerModal
            onClose={() => setIsModalOpen(false)}
            banks={banks}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Partners;
