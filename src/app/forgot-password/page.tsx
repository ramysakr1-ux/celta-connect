import { ForgotPasswordForm } from "@/app/forgot-password/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="card w-full max-w-sm p-8">
        <h1 className="font-serif text-2xl text-ink">Reset your password</h1>
        <p className="mt-1 text-muted">Enter your email and we&apos;ll send you a reset link.</p>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
