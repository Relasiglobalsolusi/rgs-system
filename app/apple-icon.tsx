import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Matches app/icon.tsx — teal RGS ONE mark. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0F14",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            width: 124,
            height: 124,
            borderRadius: 31,
            background: "#54BFB4",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 78,
              height: 78,
              borderRadius: 20,
              background: "#0B0F14",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 11,
                background: "#54BFB4",
              }}
            />
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
