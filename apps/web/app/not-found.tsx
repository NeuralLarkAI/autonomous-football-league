import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-200 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-100 mb-2">404</h1>
        <p className="text-slate-400">Page not found.</p>
        <Link href="/" className="mt-4 inline-block text-sky-400 hover:text-sky-300 underline">
          Go home
        </Link>
      </div>
    </div>
  );
}
