"use client"

import {use, useState} from "react"

type PageProps = {
    params: Promise<{ 
      lang: string,
      pathPrefix: string,
    }>;
};

export default function Page({ params }: PageProps) {
  const [ counter, setCounter ] = useState(0)

  const parameters = use(params);
  const { lang, pathPrefix } = parameters;

  const handleClick = () => {
    setCounter(counter + 1);
  };


  return (
    <div>
      <p>Lang: {lang}</p>
      <p>pathPrefix: {pathPrefix}</p>
      <p>counter: {counter}</p>
      <button onClick={handleClick}>Increment</button>
    </div>
  )
}
