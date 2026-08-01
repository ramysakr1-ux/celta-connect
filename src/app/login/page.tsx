import { LoginForm } from "@/app/login/login-form";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="card w-full max-w-sm p-8">
        <h1 className="font-serif text-2xl text-ink">Celta Connect</h1>
        <p className="mt-1 text-muted">Sign in to your center.</p>
        <LoginForm />
      </div>
    </div>
  );
}
