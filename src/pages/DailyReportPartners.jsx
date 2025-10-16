import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useAppStore } from "../lib/zustand";
import AddPartnerReportModal from "../components/AddPartnerReportModal";
import PartnerDetailModal from "../components/PartnerDetailModal";
import * as XLSX from "xlsx";

const DailyReportPartners = () => {
  const [stations, setStations] = useState([]);
  const [selectedStationId, setSelectedStationId] = useState("");
  const [contracts, setContracts] = useState([]);
  const [reports, setReports] = useState([]);
  const [isAddReportOpen, setIsAddReportOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  );
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [partnersData, setPartnersData] = useState({}); // Кэш данных партнеров
  const tableRef = useRef();

  // Получаем данные пользователя из Zustand
  const userData = useAppStore((state) => state.userData);
  const role = userData?.role;
  const userStations = userData?.stations || [];

  // Генерация месяцев с начала 2025 года
  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    const startDate = new Date(2025, 0, 1); // Январь 2025

    for (
      let date = new Date(startDate);
      date <= currentDate;
      date.setMonth(date.getMonth() + 1)
    ) {
      const year = date.getFullYear();
      const month = date.getMonth();
      const value = `${year}-${String(month + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("ru-RU", {
        year: "numeric",
        month: "long",
      });
      options.push({ value, label });
    }

    return options.reverse(); // Новые месяцы первыми
  };

  // Загрузка станций
  useEffect(() => {
    const unsubStations = onSnapshot(collection(db, "stations"), (snapshot) => {
      const stationsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setStations(stationsData);
    });

    return () => unsubStations();
  }, []);

  // Загрузка данных партнеров
  const loadPartnerData = async (partnerId) => {
    if (partnersData[partnerId]) {
      return partnersData[partnerId]; // Возвращаем из кэша
    }

    try {
      const partnerDoc = await getDoc(doc(db, "partners", partnerId));
      if (partnerDoc.exists()) {
        const partnerData = partnerDoc.data();
        setPartnersData((prev) => ({
          ...prev,
          [partnerId]: partnerData,
        }));
        return partnerData;
      }
    } catch (error) {
      console.error("Error loading partner data:", error);
    }
    return null;
  };

  // Загрузка договоров при выборе станции
  useEffect(() => {
    if (!selectedStationId) {
      setContracts([]);
      return;
    }

    const contractsQuery = query(
      collection(db, "contracts"),
      where("stationId", "==", selectedStationId)
    );

    const unsubContracts = onSnapshot(contractsQuery, async (snapshot) => {
      const contractsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Загружаем данные партнеров для каждого договора
      const contractsWithPartners = await Promise.all(
        contractsData.map(async (contract) => {
          if (contract.partnerId) {
            const partnerData = await loadPartnerData(contract.partnerId);
            return {
              ...contract,
              partnerDetails: partnerData,
            };
          }
          return contract;
        })
      );

      setContracts(contractsWithPartners);
    });

    return () => unsubContracts();
  }, [selectedStationId]);

  // Загрузка отчетов при выборе станции
  useEffect(() => {
    if (!selectedStationId) {
      setReports([]);
      return;
    }

    const reportsQuery = query(
      collection(db, "dailyPartnerReports"),
      where("stationId", "==", selectedStationId),
      orderBy("reportDate", "asc")
    );

    const unsubReports = onSnapshot(reportsQuery, (snapshot) => {
      const reportsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setReports(reportsData);
    });

    return () => unsubReports();
  }, [selectedStationId]);

  // Расчет сальдо на начало месяца
  const calculateStartingBalance = (partnerId, firstDayOfMonth) => {
    const previousReports = reports.filter((report) => {
      const reportDate = new Date(report.reportDate);
      return reportDate < firstDayOfMonth;
    });

    let balance = 0;
    previousReports.forEach((report) => {
      const partnerInReport = report.partnerData?.find(
        (p) => p.partnerId === partnerId
      );
      if (partnerInReport) {
        balance += partnerInReport.totalAmount || 0;
      }
    });

    return balance;
  };

  // Расчет текущего сальдо (накопленного)
  const calculateCurrentBalance = (partnerId) => {
    let balance = 0;
    reports.forEach((report) => {
      const partnerInReport = report.partnerData?.find(
        (p) => p.partnerId === partnerId
      );
      if (partnerInReport) {
        balance += partnerInReport.totalAmount || 0;
      }
    });
    return balance;
  };

  // Расчет месячного отчета для выбранного месяца
  const calculateMonthlyReport = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);

    const monthlyData = {};

    contracts.forEach((contract) => {
      const partnerId = contract.id;

      // Сальдо на начало месяца
      const startingBalance = calculateStartingBalance(
        partnerId,
        firstDayOfMonth
      );

      // Данные за выбранный месяц
      let totalSoldM3 = 0;
      let totalSoldAmount = 0;
      let totalPaid = 0;

      const monthReports = reports.filter((report) => {
        const reportDate = new Date(report.reportDate);
        return reportDate >= firstDayOfMonth && reportDate <= lastDayOfMonth;
      });

      monthReports.forEach((report) => {
        const partnerInReport = report.partnerData?.find(
          (p) => p.partnerId === partnerId
        );
        if (partnerInReport) {
          totalSoldM3 += partnerInReport.soldM3 || 0;
          totalSoldAmount += partnerInReport.totalAmount || 0;
        }
      });

      // Текущее сальдо (накопленное до конца выбранного месяца)
      const currentBalance = startingBalance + totalSoldAmount;

      monthlyData[partnerId] = {
        partnerName: contract.partner,
        contractNumber: contract.contractNumber,
        station: contract.station,
        startingBalance,
        totalSoldM3,
        totalSoldAmount,
        totalPaid,
        currentBalance,
        partnerDetails: contract.partnerDetails,
      };
    });

    return monthlyData;
  };

  // Функция для расчета общих итогов по месяцу
  const calculateMonthlyTotals = () => {
    const monthlyReport = calculateMonthlyReport();
    let totalStartingBalance = 0;
    let totalSoldM3 = 0;
    let totalSoldAmount = 0;
    let totalPaid = 0;
    let totalCurrentBalance = 0;

    Object.values(monthlyReport).forEach((data) => {
      totalStartingBalance += data.startingBalance;
      totalSoldM3 += data.totalSoldM3;
      totalSoldAmount += data.totalSoldAmount;
      totalPaid += data.totalPaid;
      totalCurrentBalance += data.currentBalance;
    });

    return {
      totalStartingBalance,
      totalSoldM3,
      totalSoldAmount,
      totalPaid,
      totalCurrentBalance,
    };
  };

  // Экспорт в Excel
  const exportToExcel = () => {
    const monthlyReport = calculateMonthlyReport();
    const monthlyTotals = calculateMonthlyTotals();

    const worksheetData = [
      // Заголовок
      ["Месячный отчет по партнерам", "", "", "", "", "", "", "", ""],
      [
        `Период: ${new Date(selectedMonth + "-01").toLocaleDateString("ru-RU", {
          month: "long",
          year: "numeric",
        })}`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
      ["Станция:", selectedStation?.stationName, "", "", "", "", "", "", ""],
      [], // Пустая строка

      // Заголовки таблицы
      [
        "№",
        "Партнер",
        "№ договора",
        "Станция",
        "Сальдо нач. месяца",
        "Продано м³",
        "Продано руб.",
        "Оплачено",
        "Сальдо тек. день",
      ],

      // Данные
      ...contracts.map((contract, idx) => {
        const monthlyData = monthlyReport[contract.id] || {};
        return [
          idx + 1,
          contract.partner,
          contract.contractNumber,
          contract.station,
          monthlyData.startingBalance || 0,
          monthlyData.totalSoldM3 || 0,
          monthlyData.totalSoldAmount || 0,
          monthlyData.totalPaid || 0,
          monthlyData.currentBalance || 0,
        ];
      }),

      // Итоги
      [
        "ИТОГИ ЗА МЕСЯЦ:",
        "",
        "",
        "",
        monthlyTotals.totalStartingBalance,
        monthlyTotals.totalSoldM3,
        monthlyTotals.totalSoldAmount,
        monthlyTotals.totalPaid,
        monthlyTotals.totalCurrentBalance,
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Месячный отчет");

    // Авто-ширина колонок
    const colWidths = [
      { wch: 5 }, // №
      { wch: 30 }, // Партнер
      { wch: 15 }, // № договора
      { wch: 20 }, // Станция
      { wch: 15 }, // Сальдо нач. месяца
      { wch: 12 }, // Продано м³
      { wch: 15 }, // Продано руб.
      { wch: 12 }, // Оплачено
      { wch: 15 }, // Сальдо тек. день
    ];
    ws["!cols"] = colWidths;

    XLSX.writeFile(
      wb,
      `отчет_партнеры_${selectedStation?.stationName}_${selectedMonth}.xlsx`
    );
    toast.success("Отчет экспортирован в Excel");
  };

  // Печать таблицы
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    const tableHTML = tableRef.current.outerHTML;

    printWindow.document.write(`
      <html>
        <head>
          <title>Месячный отчет по партнерам</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            tfoot { font-weight: bold; background-color: #f0f0f0; }
            .header { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Месячный отчет по партнерам</h2>
            <p>Период: ${new Date(selectedMonth + "-01").toLocaleDateString(
              "ru-RU",
              { month: "long", year: "numeric" }
            )}</p>
            <p>Станция: ${selectedStation?.stationName}</p>
          </div>
          ${tableHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  // Обработчик клика по строке
  const handleRowClick = (contract) => {
    const monthlyReport = calculateMonthlyReport();
    const partnerData = monthlyReport[contract.id];

    if (partnerData) {
      setSelectedPartner({
        ...contract,
        ...partnerData,
        partnerDetails: contract.partnerDetails,
      });
      setIsPartnerModalOpen(true);
    }
  };

  const monthlyReport = calculateMonthlyReport();
  const monthlyTotals = calculateMonthlyTotals();
  const availableStations = stations.filter((s) => userStations.includes(s.id));
  const selectedStation = stations.find((s) => s.id === selectedStationId);
  const monthOptions = generateMonthOptions();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">
          Ежедневный отчет по партнерам
        </h2>
        {selectedStationId && (
          <div className="flex gap-2">
            <motion.button
              onClick={exportToExcel}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-green-600 text-white px-4 py-2 rounded-xl shadow-md hover:bg-green-700">
              📊 Excel
            </motion.button>
            <motion.button
              onClick={handlePrint}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-purple-600 text-white px-4 py-2 rounded-xl shadow-md hover:bg-purple-700">
              🖨️ Печать
            </motion.button>
            <motion.button
              onClick={() => setIsAddReportOpen(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl shadow-md hover:bg-blue-700">
              + Новый отчет
            </motion.button>
          </div>
        )}
      </div>

      {/* Выбор станции и месяца */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Выберите станцию:
          </label>
          <select
            value={selectedStationId}
            onChange={(e) => setSelectedStationId(e.target.value)}
            className="w-full border border-gray-300 rounded-xl p-3">
            <option value="">Выберите станцию</option>
            {availableStations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.stationName}
              </option>
            ))}
          </select>
        </div>

        {selectedStationId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Выберите месяц и год:
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-3">
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!selectedStationId ? (
        <div className="text-center p-8 text-gray-500">
          Выберите станцию для просмотра отчетов
        </div>
      ) : (
        <>
          {/* Месячный отчет */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4">
              Месячный отчет (
              {new Date(selectedMonth + "-01").toLocaleDateString("ru-RU", {
                month: "long",
                year: "numeric",
              })}
              )
            </h3>

            <div className="overflow-x-auto bg-white rounded-2xl shadow-md">
              <table ref={tableRef} className="w-full border-collapse text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">#</th>
                    <th className="p-3 text-left">Партнер</th>
                    <th className="p-3 text-left">№ договора</th>
                    <th className="p-3 text-left">Станция</th>
                    <th className="p-3 text-right">Сальдо нач. месяца</th>
                    <th className="p-3 text-right">Продано м³</th>
                    <th className="p-3 text-right">Продано руб.</th>
                    <th className="p-3 text-right">Оплачено</th>
                    <th className="p-3 text-right">Сальдо тек. день</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((contract, idx) => {
                    const monthlyData = monthlyReport[contract.id] || {};
                    return (
                      <tr
                        key={contract.id}
                        onClick={() => handleRowClick(contract)}
                        className="border-t hover:bg-gray-50 cursor-pointer transition-colors">
                        <td className="p-3">{idx + 1}</td>
                        <td className="p-3">{contract.partner}</td>
                        <td className="p-3">{contract.contractNumber}</td>
                        <td className="p-3">{contract.station}</td>
                        <td className="p-3 text-right">
                          {monthlyData.startingBalance?.toLocaleString(
                            "ru-RU"
                          ) || "0"}{" "}
                          ₽
                        </td>
                        <td className="p-3 text-right">
                          {monthlyData.totalSoldM3?.toLocaleString("ru-RU") ||
                            "0"}{" "}
                          м³
                        </td>
                        <td className="p-3 text-right">
                          {monthlyData.totalSoldAmount?.toLocaleString(
                            "ru-RU"
                          ) || "0"}{" "}
                          ₽
                        </td>
                        <td className="p-3 text-right">
                          {monthlyData.totalPaid?.toLocaleString("ru-RU") ||
                            "0"}{" "}
                          ₽
                        </td>
                        <td className="p-3 text-right font-semibold">
                          {monthlyData.currentBalance?.toLocaleString(
                            "ru-RU"
                          ) || "0"}{" "}
                          ₽
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Итоги месяца */}
                <tfoot className="bg-gray-200 border-t-2 border-gray-300">
                  <tr>
                    <td className="p-3 font-semibold" colSpan="4">
                      ИТОГИ ЗА МЕСЯЦ:
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {monthlyTotals.totalStartingBalance.toLocaleString(
                        "ru-RU"
                      )}{" "}
                      ₽
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {monthlyTotals.totalSoldM3.toLocaleString("ru-RU")} м³
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {monthlyTotals.totalSoldAmount.toLocaleString("ru-RU")} ₽
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {monthlyTotals.totalPaid.toLocaleString("ru-RU")} ₽
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {monthlyTotals.totalCurrentBalance.toLocaleString(
                        "ru-RU"
                      )}{" "}
                      ₽
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* История отчетов */}
          <div>
            <h3 className="text-xl font-semibold mb-4">
              История ежедневных отчетов ({reports.length} отчетов)
            </h3>
            {reports.length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                Нет сохраненных отчетов
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="bg-white rounded-2xl shadow-md p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-semibold">
                        Отчет за{" "}
                        {new Date(report.reportDate).toLocaleDateString(
                          "ru-RU"
                        )}
                      </h4>
                      <div className="text-sm text-gray-500">
                        Создан: {report.createdBy} •{" "}
                        {new Date(report.createdAt?.toDate()).toLocaleString(
                          "ru-RU"
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="p-2 text-left">Партнер</th>
                            <th className="p-2 text-right">Цена за м³</th>
                            <th className="p-2 text-right">Продано м³</th>
                            <th className="p-2 text-right">Сумма</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.partnerData?.map((partner, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="p-2">{partner.partnerName}</td>
                              <td className="p-2 text-right">
                                {partner.pricePerM3?.toLocaleString("ru-RU")} ₽
                              </td>
                              <td className="p-2 text-right">
                                {partner.soldM3?.toLocaleString("ru-RU")} м³
                              </td>
                              <td className="p-2 text-right font-semibold">
                                {partner.totalAmount?.toLocaleString("ru-RU")} ₽
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Модальное окно добавления отчета */}
      {isAddReportOpen && (
        <AddPartnerReportModal
          isOpen={isAddReportOpen}
          onClose={() => setIsAddReportOpen(false)}
          stationId={selectedStationId}
          stationName={selectedStation?.stationName}
          contracts={contracts}
          reports={reports}
        />
      )}

      {/* Модальное окно деталей партнера */}
      {isPartnerModalOpen && selectedPartner && (
        <PartnerDetailModal
          isOpen={isPartnerModalOpen}
          onClose={() => setIsPartnerModalOpen(false)}
          partner={selectedPartner}
          reports={reports}
          selectedStationId={selectedStationId}
        />
      )}
    </div>
  );
};

export default DailyReportPartners;
