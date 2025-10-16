import React, { useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

const VerifyReportsButton = ({ stationId }) => {
  const [verifying, setVerifying] = useState(false);

  const verifyAndCleanReports = async () => {
    if (!stationId) {
      toast.error("Выберите станцию");
      return;
    }

    setVerifying(true);
    try {
      const reportsQuery = query(
        collection(db, "dailyPartnerReports"),
        where("stationId", "==", stationId),
        where("status", "in", ["saving", "error"]),
        orderBy("createdAt", "desc")
      );

      const incompleteReportsSnapshot = await getDocs(reportsQuery);

      if (!incompleteReportsSnapshot.empty) {
        const batch = writeBatch(db);
        incompleteReportsSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        toast.success(
          `Удалено ${incompleteReportsSnapshot.size} неполных отчетов`
        );
      } else {
        toast.success("Все отчеты сохранены корректно");
      }
    } catch (error) {
      console.error("Ошибка проверки отчетов:", error);
      toast.error("Ошибка при проверке отчетов");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <motion.button
      onClick={verifyAndCleanReports}
      disabled={verifying || !stationId}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="bg-green-600 text-white px-4 py-2 rounded-xl shadow-md hover:bg-green-700 disabled:bg-gray-400">
      {verifying ? "Проверка..." : "Проверить сохранение"}
    </motion.button>
  );
};

export default VerifyReportsButton;
