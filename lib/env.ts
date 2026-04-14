import { z } from "zod";

const EnvSchema = z.object({
  GEMINI_API_KEYS: z
    .string()
    .min(1, "GEMINI_API_KEYS missing from .env.local")
    .transform((s) =>
      s
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    )
    .refine((arr) => arr.length >= 1, "GEMINI_API_KEYS must contain at least one key"),
  GEMINI_MODEL: z.string().min(1).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse({
    GEMINI_API_KEYS: process.env.GEMINI_API_KEYS,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
