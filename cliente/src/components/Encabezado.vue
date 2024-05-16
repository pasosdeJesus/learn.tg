<script setup>
  import { ref } from 'vue'

  // https://www.okx.com/es-la/web3/build/docs/sdks/chains/evm/web-detect-user-network
  const RED = {
    0x1: "Ethereum Mainnet",
    0xa: "Optimism Mainnet",
    0xe: "Flare",
    0x38: "Binance Smart Chain Mainnet",
    0x42: "OKT Chain Mainnet",
    0x89: "Matic Mainnet",
    0x19: "Cronos Mainnet",
    0x64: "Gnosis Mainnet",
    0xc3: "X Layer Testnet",
    0xc4: "X Layer Mainnet",
    0xfa: "Fantom Mainnet",
    0x120: "Boba Mainnet",
    0x144: "zkSync Era",
    0x141: "KCC Mainnet",
    0x198: "Omega Network",
    0x406: "Conflux eSpace",
    0x440: "Metis Mainnet",
    0x44d: "Polygon zkEVM",
    0x45c: "Core",
    0x505: "Moonriver Mainnet",
    0x504: "Moonbeam Mainnet",
    0x7e4: "Ronin",
    0x8ae: "Kava EVM",
    0x1388: "Mantle",
    0x2019: "Klaytn Mainnet",
    0x2105: "Base",
    0x2711: "ETHW",
    0xa4b1: "Arbitrum Mainnet",
    0xa4ba: "Arbitrum Nova",
    0xa4ec: "Celo",
    0xa86a: "Avax Mainnet",
    0xe708: "Linea",
    0xaa36a7: "Sepolia",
    0x63564c40: "Harmony",

  }

  const red = ref("")
  const cuenta = ref("")
  const estado_boton = ref("Ingresar") // o Desconectar o Enlace
  function manejarCambioDeRed(chainId) {
    console.log("Cambio de red", chainId)
    if (typeof RED[+chainId] == "undefined") {
      debugger
    }
    window.location.reload();
  }

  function manejarCambioDeCuenta(dir) {
    console.log("Cambio de cuenta", dir)
    window.location.reload();
  }

  function asigna_direccion() {
    estado_boton.value = "Ingresar"
    cuenta.value = ""
    red.value = ""
    if (typeof okxwallet != "undefined" && 
      typeof okxwallet.selectedAddress != "undefined" &&
      okxwallet.selectedAddress != null) {
      estado_boton.value = "Desconectar"
      let dir = okxwallet.selectedAddress
      let ab = `${dir.slice(2,6)}...${dir.slice(-4,-1)}`
      cuenta.value = `Cuenta: ${ab}`
      okxwallet.on('accountsChanged', manejarCambioDeCuenta);
      if (typeof okxwallet.networkVersion != "undefined") {
        console.log("networkVersion", okxwallet.networkVersion)
        red.value = `Red: ${RED[okxwallet.networkVersion]}`
        okxwallet.on('chainChanged', manejarCambioDeRed)
      }
    }
  }

  asigna_direccion()

  function conectar(event) {
    const ua = navigator.userAgent;
    const esIOS = /iphone|ipad|ipod|ios/i.test(ua);
    const esAndroid = /android|XiaoMi|MiuiBrowser/i.test(ua);
    const esMovil = esIOS || esAndroid;
    const esOKApp = /OKApp/i.test(ua);

    if (esMovil && !esOKApp){
      let miurl = location.href
      if (miurl.slice(-1) == "/") {
        miurl = miurl.slice(0,-1)
      }
      enlace_celular.value = "https://www.okx.com/download?deeplink=" +
        encodeURIComponent("okx://wallet/dapp/url?dappUrl=" +
        encodeURIComponent(miurl));
      alert(`Si ya te registraste en okx como referido, ` +
        `usa el enlace para celular`)
      estado_boton.value = "Enlace"
      cuenta.value = ""
      red.value = ""
    } else {
      if (typeof okxwallet == "undefined") {
        alert("Primero registrate en OKX como referido e instala la aplicación");
        return;
      }
      okxwallet
        .request({ method: "eth_requestAccounts" })
        .then((cuentas) => {
          console.log("eth_requestAccounts dio", cuentas)
          window.ethereum
          .request({ method: "eth_chainId" })
          .then((id_cadena) => {
            console.log("eth_chainId dio", id_cadena)
            asigna_direccion()
          })
        })
        .catch((err) => {
          if (err.code === 4001) {
            console.log("Conexión rechazada por el usuario.");
          } else {
            console.error(err);
          }
        });
    }
  }

  function desconectar(event) {
    okxwallet
      .disconnect()
      .then((res) => {
        okxwallet.removeListener('accountsChanged', manejarCambioDeCuenta);
        okxwallet.removeListener('chainChanged', manejarCambioDeRed);
        asigna_direcion()
      })
      .catch((err) => {
        console.error(err);
      });
  }
</script>

<template>
  <header class="encabezado-pagina">
    <div class="marca">
      <RouterLink to="/" class="enlace-plano">
        <div class="logo-titulo">
          <div class="aprender">Aprender</div>
          <div class="logo-titulo-medio">
            <div class="mediante">mediante</div>
            <img class="imglogo"src="/public/logo-learntg.png">
          </div>
          <div class="juegos">juegos</div>
        </div>
      </RouterLink>
    </div>
    <div class="controles">
      <button 
         class='btn' 
         @click='conectar' 
         v-if="estado_boton.value == 'Ingresar'">Ingresar</button>
      <button 
         class='btn' 
         @click='desconectar' 
         v-if="estado_boton.value == 'Desconectar'">Desconectar</button>
      <a 
         href='{{enlace_celular}}'
         class='btn' 
         v-if="estado_boton.value == 'Enlace'">Abrir en aplicación OKX</a>
      <div class="cuenta-y-red">
        <div v-html="cuenta"></div>
        <div v-html="red"></div>
      </div>
    </div>
  </header>
</template>

<style scoped>

.cuenta-y-red {
  text-align: center;
}

.btn {
  color: #fff;
  font-size: 1rem;
  width: 8rem;
  line-height: 35px;
  text-align: center;
  border-radius: 10px;
  cursor: pointer;
  background: #714BA6;
  border-color: #4C4359;
}

.titulo {
  text-align: right;
}

.enlace-plano {
  text-decoration: none;
  color: black;
}

.logo-titulo {
  width: 12rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #B9A3D9;
  font-family: "DM Serif Display", serif;
  border-radius: 5%;

}

.logo-titulo-medio {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;

} 
.aprender {
  padding-left: 0.2rem;
}

.mediante {
}

.juegos {
  padding-right: 0.2rem;
}

.imglogo {
  width: 50px;
  padding-bottom: 5px;
}

.encabezado-pagina {
  position: fixed;
  width: 100%;
  top: 0px;
  left: 0px;
  height: 80px;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  backdrop-filter: blur(10px);
  background-color: rgba(255, 255, 255, .8);
}

.marca {
  padding-left: 2em;
  height: 75px;
}

.controles {
  padding-right: 2em;
  height: 75px;
  display: flex;
  align-items: center;
  flex-direction: column;
}
</style>

