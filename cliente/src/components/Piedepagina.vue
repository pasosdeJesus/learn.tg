<template>
  <footer class="piedepagina">
    <div class="derechos">
      <div>
        Puedes reusar abiertamente el contenido gratuito dando crédito. 2024
      </div>
      <div>
        Si tienes preguntas o sugerencias escribenos a
        <a href="mailto:info@pasosdeJesus.org">info@pasosdeJesus.org</a>
      </div>
    </div>
    <div class="legal">
    </div>
    <div class="social">
      <div class="twitter">
        <a target="_blank" href="https://twitter.com/pasosdeJesus">
          <img style="width: 1rem" src="/public/twitter.svg" alt="Logo de Twitter">
        </a>
      </div>

      <div class="gitlab">
        <a href="https://gitlab.com/pasosdeJesus/" target="_blank"        >
          <img src="/public/gitlab.svg" alt="Logo de Gitlab">
        </a>
      </div>

      <div class="github">
        <a target="_blank" href="https://github.com/pasosdeJesus" rel="norreferer">
          <img style="width: 1rem" src="/public/github.svg" alt="Logo de Github">
        </a>
      </div>
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
