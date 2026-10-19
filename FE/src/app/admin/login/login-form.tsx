"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/admin/form-field";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { useScopedId } from "@/hooks/use-scoped-id";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { AuthUserResponse } from "@/lib/api/types";

const loginSchema = z.object({
  password: z.string().min(1, { error: "Kata sandi wajib diisi." }),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm({ next }: { next: string }) {
  const sid = useScopedId("login");
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiFetch<AuthUserResponse>("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      router.replace(next);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          if (field === "password") {
            setError(field, { message: messages[0] });
          }
        }
        return;
      }
      setError("root", {
        message:
          error instanceof ApiError ? error.message : "Tidak dapat terhubung ke server. Coba lagi.",
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormField id={sid("password")} label="Kata sandi" error={errors.password?.message}>
        <Input type="password" autoComplete="current-password" autoFocus {...register("password")} />
      </FormField>

      {errors.root?.message ? (
        <p role="alert" className="text-small text-status-error">
          {errors.root.message}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
        {isSubmitting ? "Memproses..." : "Masuk"}
      </Button>
    </form>
  );
}
