import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";

const DocDeadline = () => {
  const [documentCounts, setDocumentCounts] = useState({});
  const [loading, setLoading] = useState(true);

  const documentTypes = [
    { id: "license", name: "Лицензия", path: "/license", color: "bg-blue-500" },
    {
      id: "gas_certificate",
      name: "Сертификат на природный комприрированный газ",
      path: "/gas-certificate",
      color: "bg-green-500",
    },
    {
      id: "gas_analyzer",
      name: "Сертификат устройства газоанализатора",
      path: "/gas-analyzer",
      color: "bg-purple-500",
    },
    {
      id: "moisture_meter",
      name: "Сертификат устройства влагомера",
      path: "/moisture-meter",
      color: "bg-indigo-500",
    },
    {
      id: "electrical_meters",
      name: "Сертификат Ампер/вольметров",
      path: "/electrical-meters",
      color: "bg-yellow-500",
    },
    {
      id: "thermometers",
      name: "Сертификат термометров",
      path: "/thermometers",
      color: "bg-red-500",
    },
    {
      id: "manometers",
      name: "Сертификат манометров",
      path: "/manometers",
      color: "bg-pink-500",
    },
    {
      id: "gas_unit",
      name: "Сертификат узла учета газа",
      path: "/gas-unit",
      color: "bg-teal-500",
    },
    {
      id: "autopilot",
      name: "Сертификат счетчика природного газа AutoPilot",
      path: "/autopilot",
      color: "bg-orange-500",
    },
    {
      id: "flow_device",
      name: "Сертификат сужающего устройства",
      path: "/flow-device",
      color: "bg-cyan-500",
    },
    {
      id: "electricity_meter",
      name: "Сертификат счетчика электричества",
      path: "/electricity-meter",
      color: "bg-lime-500",
    },
    {
      id: "water_meter",
      name: "Сертификат счетчика воды",
      path: "/water-meter",
      color: "bg-emerald-500",
    },
  ];

  useEffect(() => {
    fetchDocumentCounts();
  }, []);

  const fetchDocumentCounts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "documents"));
      const counts = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (counts[data.docType]) {
          counts[data.docType]++;
        } else {
          counts[data.docType] = 1;
        }
      });

      setDocumentCounts(counts);
    } catch (error) {
      console.error("Error fetching document counts:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 animate-fade-in">
            Сроки Действия Документов
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Управление документами и отслеживание сроков их действия для всех
            станций
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {documentTypes.map((docType, index) => (
            <Link key={docType.id} to={docType.path} className="group">
              <div
                className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 p-6 border border-gray-200 hover:border-blue-300 animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}>
                <div
                  className={`w-12 h-12 ${docType.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors duration-300">
                  {docType.name}
                </h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    Документов: {documentCounts[docType.id] || 0}
                  </span>
                  <svg
                    className="w-5 h-5 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all duration-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DocDeadline;
