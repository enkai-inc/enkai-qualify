export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Metis
      </h1>
      <p className="text-xl text-gray-600 mb-8">
        Transform market signals into buildable SaaS opportunities
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">🔍 Discover Ideas</h2>
          <p className="text-gray-600">
            Browse data-driven opportunities from market signals
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">✨ Generate Ideas</h2>
          <p className="text-gray-600">
            Create with AI assistance based on your preferences
          </p>
        </div>
      </div>
    </div>
  );
}
