import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] text-[#2B2B2B] p-6 font-sans">
      <div className="max-w-md w-full bg-white border border-[#D4D4D4] rounded-2xl p-8 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-xl font-bold text-slate-700">
          404
        </div>
        <h2 className="text-lg font-bold text-[#2B2B2B]">Page Not Found</h2>
        <p className="text-xs text-[#666666]">
          The requested page or route could not be located in the orchestrator system.
        </p>
        <Link
          href="/merchant"
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#2B2B2B] text-white text-xs font-semibold hover:bg-black transition-colors"
        >
          Return to Merchant Console
        </Link>
      </div>
    </div>
  );
}
