import { ImageResponse } from "next/og";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 76,
        color: "white",
        background: "#050910",
        fontFamily: "Arial",
      }}
    >
      <div style={{ color: "#18e0d0", fontSize: 28, letterSpacing: 2 }}>
        ВНЕШНИЙ КОММЕРЧЕСКИЙ КОНТУР
      </div>
      <div
        style={{
          fontSize: 76,
          lineHeight: 1.03,
          fontWeight: 800,
          maxWidth: 1000,
          marginTop: 24,
        }}
      >
        Весь путь пациента — в одной управляемой системе
      </div>
      <div style={{ fontSize: 28, color: "#aeb9c8", marginTop: 34 }}>
        КЛИНИКА В ЦИФРАХ
      </div>
    </div>,
    size,
  );
}
