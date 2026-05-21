export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {{PROJECT_NAME}}
        </h1>
        <p className="text-gray-600 mb-4">
          Full-stack Next.js + tRPC + Prisma
        </p>
        <div className="space-x-4">
          <a
            href="/login"
            className="inline-block px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Login
          </a>
          <a
            href="/dashboard"
            className="inline-block px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
