import React from "react";

export default function AGNKSLogo({ size = 120, className = "" }) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 500 500"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* ========================= ФОН ЭМБЛЕМЫ ========================== */}
        <defs>
          <linearGradient
            id="greenGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#087F3F" />
            <stop offset="100%" stopColor="#00B85A" />
          </linearGradient>
          <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0878C9" />
            <stop offset="100%" stopColor="#00A8E8" />
          </linearGradient>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodOpacity="0.2" />
          </filter>
        </defs>

        {/* Внешний круг */}
        <circle
          cx="250"
          cy="250"
          r="240"
          fill="white"
          stroke="url(#greenGradient)"
          strokeWidth="18"
          filter="url(#shadow)"
        />

        {/* Внутреннее кольцо */}
        <circle
          cx="250"
          cy="250"
          r="195"
          fill="none"
          stroke="#D9F4E5"
          strokeWidth="4"
        />

        {/* ========================= СИМВОЛ МЕТАНА / ГАЗА ========================== */}
        <path
          d="M250 70 C215 115 185 145 185 185 C185 222 214 250 250 250 C286 250 315 222 315 185 C315 145 285 115 250 70Z"
          fill="url(#greenGradient)"
        />

        {/* Блик внутри капли */}
        <path
          d="M235 118 C215 145 205 160 205 180 C205 195 214 207 226 213"
          fill="none"
          stroke="white"
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.65"
        />

        {/* ========================= АВТОМОБИЛЬ ========================== */}
        {/* Кузов */}
        <path
          d="M120 300 L145 260 C153 247 166 240 181 240 H319 C334 240 347 247 355 260 L380 300 H395 C404 300 410 307 410 316 V350 C410 359 404 365 395 365 H105 C96 365 90 359 90 350 V316 C90 307 96 300 105 300 Z"
          fill="url(#blueGradient)"
        />

        {/* Окна автомобиля */}
        <path
          d="M160 260 L145 295 H355 L340 260 C335 250 327 245 315 245 H185 C173 245 165 250 160 260Z"
          fill="#EAF8FF"
        />

        {/* Разделитель окон */}
        <line
          x1="250"
          y1="247"
          x2="250"
          y2="294"
          stroke="#0878C9"
          strokeWidth="6"
        />

        {/* Колёса */}
        <circle cx="155" cy="365" r="35" fill="#1E293B" />
        <circle cx="155" cy="365" r="17" fill="#CBD5E1" />
        <circle cx="345" cy="365" r="35" fill="#1E293B" />
        <circle cx="345" cy="365" r="17" fill="#CBD5E1" />

        {/* Фары */}
        <rect x="105" y="315" width="25" height="16" rx="8" fill="#FDE047" />
        <rect x="370" y="315" width="25" height="16" rx="8" fill="#FDE047" />

        {/* ========================= ГАЗОВЫЙ ШЛАНГ ========================== */}
        <path
          d="M380 320 C425 320 435 300 425 275 C418 258 405 250 390 250"
          fill="none"
          stroke="#087F3F"
          strokeWidth="13"
          strokeLinecap="round"
        />

        {/* Пистолет */}
        <path
          d="M390 245 L420 225 L437 240 L420 260 L402 253 Z"
          fill="#087F3F"
        />

        {/* ========================= МОЛЕКУЛА CH4 ========================== */}
        <circle cx="250" cy="405" r="18" fill="#087F3F" />
        <circle cx="210" cy="390" r="11" fill="#00B85A" />
        <circle cx="290" cy="390" r="11" fill="#00B85A" />
        <circle cx="210" cy="420" r="11" fill="#00B85A" />
        <circle cx="290" cy="420" r="11" fill="#00B85A" />

        {/* Связи молекулы */}
        <line
          x1="238"
          y1="401"
          x2="219"
          y2="394"
          stroke="#087F3F"
          strokeWidth="5"
        />
        <line
          x1="262"
          y1="401"
          x2="281"
          y2="394"
          stroke="#087F3F"
          strokeWidth="5"
        />
        <line
          x1="238"
          y1="409"
          x2="219"
          y2="416"
          stroke="#087F3F"
          strokeWidth="5"
        />
        <line
          x1="262"
          y1="409"
          x2="281"
          y2="416"
          stroke="#087F3F"
          strokeWidth="5"
        />

        {/* ========================= ТЕКСТ АГНКС ========================== */}
        <text
          x="250"
          y="470"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="38"
          fontWeight="800"
          fill="#087F3F"
          letterSpacing="5"
        >
          АГТКШ
        </text>
      </svg>
    </div>
  );
}
