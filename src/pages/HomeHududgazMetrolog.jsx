import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../lib/zustand";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  DocumentIcon,
  DocumentDuplicateIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

const HomeHududgazMetrolog = () => {
  const navigate = useNavigate();
  const userData = useAppStore((state) => state.userData);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    expired: 0,
    expiringSoon: 0,
    valid: 0,
    byType: {},
    byStation: {},
  });
  const [recentDocs, setRecentDocs] = useState([]);

  // Разрешенные типы документов для метролога
  const allowedTypes = [
    "Газ ҳисоблаш тугунини сертификати (ИК)",
    "Газ ҳисоблагич сертификати (Автопилот)",
    "Торайтирувчи мослама сертификати (Шайба)",
  ];

  const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);

      // Получаем все документы
      const docsSnap = await getDocs(collection(db, "documents"));
      const allDocs = docsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Получаем типы документов для фильтрации
      const typesSnap = await getDocs(collection(db, "document_types"));
      const typesMap = {};
      typesSnap.forEach((doc) => {
        const data = doc.data();
        typesMap[data.id] = data.name;
      });

      // Фильтруем документы по разрешенным типам
      const filteredDocs = allDocs.filter((doc) => {
        const typeName = typesMap[doc.docType];
        return allowedTypes.includes(typeName) && doc.expiryDate;
      });

      const now = new Date();
      let expired = 0;
      let expiringSoon = 0;
      let valid = 0;
      const byType = {};
      const byStation = {};
      const recent = [];

      filteredDocs.forEach((doc) => {
        const expiry = new Date(doc.expiryDate);
        const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
        const typeName = typesMap[doc.docType] || doc.docType;
        const stationName = doc.stationName || "Неизвестная станция";

        // Статистика по типам
        if (!byType[typeName]) {
          byType[typeName] = { total: 0, expired: 0, expiring: 0, valid: 0 };
        }
        byType[typeName].total++;

        // Статистика по станциям
        if (!byStation[stationName]) {
          byStation[stationName] = {
            total: 0,
            expired: 0,
            expiring: 0,
            valid: 0,
          };
        }
        byStation[stationName].total++;

        // Определение статуса
        if (diffDays < 0) {
          expired++;
          byType[typeName].expired++;
          byStation[stationName].expired++;
        } else if (diffDays <= 30) {
          expiringSoon++;
          byType[typeName].expiring++;
          byStation[stationName].expiring++;
        } else {
          valid++;
          byType[typeName].valid++;
          byStation[stationName].valid++;
        }

        // Добавляем в последние документы (первые 5)
        if (recent.length < 5) {
          recent.push({
            id: doc.id,
            name: typeName,
            station: stationName,
            expiryDate: doc.expiryDate,
            diffDays,
            status:
              diffDays < 0
                ? "Просрочен"
                : diffDays <= 30
                  ? "Истекает"
                  : "Действителен",
          });
        }
      });

      // Сортируем последние документы по дате истечения
      recent.sort((a, b) => a.diffDays - b.diffDays);

      setStats({
        total: filteredDocs.length,
        expired,
        expiringSoon,
        valid,
        byType,
        byStation,
      });
      setRecentDocs(recent);
    } catch (error) {
      console.error("Ошибка загрузки статистики:", error);
    } finally {
      setLoading(false);
    }
  };

  // Подготовка данных для графиков
  const typeChartData = Object.entries(stats.byType).map(([name, data]) => ({
    name: name.length > 20 ? name.substring(0, 20) + "..." : name,
    fullName: name,
    total: data.total,
    expired: data.expired,
    expiring: data.expiring,
    valid: data.valid,
  }));

  const statusPieData = [
    { name: "Действительные", value: stats.valid },
    { name: "Истекают (30 дней)", value: stats.expiringSoon },
    { name: "Просрочены", value: stats.expired },
  ].filter((item) => item.value > 0);

  const stationChartData = Object.entries(stats.byStation)
    .map(([name, data]) => ({
      name: name.length > 15 ? name.substring(0, 15) + "..." : name,
      fullName: name,
      total: data.total,
      expired: data.expired,
      expiring: data.expiring,
      valid: data.valid,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-16 w-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка статистики...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-2 rounded-xl">
              <ChartBarIcon className="w-8 h-8" />
            </span>
            Метролог Ҳудудгаз панели
          </h1>
          <p className="text-gray-600 mt-2 ml-2">
            Статистика по документам газового оборудования
          </p>
        </div>

        {/* Статистические карточки */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">
                  Всего документов
                </p>
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {stats.total}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-xl">
                <DocumentIcon className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">
                  Действительные
                </p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {stats.valid}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-xl">
                <CheckCircleIcon className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">
                  Истекают (30 дней)
                </p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">
                  {stats.expiringSoon}
                </p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-xl">
                <ClockIcon className="w-8 h-8 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Просрочены</p>
                <p className="text-3xl font-bold text-red-600 mt-1">
                  {stats.expired}
                </p>
              </div>
              <div className="bg-red-100 p-3 rounded-xl">
                <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Кнопки быстрого доступа */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <button
            onClick={() => navigate("/docdeadline")}
            className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-6">
              <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm">
                <DocumentDuplicateIcon className="w-12 h-12" />
              </div>
              <div className="text-left">
                <h3 className="text-2xl font-bold">Муддатли хужжатлар</h3>
                <p className="text-blue-100 text-sm mt-1">
                  Хужжатларни турлари бўйича кўриш
                </p>
                <div className="mt-3 inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg text-sm font-medium">
                  <span>Перейти →</span>
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate("/docbystation")}
            className="group relative overflow-hidden bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-6">
              <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm">
                <DocumentIcon className="w-12 h-12" />
              </div>
              <div className="text-left">
                <h3 className="text-2xl font-bold">
                  Заправкалар бўйича хужжатлар
                </h3>
                <p className="text-purple-100 text-sm mt-1">
                  Заправкалар бўйича хужжатларни кўриш
                </p>
                <div className="mt-3 inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg text-sm font-medium">
                  <span>Перейти →</span>
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Графики */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Статус документов (Pie Chart) */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Статус документов
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Статистика по типам документов */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Статистика по типам документов
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name, props) => {
                      const fullName = props.payload.fullName;
                      return [`${value}`, fullName];
                    }}
                  />
                  <Legend />
                  <Bar dataKey="valid" name="Действительные" fill="#10b981" />
                  <Bar dataKey="expiring" name="Истекают" fill="#f59e0b" />
                  <Bar dataKey="expired" name="Просрочены" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Статистика по станциям */}
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Статистика по станциям
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stationChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value, name, props) => {
                    const fullName = props.payload.fullName;
                    return [`${value}`, `${fullName} - ${name}`];
                  }}
                />
                <Legend />
                <Bar dataKey="valid" name="Действительные" fill="#10b981" />
                <Bar dataKey="expiring" name="Истекают" fill="#f59e0b" />
                <Bar dataKey="expired" name="Просрочены" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Последние документы */}
        {recentDocs.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Последние документы
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                      Тип документа
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                      Станция
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                      Дата окончания
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                      Статус
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentDocs.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-t hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {doc.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {doc.station}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {doc.expiryDate}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            doc.status === "Просрочен"
                              ? "bg-red-100 text-red-700"
                              : doc.status === "Истекает"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-green-100 text-green-700"
                          }`}
                        >
                          {doc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeHududgazMetrolog;
