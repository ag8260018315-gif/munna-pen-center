import { z } from "zod";
import { PASSWORD_MAX_LENGTH } from "@/lib/auth/password";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your e-mail").max(254),
  password: z.string().min(1, "Enter your password").max(PASSWORD_MAX_LENGTH),
});

export const setupSchema = z
  .object({
    token: z.string().min(1, "Enter the setup key").max(300),
    name: z.string().trim().min(2, "Enter your name").max(100),
    email: z.email("Enter a valid e-mail").max(254),
    password: z.string().max(PASSWORD_MAX_LENGTH),
    confirm: z.string().max(PASSWORD_MAX_LENGTH),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords do not match" });

export interface AuthFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}
