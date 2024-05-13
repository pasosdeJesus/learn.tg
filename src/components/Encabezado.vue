<template>
  <header class="encabezado-pagina">
    <div class="marca">
      <RouterLink to="/">
        <div class="logo-titulo">
          <img class="imglogo"src="/public/logo-learntg.png">
          <div class="titulo">
            <div class="aprender">Aprender</div>
            <div class="mediante-juegos">mediante juegos</div>
          </div>
        </div>
      </RouterLink>
    </div>
    <div class="controles">
      <button>Conectar</button>
    </div>
  </header>
</template>

<style scoped>

.titulo {
  text-align: right;
}

.logo-titulo {
  text-decoration: none;
  width: 12rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.aprender {
   text-decoration: none;
}

.mediante-juegos {
   text-decoration: none;
}

.imglogo {
  padding-top: 10px;
  width: 60px;
}

.encabezado-pagina {
  position: fixed;
  width: 100%;
  top: 0px;
  left: 0px;
  height: 75px;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  backdrop-filter: blur(10px);
  background-color: rgba(255, 255, 255, .8);
}
.marca {
  padding-left: 2em;
}
.controles {
  padding-right: 2em;
}
</style>

