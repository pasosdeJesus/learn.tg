
export default class MsipAutocompletaAjaxFamiliares {
  /* No usamos constructor ni this porque en operaElegida sería
   * del objeto AutocompletaAjaxExpreg y no esta clase.
   * Más bien en esta todo static
   */


  // Elije una persona en autocompletación
  static operarElegida (eorig, cadpersona, id, otrosop) {
    let root = window
    msip_arregla_puntomontaje(root)
    const cs = id.split(';')
    const idPersona = cs[0]
    const divcpf = eorig.target.closest('.' + 
      MsipAutocompletaAjaxFamiliares.claseEnvoltura)
    divcpf.querySelector(
      '.persona_persona_trelacion1_personados_id > input').value = idPersona
    divcpf.querySelector(
      '.persona_persona_trelacion1_personados_nombres > input').value = ""
    divcpf.querySelector(
      '.persona_persona_trelacion1_personados_apellidos > input').value = ""
    divcpf.querySelector('input[value=Actualizar]').click()
  }

  static iniciar() {
    console.log("MsipAutocompletaAjaxFamiliares")
    let url = window.puntomontaje + 'personas.json'
    var asistentes = new window.AutocompletaAjaxExpreg(
      [ /^persona_persona_trelacion1_attributes_[0-9]*_personados_attributes_nombres$/ ],
      url,
      MsipAutocompletaAjaxFamiliares.idDatalist,
      MsipAutocompletaAjaxFamiliares.operarElegida
    )
    asistentes.iniciar()
  }

}

// Sobrellevamos imposibilidad de hacer static claseEnvoltura y
// static idDatalist dentro de la clase MsipAutocompletaAjaxFamiliares asi:
MsipAutocompletaAjaxFamiliares.claseEnvoltura = 'nested-fields'
MsipAutocompletaAjaxFamiliares.idDatalist = 'fuente-familiares'
