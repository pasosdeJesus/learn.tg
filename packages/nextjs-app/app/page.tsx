"use client"

export default function Home() {
  return (
    <div className="flex items-center justify-center bg-gradient-to-br from-white via-gray-100 to-gray-200 text-gray-900">
        <div className="flex flex-wrap justify-center gap-8 py-5">
        
        {/* Card English */}
        <a
          href="/en"
          className="flex flex-col items-center justify-center w-72 h-44 rounded-2xl 
                     bg-white shadow-md hover:shadow-2xl border border-gray-200
                     transition-all duration-300 transform hover:-translate-y-2"
        >
          <span className="text-xl font-semibold text-primary-500">English</span>
        </a>

        {/* Card Español */}
        <a
          href="/es"
          className="flex flex-col items-center justify-center w-72 h-44 rounded-2xl 
                     bg-white shadow-md hover:shadow-2xl border border-gray-200
                     transition-all duration-300 transform hover:-translate-y-2"
        >
          <span className="text-xl font-semibold text-primary-500">Español</span>
        </a>
        
      </div>
    </div>
  )
}
