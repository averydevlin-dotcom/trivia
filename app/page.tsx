export default function Home() {
  return (
    <main className="max-w-2xl mx-auto py-20 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Bright Spark</h1>
      <p className="text-gray-500 mb-10">Daily trivia pipeline for your morning alarm.</p>
      <div className="grid grid-cols-2 gap-4">
        <a href="/calendar"
          className="block border border-gray-200 rounded-xl p-6 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
          <div className="text-2xl mb-2">📅</div>
          <div className="font-semibold text-gray-900">Content Calendar</div>
          <div className="text-sm text-gray-500 mt-1">Generate and plan monthly episodes</div>
        </a>
        <a href="/review"
          className="block border border-gray-200 rounded-xl p-6 hover:border-green-300 hover:bg-green-50 transition-colors">
          <div className="text-2xl mb-2">✅</div>
          <div className="font-semibold text-gray-900">Episode Review</div>
          <div className="text-sm text-gray-500 mt-1">Grade, edit, and regenerate episodes</div>
        </a>
      </div>
    </main>
  );
}
