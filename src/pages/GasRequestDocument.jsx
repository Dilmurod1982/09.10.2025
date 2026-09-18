import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { numberToUzbekWords } from "../utils/numberToUzbekWords";
import AGNKSLogo from "../components/AGNKSLogo";

// Месяцы на латинице
const MONTHS_LAT = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentyabr",
  "oktyabr",
  "noyabr",
  "dekabr",
];

// Утилита: первая буква заглавная, остальные строчные
function capitalize(str) {
  if (!str) return "";
  const s = String(str).toLowerCase().trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Формат ФИО директора МЧЖ: "ФАМИЛИЯ ИМЯ ОТЧЕСТВО" → "И.О.Фамилия"
// Пример: "BARATOV UMID ISMAILOVICH" → "U.I.Baratov"
function formatMchjDirector(fullName) {
  if (!fullName) return "";
  const str = String(fullName).trim();

  if (str.includes(".")) {
    return str
      .split(".")
      .map((part) => {
        const t = part.trim();
        if (!t) return "";
        if (t.length === 1) return t.toUpperCase();
        return capitalize(t);
      })
      .filter(Boolean)
      .join(".");
  }

  const parts = str.split(/\s+/);

  if (parts.length >= 3) {
    const [lastName, firstName, middleName] = parts;
    return `${capitalize(firstName).charAt(0)}.${capitalize(middleName).charAt(
      0
    )}.${capitalize(lastName)}`;
  }

  if (parts.length === 2) {
    const [lastName, firstName] = parts;
    return `${capitalize(firstName).charAt(0)}.${capitalize(lastName)}`;
  }

  return capitalize(str);
}

function getDeadline(year, month) {
  // Возвращаем объект Date (локальный), а не строку
  const firstDay = new Date(year, month - 1, 1);
  const d = new Date(firstDay);
  d.setDate(d.getDate() - 10);
  return d;
}

// Дата на латинице: "2026 yil 20 avgust"
// Принимает Date или строку. Строки "YYYY-MM-DD" парсит как локальные (без UTC-сдвига).
function formatDateUz(dateInput) {
  if (!dateInput) return "";
  let d;

  if (dateInput instanceof Date) {
    d = dateInput;
  } else {
    const str = String(dateInput);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      d = new Date(str + "T00:00:00");
    } else {
      d = new Date(str);
    }
  }

  return `${d.getFullYear()} yil ${d.getDate()} ${MONTHS_LAT[d.getMonth()]}`;
}

export default function GasRequestDocument() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [letter, setLetter] = useState(null);
  const [gasOrg, setGasOrg] = useState(null);
  const [director, setDirector] = useState(null);
  const [cityInfo, setCityInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // ============================================================
  // ЗАГРУЗКА ДАННЫХ
  // ============================================================
  useEffect(() => {
    (async () => {
      try {
        const letterSnap = await getDoc(doc(db, "gasRequests", id));
        if (!letterSnap.exists()) return setLoading(false);
        const l = { id: letterSnap.id, ...letterSnap.data() };
        setLetter(l);

        const [orgSnap, dirSnap] = await Promise.all([
          getDoc(doc(db, "gasOrganizations", l.gasOrganizationId)),
          getDoc(doc(db, "gasOrgDirectors", l.gasDirectorId)),
        ]);
        if (orgSnap.exists()) setGasOrg({ id: orgSnap.id, ...orgSnap.data() });
        if (dirSnap.exists())
          setDirector({ id: dirSnap.id, ...dirSnap.data() });

        const stationsSnap = await getDocs(collection(db, "stations"));
        const orgStations = stationsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s) => s.organizationId === l.organizationId);

        const cityId = orgStations[0]?.address?.cityId;

        if (cityId) {
          const [citySnap, citiesSnap] = await Promise.all([
            getDoc(doc(db, "cities", cityId)),
            getDocs(collection(db, "cities")),
          ]);

          let cityData = null;
          if (citySnap.exists()) {
            cityData = { id: citySnap.id, ...citySnap.data() };
          } else {
            cityData = citiesSnap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .find((c) => String(c.id) === String(cityId));
          }

          setCityInfo(cityData);
          console.log("📍 Данные города/района:", cityData);
        } else {
          console.warn("⚠️ Не найден cityId ни в одной станции ООО");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="p-6">Yuklanmoqda...</div>;
  if (!letter) return <div className="p-6">Xat topilmadi</div>;

  const monthName = MONTHS_LAT[letter.month - 1];
  const deadline = getDeadline(letter.year, letter.month);
  const deadlineStr = formatDateUz(deadline);

  // Адресат: "S.A.Abdumajidov"
  const directorShort = `${
    director?.firstName ? capitalize(director.firstName).charAt(0) + "." : ""
  }${
    director?.middleName ? capitalize(director.middleName).charAt(0) + "." : ""
  }${director?.lastName ? capitalize(director.lastName) : ""}`;

  // Фирменная шапка
  const regionName = cityInfo?.regionName || "";
  const regionPart = regionName
    ? regionName.toLowerCase().includes("viloyat")
      ? regionName
      : `${regionName} viloyati`
    : "";

  const cityName = cityInfo?.name || "";
  const cityType = cityInfo?.type || "";

  let cityPart = "";
  if (cityName) {
    const normalizedType = String(cityType).toLowerCase().trim();
    const isShahar =
      normalizedType.includes("город") ||
      normalizedType.includes("shahar") ||
      normalizedType === "г" ||
      normalizedType === "г.";
    const suffix = isShahar ? "shahar" : "tumani";
    cityPart = `${cityName} ${suffix}`;
  } else if (letter.organizationCity) {
    cityPart = `${letter.organizationCity} tumani`;
  }

  const headerText = [
    "O'zbekiston Respublikasi",
    regionPart,
    cityPart,
    letter.organizationName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Кнопки управления (не печатаются) */}
      <div className="print:hidden flex gap-3 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 border rounded-xl"
        >
          ← Orqaga
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl"
        >
          🖨 Chop etish
        </button>
      </div>

      {/* ============ ПЕЧАТНАЯ ФОРМА ============ */}
      <div
        id="print-area"
        className="bg-white p-8"
        style={{
          fontFamily: "'Times New Roman', Times, serif",
          fontSize: "14pt",
          lineHeight: 1,
          color: "#000",
        }}
      >
        {/* ============ ФИРМЕННАЯ ШАПКА ============ */}
        <div className="flex justify-between items-start mb-2">
          {/* Левая колонка: текстовый заголовок */}
          <div
            style={{
              width: "60%",
              fontWeight: "bold",
              lineHeight: 1.5,
              paddingTop: "8px",
            }}
          >
            {headerText}
          </div>

          {/* Правая колонка: эмблема АГНКС */}
          <div
            style={{
              width: "40%",
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "flex-start",
            }}
          >
            <AGNKSLogo size={90} />
          </div>
        </div>

        {/* ДВЕ ГОРИЗОНТАЛЬНЫЕ ЛИНИИ */}
        <div style={{ borderTop: "2px solid #000", marginTop: "4px" }}></div>
        <div style={{ borderTop: "2px solid #000", marginTop: "8px" }}></div>

        {/* ============ ДАТА И НОМЕР ============ */}
        <div style={{ marginTop: "12px" }}>
          <div>{formatDateUz(letter.letterDate)}</div>
          <div>№ {letter.letterNumber}</div>
        </div>

        {/* ============ АДРЕСАТ ============ */}
        <div
          style={{
            fontWeight: "bold",
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "20px",
          }}
        >
          <div style={{ width: "40%", textAlign: "left" }}>
            "{gasOrg?.name}" gaz ta'minoti filiali direktori {directorShort}ga
          </div>
        </div>

        {/* ============ ОСНОВНОЙ ТЕКСТ (с отступом 1.5 см) ============ */}
        <div
          style={{
            marginTop: "16px",
            textAlign: "justify",
          }}
        >
          <p style={{ marginBottom: "2px", textIndent: "1.5cm" }}>
            O'zbekiston Respublikasi Vazirlar Mahkamasining 2024 yil 31 maydagi
            319-sonli qarori bilan tasdiqlangan "Tabiiy gazdan foydalanish
            qoidalari"ning 114-bandida navbatdagi oy (chorak) uchun shartnomada
            ko'rsatilgan tabiiy gaz hajmlari bo'yicha tabiiy gaz yetkazib berish
            shartnomasini o'zgartirilishidan avval iste'molchi tomonidan gaz
            ta'minoti tashkilotiga bu haqda o'n kundan kechikmay xabar bergan
            taqdirda, bunday holatlar ortiqcha olingan tabiiy gaz miqdori deb
            hisoblanmasligi belgilab qo'yilgan.
          </p>

          <p style={{ marginBottom: "2px", textIndent: "1.5cm" }}>
            Demak, {letter.year} yil {monthName} oyiga talabnoma berish muddati{" "}
            {deadlineStr} kunigacha taqdim etilishi mumkin.
          </p>

          <p style={{ marginBottom: "2px", textIndent: "1.5cm" }}>
            Bundan tashqari, 22.02.2020 yilda O'zbekiston Respublikasi Bosh
            vaziri raisligida o'tkazilgan yig'ilishda Bosh vazir tomonidan
            AGTKSHlarga tabiiy gaz yetkazib berilishida shaffoflikni ta'minlash
            hamda yuzaga kelayotgan noroziliklar va tabiiy gaz resurs hajmini
            oshirish bo'yicha murojaatlarni ijobiy hal etish maqsadida,
            "Hududgazta'minot" AJning 09.03.2021 martdagi 07-37-sonli
            topshirig'iga asosan AGTKSHga ularning bergan buyurtmasidan kelib
            chiqqan holda, to'lovlarni belgilangan tartibda amalga oshirish
            sharti bilan tabiiy gaz yetkazib berilishi ta'minlash vazifasi
            topshirilgan.
          </p>

          <p style={{ marginBottom: "2px", textIndent: "1.5cm" }}>
            Yuqoridagilarni inobatga olib, jamiyatimizga qarashli quyidagi
            AGTKSHlarga {monthName} oyi uchun tabiiy gaz hajmi ajratishingizni
            va shartnoma tuzishingizni so'rayman:
          </p>
        </div>

        {/* ============ СПИСОК СТАНЦИЙ (без отступа) ============ */}
        <div style={{ marginTop: "12px", fontWeight: "bold" }}>
          {letter.stations.map((st, i) => (
            <div key={st.stationId} style={{ marginBottom: "4px" }}>
              {i + 1}. {st.stationNumber}-sonli AGTKSHga{" "}
              {st.limit.toLocaleString("ru-RU")} ({numberToUzbekWords(st.limit)}
              ) m³
              {i < letter.stations.length - 1 ? "," : ""}
            </div>
          ))}
        </div>

        {/* ============ ПОДПИСЬ ============ */}
        <div
          style={{
            marginTop: "30px",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontWeight: "bold", paddingRight: "60px" }}>
            MCHJ direktori
          </div>
          <div style={{ fontWeight: "bold", paddingRight: "60px" }}>
            {formatMchjDirector(letter.organizationDirectorName) ||
              "________________"}
          </div>
        </div>
      </div>

      {/* ============ СТИЛИ ДЛЯ ПЕЧАТИ ============ */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            padding: 15mm 20mm 15mm 25mm;
            font-family: 'Times New Roman', Times, serif !important;
            font-size: 14pt !important;
          }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  );
}
