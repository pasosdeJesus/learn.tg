import { reactive, computed } from 'vue'

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


// Supondremos que siempre se consulta primero estadoBoton
// antes de consultar cuenta y red
// Talvez garantizado mientras este antes en HTML
export const conexion = reactive({
  estadoBoton: "Ingresar",
  cuenta: "",
  red: "",
  enlaceCelular: ""
})


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

export function actualizarConexion() {
  conexion.estadoBoton = "Ingresar"
  conexion.cuenta = ""
  conexion.red = ""
  if (typeof okxwallet != "undefined" && 
    typeof okxwallet.selectedAddress != "undefined" &&
    okxwallet.selectedAddress != null) {
    conexion.estadoBoton = "Desconectar"
    let dir = okxwallet.selectedAddress
    let ab = `${dir.slice(2,6)}...${dir.slice(-4,-1)}`
    conexion.cuenta = `${ab}`
    okxwallet.on('accountsChanged', manejarCambioDeCuenta);
    if (typeof okxwallet.networkVersion != "undefined") {
      console.log("networkVersion", okxwallet.networkVersion)
      conexion.red = `Red: ${RED[okxwallet.networkVersion]}`
      okxwallet.on('chainChanged', manejarCambioDeRed)
    }
  }
}


export function conectar(event) {
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
    let enlace  = "https://www.okx.com/download?deeplink=" +
      encodeURIComponent("okx://wallet/dapp/url?dappUrl=" +
        encodeURIComponent(miurl));
    conexion.enlaceCelular = `<a href="${enlace}" class='btn'>`+
      `Abrir en aplicación OKX</a>`
    alert(`Si ya te registraste en okx como referido, ` +
      `usa el enlace para celular ${enlaceCelular.value}`)
    conexion.estadoBoton = "Enlace"
    conexion.cuenta = ""
    conexion.red = ""
  } else {
    if (typeof okxwallet == "undefined") {
      alert("Primero registrate en OKX como referido e instala la aplicación en tu celular o la extensión en tu navegador");
      return;
    }
    okxwallet
      .request({ method: "eth_requestAccounts" })
      .then((cuentas) => {
        console.log("eth_requestAccounts dio", cuentas)
        window.ethereum
          .request({ method: "eth_chainId" })
          .then((idCadena) => {
            console.log("eth_chainId dio", idCadena)
            actualizarConexion()
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

export function desconectar(event) {
  okxwallet
    .disconnect()
    .then((res) => {
      okxwallet.removeListener('accountsChanged', manejarCambioDeCuenta);
      okxwallet.removeListener('chainChanged', manejarCambioDeRed);
      actualizarConexion()
    })
    .catch((err) => {
      console.error(err);
    });
}

export const estadoBoton = computed(() => {
  actualizarConexion()
  return conexion.estadoBoton
})

export const cuenta = computed(() => {
  return conexion.cuenta
})

export const red = computed(() => {
  return conexion.red
})


export async function cambiarXLayer(event) {
    try {
      console.log(okxwallet.chainId)
      const chainId = "0xc4"; // X Layer
      await okxwallet.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainId }]
      });
    } catch (switchError) {
      // This error code indicates that the chain
      // has not been added to OKX Wallet.
      console.log("switchError.code=", switchError.code)
      if (switchError.code === 4902) {
        try {
          await okxwallet.request({
            method: "wallet_addEthereumChain",
            params: [{ chainId: "0xf00", rpcUrl: "https://..."
        /* ... */ }]
          });
        } catch (addError) {
          // handle "add" error
        }
      }
      // handle other "switch" errors
    }
  }

export async function pagarOKB(event) {
  okxwallet
    .request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: okxwallet.selectedAddress,
          to: '0x2e2c4ac19c93d0984840cdd8e7f77500e2ef978e',
          value: '0x3782dace9d90000', // 0.25okb=25x10^16wei
          gasPrice: '0x09184e72a000',
          gas: '0x2710',
        },
      ],
    })
    .then((txHash) => console.log("txHash", txHash))
    .catch((error) => console.error("error", error));
}

export async function pagarUSDT(event) {
  // https://ethereum.stackexchange.com/questions/66345/how-to-use-sendtransaction-to-send-erc20-tokens-through-metamask
  okxwallet
    .request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: okxwallet.selectedAddress,
          to: '0x2e2c4ac19c93d0984840cdd8e7f77500e2ef978e',
          value: '0x3782dace9d90000', // 0.25okb=25x10^16wei
          gasPrice: '0x09184e72a000',
          gas: '0x2710',
        },
      ],
    })
    .then((txHash) => console.log("txHash", txHash))
    .catch((error) => console.error("error", error));
}


