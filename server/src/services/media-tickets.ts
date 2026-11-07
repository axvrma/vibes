import * as jose from "jose";
import { AuthUser } from "../middleware/auth";
const key = () =>
  new TextEncoder().encode(
    process.env.AUTH_ACCESS_TOKEN_SECRET ||
      "fallback-secret-do-not-use-in-prod",
  );
const issuer = () => process.env.AUTH_ISSUER || "reels-private-media";
export async function issueMediaTicket(
  user: AuthUser,
  videoId: string,
  kind: "stream" | "thumbnail",
) {
  return new jose.SignJWT({ use: "media", videoId, kind })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer(issuer())
    .setAudience("vibes-media")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key());
}
export async function verifyMediaTicket(
  ticket: string,
  videoId: string,
  kind: string,
) {
  const { payload } = await jose.jwtVerify(ticket, key(), {
    issuer: issuer(),
    audience: "vibes-media",
    algorithms: ["HS256"],
  });
  if (
    payload.use !== "media" ||
    payload.videoId !== videoId ||
    payload.kind !== kind
  )
    throw new Error("Wrong media scope");
  return payload;
}
