export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {{PROJECT_NAME}}
        </h1>
        <p className="text-gray-600">
          Edit{' '}
          <code className="bg-gray-200 px-2 py-1 rounded">
            src/app/page.tsx
          </code>{' '}
          to get started
        </p>
      </div>
    </main>
  );
}
