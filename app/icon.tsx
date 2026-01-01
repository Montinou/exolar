import { ImageResponse } from "next/og"

// Route segment config
export const runtime = "edge"

// Image metadata
export const size = {
  width: 32,
  height: 32,
}
export const contentType = "image/png"

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 20,
          background: "#0B0B0F", // Deep Void
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#F59E0B", // Safety Amber
          borderRadius: "6px",
          border: "1px solid #6366F1", // Electric Indigo border
        }}
      >
        <div
          style={{
            position: "relative",
            width: "16px",
            height: "16px",
            background: "#F59E0B",
            borderRadius: "2px",
            transform: "rotate(45deg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
             style={{
                width: "8px",
                height: "8px",
                background: "#0B0B0F",
                borderRadius: "1px",
             }}
          />
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
