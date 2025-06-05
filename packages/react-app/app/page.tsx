"use client"

export default function Home() {

  return (
  <div className="overflow-x-hidden py-8 dark:bg-gray-100 dark:text-gray-900">
    <div className="overflow-x-hidden py-1 dark:bg-gray-100 dark:text-gray-900 flex flex-row flex-wrap justify-center mt-2">
      <>
        <div className="flex flex-col justify-center w-full px-8 mx-6 my-12 py-9
              text-center rounded-md md:w-96 lg:w-80 xl:w-65 bg-gray-300
              dark:text-gray-900">
          <a href="/en">
          English
          </a>
        </div>
        <div className="flex flex-col justify-center w-full px-8 mx-6 my-12 py-9
              text-center rounded-md md:w-96 lg:w-80 xl:w-65 bg-gray-300
              dark:text-gray-900">
          <a href="/es">
          Español
          </a>
        </div>
      </>
    </div>
  </div>
  )
}

