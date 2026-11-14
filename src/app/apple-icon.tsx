import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#2E2620" }}>
        <svg width="180" height="180" viewBox="0 0 64 64">
          <path d="M16.5 19 L32 47.5 L47.5 19" fill="none" stroke="#D9B27C" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M47.5 19 C48.5 15.2 51.4 12.6 55.6 12 C54.9 16.1 51.9 18.7 47.5 19 Z" fill="#AEB38B" />
        </svg>
      </div>
    ),
    size,
  );
}
