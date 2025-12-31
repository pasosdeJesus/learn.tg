import * as React from 'react'
import Link from 'next/link'

export default function Footer({ lang = 'en' }) {
  return (
    <footer className="bg-gray-800 text-white py-8 relative">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap justify-between">
          <div
            className="absolute text-center -right-2 bottom-12  w-35 h-8 overflow-hidden pointer-events-none"
            style={{
              backgroundColor: '#90EE90',
              transform: 'rotate(-45deg)',
              transformOrigin: 'center',
              zIndex: 50,
              border: '2px solid #228B22',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            Let Gaza Live
          </div>

          <div className="justify-self-start">
            {lang == 'es' && (
              <div className="pt-4">
                <a
                  href="https://t.me/learn_t_g"
                  className="hover:underline !text-white font-bold"
                >
                  Grupo en Telegram
                </a>
              </div>
            )}
            {lang != 'es' && (
              <div className="pt-4">
                <a
                  href="https://t.me/learn_t_g"
                  className="hover:underline !text-white font-bold"
                >
                  Telegram group
                </a>
              </div>
            )}
          </div>

          <div className="w-full md:w-1/3">
            <h3 className="text-lg !text-accent font-semibold mb-2">
              {lang === 'es' ? 'Síguenos' : 'Follow us'}
            </h3>
            <nav aria-label="Social media links">
              <div className="flex space-x-4">
                <a
                  href="https://twitter.com/pasosdeJesus"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-400 hover:text-white"
                >
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.71v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </a>
                <a
                  href="https://gitlab.com/pasosdeJesus/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-400 hover:text-white"
                >
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="m15.734 6.1-.022-.058L13.534.358a.57.57 0 0 0-.563-.356.6.6 0 0 0-.328.122.6.6 0 0 0-.193.294l-1.47 4.499H5.025l-1.47-4.5A.572.572 0 0 0 2.47.358L.289 6.04l-.022.057A4.044 4.044 0 0 0 1.61 10.77l.007.006.02.014 3.318 2.485 1.64 1.242 1 .755a.67.67 0 0 0 .814 0l1-.755 1.64-1.242 3.338-2.5.009-.007a4.05 4.05 0 0 0 1.34-4.668Z" />
                  </svg>
                </a>
                <a
                  href="https://github.com/pasosdeJesus"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-400 hover:text-white"
                >
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.165 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.031-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.378.203 2.398.1 2.65.64.7 1.03 1.595 1.03 2.688 0 3.848-2.338 4.695-4.566 4.943.359.308.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.001 10.001 0 0022 12c0-5.523-4.477-10-10-10z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
              </div>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  )
}
