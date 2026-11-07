import React from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../lib/zustand";

const HomeMechanic = () => {
  const navigate = useNavigate();
  const userData = useAppStore((state) => state.userData);
  const managedStations = userData?.stations || [];

  const getStationsCount = () =>
    Array.isArray(managedStations) ? managedStations.length : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Заголовок */}
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
                🔧 Механик панели
              </h1>
              <p className="text-sm sm:text-base text-gray-500 mt-1 truncate">
                Хуш келибсиз, {userData?.firstName || ""}{" "}
                {userData?.lastName || ""}
              </p>
            </div>
            <div className="bg-blue-100 text-blue-800 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-sm sm:text-base whitespace-nowrap">
              {getStationsCount()} та заправка
            </div>
          </div>
        </div>

        {/* Если станции не привязаны */}
        {getStationsCount() === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-12 text-center">
            <div className="text-5xl sm:text-6xl mb-4">🚫</div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
              Сизга ҳеч қандай заправка бириктирилмаган
            </h2>
            <p className="text-sm sm:text-base text-gray-500 max-w-md mx-auto">
              Заправкаларни бириктириш учун админ билан боғланинг
            </p>
          </div>
        ) : (
          <>
            {/* Карточки действий */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-6">
              <div
                onClick={() => navigate("/employeesdocdeadline")}
                className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all border border-gray-100 active:scale-95"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center text-white text-xl sm:text-2xl flex-shrink-0">
                    📄
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-1 leading-tight">
                      Муддатлар бўйича ҳужжатлар
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 mb-2">
                      Муддати яқинлашаётган ҳужжатлар
                    </p>
                    <div className="inline-flex items-center text-xs sm:text-sm text-orange-600 font-medium">
                      Кўриш →
                    </div>
                  </div>
                </div>
              </div>

              <div
                onClick={() => navigate("/employeesdocdeadlineinf")}
                className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all border border-gray-100 active:scale-95"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center text-white text-xl sm:text-2xl flex-shrink-0">
                    ♾️
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-1 leading-tight">
                      Муддатсиз ҳужжатлар
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 mb-2">
                      Доимий ҳужжатлар
                    </p>
                    <div className="inline-flex items-center text-xs sm:text-sm text-blue-600 font-medium">
                      Кўриш →
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Электр счётчики */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-6">
              <div
                onClick={() => navigate("/electric-readings")}
                className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all border border-gray-100 active:scale-95"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center text-white text-xl sm:text-2xl flex-shrink-0">
                    ⚡
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-1 leading-tight">
                      Электр кўрсаткичлари
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 mb-2">
                      Кунлик ҳисоблагич кўрсаткичлари
                    </p>
                    <div className="inline-flex items-center text-xs sm:text-sm text-yellow-600 font-medium">
                      Киритиш →
                    </div>
                  </div>
                </div>
              </div>

              <div
                onClick={() => navigate("/electric-analytics")}
                className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all border border-gray-100 active:scale-95"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-xl flex items-center justify-center text-white text-xl sm:text-2xl flex-shrink-0">
                    📊
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-1 leading-tight">
                      Электр таҳлили
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 mb-2">
                      Сарфланган электр энергияси
                    </p>
                    <div className="inline-flex items-center text-xs sm:text-sm text-purple-600 font-medium">
                      Кўриш →
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Привязанные станции */}
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">
                🏪 Бириктирилган заправкалар
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
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
                      className="p-3 bg-gray-50 rounded-xl border border-gray-200"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm text-gray-800 truncate">
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
