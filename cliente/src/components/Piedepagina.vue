<template>
  <footer class="w-full bg-primary-200 z-20 dark:text-gray-900 flex flex-col px-16">
    <div class="flex  flex-col lg:flex-row">
      <div class="container flex flex-col mx-auto dark:divide-gray-600">
        <div class="text-white leading-loose tracking-wide w-full md:w-[60%] font-semibold lg:justify-start">
          Si tienes preguntas o sugerencias escribenos a
          <a href="mailto:info@pasosdeJesus.org" class="hover:underline text-secondary-100 font-bold">info@pasosdeJesus.org</a>
        </div>
      </div>
    <div class="flex flex-col justify-center pt-6 lg:pt-0">
      <div class="flex justify-center space-x-4">
        <a target="_blank" href="https://twitter.com/pasosdeJesus" class="flex items-center justify-center w-8 h-8 rounded-full sm:w-10 sm:h-10 dark:bg-violet-600 dark:text-gray-50">
          <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              class="bi bi-twitter w-4 h-4"
              viewBox="0 0 16 16"
            >
              <path
                d="M5.026 15c6.038 0 9.341-5.003 9.341-9.334q.002-.211-.006-.422A6.7 6.7 0 0 0 16 3.542a6.7 6.7 0 0 1-1.889.518 3.3 3.3 0 0 0 1.447-1.817 6.5 6.5 0 0 1-2.087.793A3.286 3.286 0 0 0 7.875 6.03a9.32 9.32 0 0 1-6.767-3.429 3.29 3.29 0 0 0 1.018 4.382A3.3 3.3 0 0 1 .64 6.575v.045a3.29 3.29 0 0 0 2.632 3.218 3.2 3.2 0 0 1-.865.115 3 3 0 0 1-.614-.057 3.28 3.28 0 0 0 3.067 2.277A6.6 6.6 0 0 1 .78 13.58a6 6 0 0 1-.78-.045A9.34 9.34 0 0 0 5.026 15"
              />
            </svg>
        </a>
        <a href="https://gitlab.com/pasosdeJesus/" target="_blank" class="flex items-center justify-center w-8 h-8 rounded-full sm:w-10 sm:h-10 dark:bg-violet-600 dark:text-gray-50">
          <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              class="bi bi-gitlab w-4 h-4"
              viewBox="0 0 16 16"
            >
              <path
                d="m15.734 6.1-.022-.058L13.534.358a.57.57 0 0 0-.563-.356.6.6 0 0 0-.328.122.6.6 0 0 0-.193.294l-1.47 4.499H5.025l-1.47-4.5A.572.572 0 0 0 2.47.358L.289 6.04l-.022.057A4.044 4.044 0 0 0 1.61 10.77l.007.006.02.014 3.318 2.485 1.64 1.242 1 .755a.67.67 0 0 0 .814 0l1-.755 1.64-1.242 3.338-2.5.009-.007a4.05 4.05 0 0 0 1.34-4.668Z"
              />
            </svg>
        </a>
        <a target="_blank" href="https://github.com/pasosdeJesus" rel="norreferer" class="flex items-center justify-center w-8 h-8 rounded-full sm:w-10 sm:h-10 dark:bg-violet-600 dark:text-gray-50">
          <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              class="bi bi-github w-4 h-4"
              viewBox="0 0 16 16"
            >
              <path
                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"
              />
            </svg>
        </a>
      </div>
    </div>
    </div>
   
    <div class="grid place-items-center w-full">
      <p
        class="md:text-lg font-medium text-center text-white mt-4 tracking-wider"
      >
          Puedes reusar abiertamente el contenido gratuito dando crédito. 2024
      </p>
    </div>
  </footer>
</template>

<style>
.piedepagina {
  padding-top: 2rem;
  padding-bottom: 1rem;
  width: 100%;
  background-color: var(--color-1);
  color: white;
  display: flex;
  justify-content: space-between;
} 

.gitlab img {
  width: 1.5rem;
  height: 1rem;
  object-fit: cover;
  object-position: -4px -4px;
}

.derechos {
  padding-left: 4rem;
}
.social {
  padding-right: 4rem;
}
</style>
