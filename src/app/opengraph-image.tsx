import { ImageResponse } from "next/og";

// Link previews (Google, WhatsApp, LinkedIn, X). Also re-used as the Twitter image.
export const alt = "paisa: know what's safe to spend today";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const ink = "#111210";
  const paper = "#F4F2EC";
  const coral = "#E8532F";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: paper,
        color: ink,
        padding: 72,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="64" height="64" viewBox="0 0 256 256">
            <rect width="256" height="256" rx="58" fill={ink} />
            <circle
              cx="128"
              cy="128"
              r="70"
              fill="none"
              stroke={paper}
              strokeOpacity="0.14"
              strokeWidth="22"
            />
            <circle
              cx="128"
              cy="128"
              r="70"
              fill="none"
              stroke={coral}
              strokeWidth="22"
              strokeLinecap="round"
              strokeDasharray="330 110"
            />
            <circle cx="177.5" cy="78.5" r="11" fill={paper} />
          </svg>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              fontSize: 44,
              fontWeight: 700,
              letterSpacing: -2,
            }}
          >
            paisa
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: 99,
                background: coral,
                marginLeft: 4,
                marginBottom: 10,
              }}
            />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 84,
              lineHeight: 1,
              letterSpacing: -4,
              maxWidth: 640,
            }}
          >
            Know what&apos;s safe to spend today.
          </div>
          <div
            style={{
              fontSize: 28,
              marginTop: 28,
              color: "#5B5A54",
              maxWidth: 620,
            }}
          >
            A budget app for India that turns your month into one daily number.
          </div>
        </div>
      </div>
      <div
        style={{
          width: 380,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
          borderRadius: 32,
          border: "2px solid #E3E1DA",
          alignSelf: "center",
          padding: "44px 0",
        }}
      >
        <svg width="200" height="200" viewBox="0 0 180 180">
          <circle
            cx="90"
            cy="90"
            r="70"
            fill="none"
            stroke="#ECEAE3"
            strokeWidth="14"
          />
          <circle
            cx="90"
            cy="90"
            r="70"
            fill="none"
            stroke={coral}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray="255 440"
            transform="rotate(-90 90 90)"
          />
        </svg>
        <div style={{ fontSize: 22, color: "#77756E", marginTop: 20 }}>
          Safe to spend today
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            fontSize: 76,
            letterSpacing: -3,
            lineHeight: 1,
          }}
        >
          <span
            style={{
              fontSize: 32,
              color: "#77756E",
              marginTop: 8,
              marginRight: 4,
            }}
          >
            ₹
          </span>
          1,250
        </div>
      </div>
    </div>,
    size,
  );
}
