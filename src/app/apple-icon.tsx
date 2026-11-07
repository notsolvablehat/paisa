import { ImageResponse } from "next/og";

// Home-screen icon: the same ring mark, full-bleed (iOS rounds the corners itself).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#111210",
      }}
    >
      <svg width="180" height="180" viewBox="0 0 256 256">
        <circle
          cx="128"
          cy="128"
          r="70"
          fill="none"
          stroke="#F4F2EC"
          strokeOpacity="0.14"
          strokeWidth="22"
        />
        <circle
          cx="128"
          cy="128"
          r="70"
          fill="none"
          stroke="#E8532F"
          strokeWidth="22"
          strokeLinecap="round"
          strokeDasharray="330 110"
        />
        <circle cx="177.5" cy="78.5" r="11" fill="#F4F2EC" />
      </svg>
    </div>,
    size,
  );
}
