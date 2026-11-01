const normalizeOrigin = (value: string) => value.trim().replace(/\/$/, "");

const configuredOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGINS,
]
  .filter(Boolean)
  .flatMap((value) => value!.split(","))
  .map(normalizeOrigin)
  .filter(Boolean);

const developmentOrigins =
  process.env.NODE_ENV === "production"
    ? []
    : [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
      ];

export const allowedOrigins = Array.from(
  new Set(
    [...configuredOrigins, ...developmentOrigins].filter(
      (origin) => origin !== "*",
    ),
  ),
);

export const isAllowedOrigin = (origin?: string) =>
  !origin || allowedOrigins.includes(normalizeOrigin(origin));

export const corsOriginError = () =>
  new Error(
    `Origin is not allowed by CORS. Configure CLIENT_URL/CORS_ORIGINS for this frontend origin.`,
  );
