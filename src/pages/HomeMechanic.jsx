import React from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../lib/zustand";

const HomeMechanic = () => {
  const navigate = useNavigate();
  const userData = useAppStore((state) => state.userData);
  const managedStations = userData?.stations || [];

  const getStationsCount = () => {
    return Array.isArray(managedStations) ? managedStations.length : 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Заголовок */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                🔧 Механик панели
              </h1>
              <p className="text-gray-500 mt-1">
                Хуш келибсиз, {userData?.firstName || ""}{" "}
                {userData?.lastName || ""}
              </p>
            </div>
            <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-medium">
              {getStationsCount()} та заправка
            </div>
          </div>
        </div>

        {/* Если станции не привязаны */}
        {getStationsCount() === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Сизга ҳеч қандай заправка бириктирилмаган
            </h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Заправкаларни бириктириш учун админ билан боғланинг. Шундан сўнг
              сиз ўз заправкаларингиз ҳужжатларини кўра оласиз
            </p>
          </div>
        ) : (
          <>
            {/* Карточки с действиями */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Муддатлар бўйича */}
              <div
                onClick={() => navigate("/employeesdocdeadline")}
                className="bg-white rounded-2xl shadow-lg p-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center text-white text-2xl">
                    📄
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">
                      Муддатлар бўйича ҳужжатлар
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">
                      Муддати яқинлашаётган ва ўтган ҳужжатлар
                    </p>
                    <div className="inline-flex items-center text-sm text-orange-600 font-medium">
                      Кўриш →
                    </div>
                  </div>
                </div>
              </div>

              {/* Муддатсиз */}
              <div
                onClick={() => navigate("/employeesdocdeadlineinf")}
                className="bg-white rounded-2xl shadow-lg p-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center text-white text-2xl">
                    ♾️
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">
                      Муддатсиз ҳужжатлар
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">
                      Муддати белгиланмаган доимий ҳужжатлар
                    </p>
                    <div className="inline-flex items-center text-sm text-blue-600 font-medium">
                      Кўриш →
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Список привязанных станций */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                🏪 Бириктирилган заправкалар
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {managedStations.map((station, index) => {
                  const stationId = station?.id || station;
                  const stationName =
                    station?.name ||
                    station?.stationName ||
                    `Заправка #${stationId}`;
                  const stationLandmark = station?.landmark || "";

                  return (
                    <div
                      key={stationId || index}
                      className="p-4 bg-gray-50 rounded-xl border border-gray-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-800 truncate">
                            {stationName}
                          </div>
                          {stationLandmark && (
                            <div className="text-xs text-gray-500 truncate">
                              {stationLandmark}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HomeMechanic;
