'use client'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-100/20 via-transparent to-secondary-100/20 animate-pulse"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <div className="text-center space-y-8">
            <section aria-label="Hero section">
              <div className="space-y-4">
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-primary-300 via-primary-200 to-secondary-100 bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-4 duration-1000">
                  Learn Through Games
                </h1>
                <p className="text-xl sm:text-2xl text-gray-600 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
                  Blockchain-powered education with real rewards. Study, 
                  play and earn scholarships as you learn.
                </p>
              </div>

              <div className="flex items-center justify-center gap-4 text-sm text-gray-500 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Web3 Enabled</span>
                </div>
                <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span>USDT Rewards</span>
                </div>
                <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                  <span>Free to Start</span>
                </div>
              </div>
            </section>

            <section aria-label="Language selection">
              <div className="pt-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
                <h2 className="text-2xl font-semibold text-gray-700 mb-8">
                  Choose Your Language
                </h2>
                <div className="flex flex-wrap justify-center gap-6 max-w-4xl mx-auto">
                  <a
                    href="/en"
                    className="group relative w-80 h-56 rounded-3xl bg-gradient-to-br from-white to-gray-50 shadow-lg hover:shadow-2xl border border-gray-200 hover:border-primary-200 transition-all duration-500 transform hover:-translate-y-3 hover:scale-105 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-100/0 to-primary-100/0 group-hover:from-primary-100/10 group-hover:to-primary-200/10 transition-all duration-500"></div>
                    <div className="relative h-full flex flex-col items-center justify-center p-8 space-y-4">
                      <div className="text-6xl transform group-hover:scale-110 transition-transform duration-500">
                        🇬🇧
                      </div>
                      <h3 className="text-3xl font-bold text-gray-800 group-hover:text-primary-300 transition-colors duration-300">
                        English
                      </h3>
                      <p className="text-sm text-gray-500 text-center">
                        Education & scholarships
                      </p>
                      <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                        <span className="text-white text-xl">→</span>
                      </div>
                    </div>
                  </a>

                  <a
                    href="/es"
                    className="group relative w-80 h-56 rounded-3xl bg-gradient-to-br from-white to-gray-50 shadow-lg hover:shadow-2xl border border-gray-200 hover:border-secondary-100 transition-all duration-500 transform hover:-translate-y-3 hover:scale-105 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-secondary-100/0 to-secondary-100/0 group-hover:from-secondary-100/10 group-hover:to-primary-100/10 transition-all duration-500"></div>
                    <div className="relative h-full flex flex-col items-center justify-center p-8 space-y-4">
                      <div className="text-6xl transform group-hover:scale-110 transition-transform duration-500">
                        🇪🇸
                      </div>
                      <h3 className="text-3xl font-bold text-gray-800 group-hover:text-secondary-100 transition-colors duration-300">
                        Español
                      </h3>
                      <p className="text-sm text-gray-500 text-center">
                        Educación y becas
                      </p>
                      <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                        <span className="text-white text-xl">→</span>
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            </section>

            <section aria-label="Key features">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto pt-16 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-700">
                <article className="text-center space-y-3 p-6 rounded-2xl bg-white/50 backdrop-blur-sm border border-gray-100 hover:border-primary-100 transition-all duration-300 hover:shadow-lg">
                  <div className="text-4xl">🎓</div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    Interactive Courses
                  </h3>
                  <p className="text-sm text-gray-600">
                    Engaging content with games and challenges
                  </p>
                </article>

                <article className="text-center space-y-3 p-6 rounded-2xl bg-white/50 backdrop-blur-sm border border-gray-100 hover:border-primary-100 transition-all duration-300 hover:shadow-lg">
                  <div className="text-4xl">💰</div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    Earn Rewards
                  </h3>
                  <p className="text-sm text-gray-600">
                    Get paid in USDT for completing educational guides
                  </p>
                </article>

                <article className="text-center space-y-3 p-6 rounded-2xl bg-white/50 backdrop-blur-sm border border-gray-100 hover:border-primary-100 transition-all duration-300 hover:shadow-lg">
                  <div className="text-4xl">🔒</div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    Blockchain Secured
                  </h3>
                  <p className="text-sm text-gray-600">
                    Transparent scholarships on Celo blockchain
                  </p>
                </article>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
