import { ImageResponse } from "next/og";

export const alt = "RonFax — Send fax online to US & Canada";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          background: "linear-gradient(145deg, #ffffff 0%, #f0f9ff 45%, #e0f2fe 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: "#009cff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="44" height="44" viewBox="0 0 40 40" fill="none">
              <path
                d="M12 10C10.8954 10 10 10.8954 10 12V28C10 29.1046 10.8954 30 12 30H28C29.1046 30 30 29.1046 30 28V16L24 10H12Z"
                fill="white"
              />
            </svg>
          </div>
          <span
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: "#09090b",
              letterSpacing: -2,
            }}
          >
            RonFax
          </span>
        </div>
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: "#09090b",
            lineHeight: 1.15,
            maxWidth: 960,
            letterSpacing: -1,
          }}
        >
          Send fax online — US & Canada
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 30,
            color: "#52525b",
            fontWeight: 600,
            maxWidth: 920,
            lineHeight: 1.35,
          }}
        >
          $1.99 per fax (up to 3 pages) · HIPAA-aware · No subscription
        </div>
      </div>
    ),
    { ...size },
  );
}
