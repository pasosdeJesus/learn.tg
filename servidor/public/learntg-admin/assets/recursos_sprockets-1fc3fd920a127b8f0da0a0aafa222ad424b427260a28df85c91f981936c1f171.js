(function($) {

  var cocoon_element_counter = 0;

  var create_new_id = function() {
    return (new Date().getTime() + cocoon_element_counter++);
  }

  var newcontent_braced = function(id) {
    return '[' + id + ']$1';
  }

  var newcontent_underscord = function(id) {
    return '_' + id + '_$1';
  }

  var getInsertionNodeElem = function(insertionNode, insertionTraversal, $this){

    if (!insertionNode){
      return $this.parent();
    }

    if (typeof insertionNode == 'function'){
      if(insertionTraversal){
        console.warn('association-insertion-traversal is ignored, because association-insertion-node is given as a function.')
      }
      return insertionNode($this);
    }

    if(typeof insertionNode == 'string'){
      if (insertionTraversal){
        return $this[insertionTraversal](insertionNode);
      }else{
        return insertionNode == "this" ? $this : $(insertionNode);
      }
    }

  }

  $(document).on('click', '.add_fields', function(e) {
    e.preventDefault();
    var $this                 = $(this),
        assoc                 = $this.data('association'),
	assocs                = $this.data('associations'),
        content               = $this.data('association-insertion-template'),
        count                 = parseInt($this.data('count'), 10),
        regexp_braced         = new RegExp('\\[new_' + assoc + '\\](.*?\\s)', 'g'),
        regexp_underscord     = new RegExp('_new_' + assoc + '_(\\w*)', 'g'),
        new_id                = null,
        new_content           = null;

    count = (isNaN(count) ? 1 : Math.max(count, 1));

    if (count == 1 && $this.data('ajax') && $this.data('ajaxdata')) {
      var cid                 = $this.data("ajaxdata"),
          mdata               = {},
          regexp_inputid      = new RegExp('<input .*id="[^"]*_' + assoc + 
			  '_id"', 'g'),
          regexp_inputid2     = new RegExp('<input .*id="[^"]*_' + assocs + 
			  '_id"', 'g');
      mdata[cid] = $('#' + cid).val();
      if (mdata[cid] == undefined) {
        wrapper_class = $this.data('wrapper-class') || 'nested-fields';
      	mdata[cid] =  $(this).closest('.' + wrapper_class).
		find('.' + cid + ' input').val();
      }
	      

      $.ajax($this.data("ajax"), {
        type: 'GET',
        dataType: 'json', 
        data: mdata
      }).done(function(pnew_id) { 
        if (typeof pnew_id == "string" || typeof pnew_id == "number") {
          new_content = content.replace(regexp_inputid, 
            '$& value="' + pnew_id + '" ');
          new_content = new_content.replace(regexp_inputid2, 
            '$& value="' + pnew_id + '" ');
	  new_id = pnew_id;
        } else {
          if (!(assoc in pnew_id)) {
            alert( "Cocoon request failed, json returned should include key " 
		    + assoc + " with identification of new association");
          }
          new_id = pnew_id[assoc]
          new_content = content.replace(regexp_inputid, 
            '$& value="' + new_id + '" ');
          new_content = new_content.replace(regexp_inputid2, 
            '$& value="' + new_id + '" ');
          for (var i in pnew_id) {
            if (i != assoc) {
              // We tried by converting to jquery and using val and html but
              // didn't change the generated html
              var regexp_secinputid = new RegExp(
                  '<input .*id="[^"]*_' + i + '_attributes_id"', 'g');
              new_content = new_content.replace(regexp_secinputid, 
                  '$& value="' + pnew_id[i] + '" ');
              var regexp_input = new RegExp(
	          '<input .*id="[^"]*_new_' + assoc + '_' + i + '"', 'g');
              new_content = new_content.replace(regexp_input, 
                  '$& value="' + pnew_id[i] + '" ');
              var regexp_input2 = new RegExp(
	          '<input .*id="[^"]*_new_' + assocs + '_' + i + '"', 'g');
              new_content = new_content.replace(regexp_input2, 
                  '$& value="' + pnew_id[i] + '" ');
              var regexp_select = new RegExp(
	          '<select .*id="[^"]*_new_' + assoc + '_' + i + 
                  '".* <option value="' + pnew_id[i] + '"', 'g');
              new_content = new_content.replace(regexp_input, 
                  '$& selected');
            } 
          }
        }
        new_content2 = new_content.replace(regexp_braced, newcontent_braced(new_id));
        if (new_content2 != new_content) {
          new_content2 = new_content2.replace(regexp_underscord,
              newcontent_underscord(new_id));
        }
	add_fields($this, assoc, assocs, new_content2, count, regexp_braced,
			new_id, new_content2);
      }).fail(function(jqXHR, textStatus) {
        alert( "Cocoon request failed: " + textStatus );
      });
    } else {
      new_id = create_new_id();
      new_content = content.replace(regexp_braced, newcontent_braced(new_id));
      add_fields($this, assoc, assocs, content, count, regexp_braced, 
		      new_id, new_content);
    }
  });


  /* Complete event click on .add_fields once we know new_id */
  function add_fields($this, assoc, assocs, content, count, regexp_braced, 
		  new_id, new_content)  {
    var insertionMethod       = $this.data('association-insertion-method') || $this.data('association-insertion-position') || 'before',
        insertionNode         = $this.data('association-insertion-node'),
        insertionTraversal    = $this.data('association-insertion-traversal'),
        regexp_underscord     = new RegExp('_new_' + assoc + '_(\\w*)', 'g'),
        new_contents          = [];

    if (new_content == content) {
      regexp_braced     = new RegExp('\\[new_' + assocs + '\\](.*?\\s)', 'g');
      regexp_underscord = new RegExp('_new_' + assocs + '_(\\w*)', 'g');
      new_content       = content.replace(regexp_braced, newcontent_braced(new_id));
    }

    new_content = new_content.replace(regexp_underscord, newcontent_underscord(new_id));
    new_contents = [new_content];

    count -= 1;

    while (count) {
      new_id      = create_new_id();
      new_content = content.replace(regexp_braced, newcontent_braced(new_id));
      new_content = new_content.replace(regexp_underscord, newcontent_underscord(new_id));
      new_contents.push(new_content);

      count -= 1;
    }

    var insertionNodeElem = getInsertionNodeElem(insertionNode, insertionTraversal, $this)

    if( !insertionNodeElem || (insertionNodeElem.length == 0) ){
      console.warn("Couldn't find the element to insert the template. Make sure your `data-association-insertion-*` on `link_to_add_association` is correct.")
    }

    $.each(new_contents, function(i, node) {
      var contentNode = $(node);

      var before_insert = jQuery.Event('cocoon:before-insert');
      insertionNodeElem.trigger(before_insert, [contentNode]);

      if (!before_insert.isDefaultPrevented()) {
        // allow any of the jquery dom manipulation methods (after, before, append, prepend, etc)
        // to be called on the node.  allows the insertion node to be the parent of the inserted
        // code and doesn't force it to be a sibling like after/before does. default: 'before'
        var addedContent = insertionNodeElem[insertionMethod](contentNode);

        insertionNodeElem.trigger('cocoon:after-insert', [contentNode]);
      }
    });
  }


  $(document).on('click', '.remove_fields.dynamic, .remove_fields.existing', function(e) {
    var $this = $(this),
        wrapper_class = $this.data('wrapper-class') || 'nested-fields',
        node_to_delete = $this.closest('.' + wrapper_class),
        trigger_node = node_to_delete.parent();

    e.preventDefault();

    var before_remove = jQuery.Event('cocoon:before-remove');
    trigger_node.trigger(before_remove, [node_to_delete]);

    if (!before_remove.isDefaultPrevented()) {
      var timeout = trigger_node.data('remove-timeout') || 0;

      setTimeout(function() {
        if ($this.hasClass('dynamic')) {
            node_to_delete.detach();
        } else {
            $this.prev("input[type=hidden]").val("1");
            node_to_delete.hide();
        }
        trigger_node.trigger('cocoon:after-remove', [node_to_delete]);
      }, timeout);
    }
  });


  $(document).on("ready page:load turbolinks:load", function() {
    $('.remove_fields.existing.destroyed').each(function(i, obj) {
      var $this = $(this),
          wrapper_class = $this.data('wrapper-class') || 'nested-fields';

      $this.closest('.' + wrapper_class).hide();
    });
  });

})(jQuery);


(function() {
  this.busca_campo_similar = function(idactual, tipoactual, tipobuscado) {
    var idb;
    idb = idactual.replace('id_' + tipoactual, 'id_' + tipobuscado);
    if (idb !== idactual && $('#' + idb).length > 0) {
      return idb;
    }
    idb = idactual.replace(tipoactual + '_id', tipobuscado + '_id');
    if (idb !== idactual && $('#' + idb).length > 0) {
      return idb;
    }
    idb = idactual.replace('_' + tipoactual, '_' + tipobuscado);
    if (idb !== idactual && $('#' + idb).length > 0) {
      return idb;
    }
    return "";
  };

  this.pone_coord = function(root, tabla, id, nomcampo) {
    var idlat, idlon, lat, lon, modelo, y;
    switch (tabla) {
      case 'pais':
        modelo = 'paises';
        break;
      case 'departamento':
        modelo = 'departamentos';
        break;
      case 'municipio':
        modelo = 'municipios';
        break;
      case 'centropoblado':
        modelo = 'centrospoblados';
        break;
      default:
        return;
    }
    idlat = nomcampo.replace(tabla + '_id', 'latitud');
    lat = $('#' + idlat);
    idlon = nomcampo.replace(tabla + '_id', 'longitud');
    lon = $('#' + idlon);
    if (idlat !== nomcampo && idlon !== nomcampo && lat.length > 0 && lon.length > 0) {
      y = $.getJSON(root.puntomontaje + "admin/" + modelo + "/" + id + ".json", {
        id: id
      });
      y.done(function(data) {
        var nla, nlo;
        if (data.length > 0) {
          data = data.pop();
        }
        if (+data.latitud !== 0) {
          nla = +data.latitud + Math.random() / 1000 - 0.0005;
          lat.val(nla);
        }
        if (+data.longitud !== 0) {
          nlo = +data.longitud + Math.random() / 1000 - 0.0005;
          return lon.val(nlo);
        }
      });
      return y.fail(function(m1, m2, m3) {
        if (m1.responseText.indexOf("Acceso no autorizado") >= 0) {
          return alert("Se requiere autenticación");
        } else {
          return alert('Problema leyendo ' + tabla + ", id=" + id + ". " + m1 + m2 + m3);
        }
      });
    }
  };

  this.llena_departamento = function($this, root, sincoord) {
    var idcla, iddep, idmun, idpais, pais, x;
    if (sincoord == null) {
      sincoord = false;
    }
    msip_arregla_puntomontaje(root);
    idpais = $this.attr('id');
    iddep = busca_campo_similar(idpais, 'pais', 'departamento');
    idmun = busca_campo_similar(idpais, 'pais', 'municipio');
    idcla = busca_campo_similar(idpais, 'pais', 'centropoblado');
    pais = $this.val();
    if (+pais > 0 && iddep) {
      x = $.getJSON(root.puntomontaje + "admin/departamentos", {
        pais_id: pais
      });
      x.done(function(data) {
        msip_remplaza_opciones_select(iddep, data, true, 'id', 'nombre', true);
        $('#' + iddep).attr('disabled', false);
        $('#' + iddep).trigger('chosen:updated');
        if (idmun) {
          $("#" + idmun + " option[value='']").attr('selected', true);
        }
        if (idmun) {
          $('#' + idmun).attr('disabled', true);
        }
        $('#' + idmun).trigger('chosen:updated');
        if (idcla) {
          $("#" + idcla + " option[value='']").attr('selected', true);
        }
        if (idcla) {
          $('#' + idcla).attr('disabled', true);
        }
        return $('#' + idcla).trigger('chosen:updated');
      });
      x.fail(function(m1, m2, m3) {
        return alert('Problema leyendo Departamentos de ' + pais + ' ' + m1 + ' ', +m2 + ' ' + m3);
      });
      if (sincoord !== true && root.msip_sincoord !== true) {
        return pone_coord(root, 'pais', pais, idpais);
      }
    } else {
      if (iddep) {
        $("#" + iddep).val("");
      }
      if (iddep) {
        $("#" + iddep).attr("disabled", true);
      }
      $('#' + iddep).trigger('chosen:updated');
      if (idmun) {
        $("#" + idmun).val("");
      }
      if (idmun) {
        $("#" + idmun).attr("disabled", true);
      }
      $('#' + idmun).trigger('chosen:updated');
      if (idcla) {
        $("#" + idcla).val("");
      }
      if (idcla) {
        $("#" + idcla).attr("disabled", true);
      }
      return $('#' + idcla).trigger('chosen:updated');
    }
  };

  this.llena_municipio = function($this, root, sincoord) {
    var dep, idcla, iddep, idmun, idpais, x;
    if (sincoord == null) {
      sincoord = false;
    }
    msip_arregla_puntomontaje(root);
    iddep = $this.attr('id');
    idpais = busca_campo_similar(iddep, 'departamento', 'pais');
    idmun = busca_campo_similar(iddep, 'departamento', 'municipio');
    idcla = busca_campo_similar(iddep, 'departamento', 'centropoblado');
    dep = $this.val();
    if (+dep > 0 && idmun !== '') {
      x = $.getJSON(root.puntomontaje + "admin/municipios", {
        departamento_id: dep
      });
      x.done(function(data) {
        msip_remplaza_opciones_select(idmun, data, true, 'id', 'nombre', true);
        if (idmun) {
          $("#" + idmun).attr("disabled", false);
        }
        $('#' + idmun).trigger('chosen:updated');
        if (idcla) {
          $("#" + idcla + " option[value='']").attr('selected', true);
        }
        if (idcla) {
          $("#" + idcla).attr("disabled", true);
        }
        return $('#' + idcla).trigger('chosen:updated');
      });
      x.fail(function(m1, m2, m3) {
        return alert('Problema leyendo Municipios de ' + dep + ' ' + m1 + ' ', +m2 + ' ' + m3);
      });
      if (sincoord !== true && root.msip_sincoord !== true) {
        return pone_coord(root, 'departamento', dep, iddep);
      }
    } else {
      if (idmun) {
        $("#" + idmun).val("");
      }
      if (idmun) {
        $("#" + idmun).attr("disabled", true);
      }
      $('#' + idmun).trigger('chosen:updated');
      if (idcla) {
        $("#" + idcla).val("");
      }
      if (idcla) {
        $("#" + idcla).attr("disabled", true);
      }
      return $('#' + idcla).trigger('chosen:updated');
    }
  };

  this.llena_centropoblado = function($this, root, sincoord) {
    var idcla, iddep, idmun, idpais, msip_arregla_puntomontaje, mun, x;
    if (sincoord == null) {
      sincoord = false;
    }
    msip_arregla_puntomontaje = root;
    idmun = $this.attr('id');
    idpais = busca_campo_similar(idmun, 'municipio', 'pais');
    iddep = busca_campo_similar(idmun, 'municipio', 'departamento');
    idcla = busca_campo_similar(idmun, 'municipio', 'centropoblado');
    mun = $this.val();
    if (+mun > 0 && idcla !== '') {
      x = $.getJSON(root.puntomontaje + "admin/centrospoblados", {
        municipio_id: mun
      });
      x.done(function(data) {
        msip_remplaza_opciones_select(idcla, data, true, 'id', 'nombre', true);
        if (idcla) {
          $("#" + idcla).attr("disabled", false);
        }
        return $('#' + idcla).trigger('chosen:updated');
      });
      x.fail(function(m1, m2, m3) {
        return alert('Problema leyendo Centropoblado ' + x + m1 + m2 + m3);
      });
      if (sincoord !== true && root.msip_sincoord !== true) {
        return pone_coord(root, 'municipio', mun, idmun);
      }
    } else if (idcla !== '') {
      if (idcla) {
        $("#" + idcla + " option[value='']").attr('selected', true);
      }
      if (idcla) {
        $("#" + idcla).attr("disabled", true);
      }
      return $('#' + idcla).trigger('chosen:updated');
    }
  };

  this.pone_tipourbano = function($this) {
    var cla, idcla, idts;
    idcla = $this.attr('id');
    idts = busca_campo_similar(idcla, 'centropoblado', 'tsitio');
    cla = $this.val();
    if (+cla > 0 && idcla !== '') {
      return $("#" + idts + " option[value='2']").prop('selected', true);
    }
  };

}).call(this);

// Cambia id de los campoubi relacionados con el control de ubicacionpre
// expandible en 2 filas, que tengan id 0.
function msip_ubicacionpre_expandible_cambia_ids(campoubi, cocoonid) {
  control = $('#ubicacionpre-' + campoubi + '-0').parent()
  control.find('#ubicacionpre-' + campoubi + '-0').attr('id', 
    'ubicacionpre-' + campoubi + '-'+ cocoonid)
  control.find('#resto-' + campoubi + '-0').attr('id', 
    'resto-' + campoubi + '-'+ cocoonid)
  control.find('#restocp-' + campoubi + '-0').attr('id', 
    'restocp-' + campoubi + '-'+ cocoonid)
  b = control.find('button[data-bs-target$=' + campoubi + '-0]')
  console.log(b.attr('data-bs-target'))
  b.attr('data-bs-target', 
    '#resto-' + campoubi + '-' + cocoonid + ',#restocp-' + campoubi + '-' + 
    cocoonid)
}


function msip_ubicacionpre_expandible_maneja_evento_busca_lugar(e) {
  root = window
  ubicacionpre = $(this).closest('.ubicacionpre')
  if (ubicacionpre.length != 1) {
    alert('No se encontró ubicacionpre para ' + 
      $(this).attr('id'))
  }

  epais = ubicacionpre.find('[id$=pais_id]')
  pais = +epais.val()
  dep = +ubicacionpre.find('[id$=departamento_id]').val()
  mun = +ubicacionpre.find('[id$=municipio_id]').val()
  clas = +ubicacionpre.find('[id$=centropoblado_id]').val()
  ubi = [pais, dep, mun, clas]
  msip_ubicacionpre_expandible_busca_lugar($(this), ubi)
}


function msip_ubicacionpre_expandible_busca_lugar(s, ubi) {
  root = window
  msip_arregla_puntomontaje(root)
  cnom = s.attr('id')
  v = $("#" + cnom).data('autocompleta')
  if (v != 1 && v != "no"){
    $("#" + cnom).data('autocompleta', 1)
    // Buscamos un div con clase div_ubicacionpre dentro del cual
    // están tanto el campo ubicacionpre_id como el campo
    // ubicacionpre_texto 
    ubipre = s.closest('.div_ubicacionpre')
    if (typeof ubipre == 'undefined'){
      alert('No se ubico .div_ubicacionpre')
      return
    }
    if ($(ubipre).find("[id$='ubicacionpre_id']").length != 1) {
      alert('Dentro de .div_ubicacionpre no se ubicó ubicacionpre_id')
      return
    }
    if ($(ubipre).find("[id$='_lugar']").length != 1) {
      alert('Dentro de .div_ubicacionpre no se ubicó _lugar')
      return
    }
    var campo = document.querySelector("#" + cnom)
    // Cada vez que llegue quitar eventlistener si ya fue inicializado
    var n = new AutocompletaAjaxCampotexto(campo, root.puntomontaje + 
      "ubicacionespre_lugar.json" + '?pais=' + ubi[0] + 
      '&dep=' + ubi[1] + '&mun=' + ubi[2] + '&clas=' + ubi[3] + '&', 
      'fuente-lugar', function (event, nomop, idop, otrosop) { 
        msip_ubicacionpre_expandible_autocompleta_lugar(otrosop['centropoblado_id'],
          otrosop['tsitio_id'], otrosop['lugar'], 
          otrosop['sitio'], otrosop['latitud'], otrosop['longitud'], 
          ubipre, window)
        event.stopPropagation()
        event.preventDefault()
      }.bind(n)
    )
    n.iniciar()
  }
  return
}

function msip_ubicacionpre_expandible_autocompleta_lugar(centropoblado_id, tsit, lug, sit, lat, lon, ubipre, root){
  msip_arregla_puntomontaje(root)
  ubipre.parent().find('[id$=_centropoblado_id]').val(centropoblado_id).trigger('chosen:updated')
  ubipre.find('[id$=_lugar]').val(lug)
  ubipre.find('[id$=_sitio]').val(sit)
  if (lat != 0 && lat != null){
  ubipre.find('[id$=_latitud]').val(lat)
  }
  if (lon != 0 && lon != null){
  ubipre.find('[id$=_longitud]').val(lon)
  }
  if (tsit != null){
    ubipre.find('[id$=_tsitio_id]').val(tsit).trigger('chosen:updated')
  }
  $(document).trigger("msip:autocompletada-ubicacionpre")
  return
}


function deshabilita_otros_sinohaymun(e, campoubi){
  ubp = $(e.target).closest('.ubicacionpre')
  lugar = ubp.find('[id$='+campoubi+'_lugar]')
  sitio = ubp.find('[id$='+campoubi+'_sitio]')
  tsitio = ubp.find('[id$='+campoubi+'_tsitio_id]')
  latitud = ubp.find('[id$='+campoubi+'_latitud]')
  longitud = ubp.find('[id$='+campoubi+'_longitud]')
  lugar.val("")
  lugar.attr('disabled', true).trigger('chosen:updated')
  sitio.val(null)
  sitio.attr('disabled', true).trigger('chosen:updated')
  tsitio.val(3)
  tsitio.attr('disabled', true).trigger('chosen:updated')
  latitud.val("")
  latitud.attr('disabled', true).trigger('chosen:updated')
  longitud.val("")
  longitud.attr('disabled', true).trigger('chosen:updated')
}

function habilita_otros_sihaymun(e, tipo, campoubi){
  ubp = $(e.target).closest('.ubicacionpre')
  lugar = ubp.find('[id$='+campoubi+'_lugar]')
  sitio = ubp.find('[id$='+campoubi+'_sitio]')
  tsitio = ubp.find('[id$='+campoubi+'_tsitio_id]')
  latitud = ubp.find('[id$='+campoubi+'_latitud]')
  longitud = ubp.find('[id$='+campoubi+'_longitud]')
  if(tipo == 1){
    lugar.attr('disabled', false).trigger('chosen:updated')
    tsitio.attr('disabled', false).trigger('chosen:updated')
  }
  if(tipo == 2){
    sitio.attr('disabled', false).trigger('chosen:updated')
    latitud.attr('disabled', false).trigger('chosen:updated')
    longitud.attr('disabled', false).trigger('chosen:updated')
  }
}


function msip_ubicacionpre_fija_coordenadas(e, campoubi, elemento, ubi_plural){
  ubp = $(e.target).closest('.ubicacionpre')
  latitud = ubp.find('[id$='+campoubi+'_latitud]')
  longitud = ubp.find('[id$='+campoubi+'_longitud]')

  id = Number.parseInt($(elemento).val(), 10) // evita eventual XSS
  root = window
  $.getJSON(root.puntomontaje + "admin/" + ubi_plural +".json", function(o){
    ubi = o.filter(function(item){
      return item.id == id
    })
    if(ubi[0]){
      if(ubi[0].latitud){
        latitud.val(ubi[0].latitud).trigger('chosen:updated')
        longitud.val(ubi[0].longitud).trigger('chosen:updated')
      }
    }else{
      latitud.val(null).trigger('chosen:updated')
      longitud.val(null).trigger('chosen:updated')
    }
  });
}


// iniid Inicio de identificacion por ejemplo 'caso_migracion_attributes'
// campoubi Identificación particular del que se registra por ejemplo 'salida'
//    (teniendo en cuenta que haya campos para el mismo, por ejemplo
//    uno terminado en salida_lugar).
// root Raiz
// fcamdep Función opcional por llamar cuando cambie el departamento
// fcammun Función opcional por llamar cuando cambie el municipio
function msip_ubicacionpre_expandible_registra(iniid, campoubi, root, 
  fcamdep = null, fcammun = null) {
  msip_arregla_puntomontaje(root)

  // Buscador en campo lugar
  $(document).on('focusin', 
    'input[id^=' + iniid + '][id$=_' + campoubi + '_lugar]', 
    msip_ubicacionpre_expandible_maneja_evento_busca_lugar
  )

  // Cambia coordenadas al cambiar pais
  $(document).on('change', 
    '[id^=' + iniid + '][id$=' + campoubi + '_pais_id]', function (evento) {
      msip_ubicacionpre_fija_coordenadas(evento, campoubi, $(this), "paises")
      deshabilita_otros_sinohaymun(evento, campoubi)
    }
  )

  // Cambia coordenadas y deshabilita otros campos al cambiar departamento
  $(document).on('change', 
    '[id^=' + iniid + '][id$=' + campoubi + '_departamento_id]', 
    function (evento) {
      if($(this).val() == "") {
        ubp = $(evento.target).closest('.ubicacionpre')
        let epais = ubp.find('[id$='+campoubi+'_pais_id]')
        msip_ubicacionpre_fija_coordenadas(evento, campoubi, epais, "paises")
      } else {
        msip_ubicacionpre_fija_coordenadas(evento, campoubi, $(this), "departamentos")
      }
      deshabilita_otros_sinohaymun(evento, campoubi)
      if (fcamdep) {
        fcamdep()
      }
    })

  // Cambia coordenadas y habilita otros campos al cambiar municipio
  $(document).on('change', 
    '[id^=' + iniid + '][id$=' + campoubi + '_municipio_id]', 
    function (evento) {
      if($(this).val() == '') {
        ubp = $(evento.target).closest('.ubicacionpre')
        dep = ubp.find('[id$='+campoubi+'_departamento_id]')
        msip_ubicacionpre_fija_coordenadas(evento, campoubi, dep, "departamentos")
        deshabilita_otros_sinohaymun(evento, campoubi)
      }else{
        msip_ubicacionpre_fija_coordenadas(evento, campoubi, $(this), "municipios")
        habilita_otros_sihaymun(evento, 1, campoubi)
      }
      if (fcammun) {
        fcammun()
      }
    })

  // Cambia coordenadas y habilita otros campos al cambiar centro poblado
  $(document).on('change', 
    '[id^=' + iniid + '][id$=' + campoubi + '_centropoblado_id]', 
    function (evento) {
      if($(this).val()==""){
        ubp = $(evento.target).closest('.ubicacionpre')
        mun = ubp.find('[id$='+campoubi+'_municipio_id]')
        msip_ubicacionpre_fija_coordenadas(evento, campoubi, mun, "municipios")
      }else{
        msip_ubicacionpre_fija_coordenadas(evento, campoubi, $(this), "centrospoblados")
      }
      habilita_otros_sihaymun(evento, 1, campoubi)
    })

  // Habilita otros campos al cambiar lugar
  $(document).on('change', 
    '[id^=' + iniid + '][id$=' + campoubi + '_lugar]', 
    function (evento) {
      habilita_otros_sihaymun(evento, 2, campoubi)
    }
  )

}
;
'use strict';

// Motor con funciones en Javascript ES5 puro (sin CoffeeScript y sin jQuery)
// Capitalización Camello. Comienzan con Msip sigue Verbo en infinitivo y más.


/* Retorna partes de una fecha localizada
 * @param fechaLocalizada
 * @param formato
 **/

/* Serializa valores de un formulario en un arreglo
 * Idea de serializeArray de jQuery, implemantación basada en
 * https://vanillajstoolkit.com/helpers/serializearray/
 * FormData debería dejar esto obsoleto
 **/
function MsipSerializarFormularioEnArreglo(formulario) {
  var arr = [];
  Array.prototype.slice.call(formulario.elements).forEach(function (campo) {
    if (!campo.name || campo.disabled || 
      ['file', 'reset', 'submit', 'button'].indexOf(campo.type) > -1) return;
    if (campo.type === 'select-multiple') {
      Array.prototype.slice.call(campo.options).forEach(function (opcion) {
        if (!opcion.selected) return;
        arr.push({
          name: campo.name,
          value: opcion.value
        });
      });
      return;
    }
    if (['checkbox', 'radio'].indexOf(campo.type) >-1 && !campo.checked) return;
    arr.push({
      name: campo.name,
      value: campo.value
    });
  });
  return arr;
};



/* Convierte arreglo (como el producido por MsipSerializarFormularioEnArreglo)
 * en una cadena apta para enviar consulta.
 * Con base en jQuery.param
 * https://github.com/jquery/jquery-dist/blob/main/src/serialize.js
 */
function MsipConvertirArregloAParam(a) {
  if ( a == null || !Array.isArray( a ) ) {
    return "";
  }

  s = [];
  for(var i = 0; i < a.length; i++) {
    s[ s.length ] = encodeURIComponent( a[i].name ) + "=" +
      encodeURIComponent( a[i].value == null ? "" : a[i].value );

  }

  // Retorna serialización resultante
  return s.join( "&" );
};


/** Enviar AJAX
 * @param url Url
 * @param datos Cuerpo
 */
function MsipEnviarAjax(url, datos, metodo='GET', tipo='script', 
  alertaerror=true) {
  var root =  window
  var t = Date.now()
  var d = -1
  if (root.MsipEnviarAjaxTestigo) {
    d = (t - root.MsipEnviarAjaxTestigo)/1000
  }
  root.MsipEnviarAjaxTestigo = t
  if (d == -1 || d > 2) {
    var enc = {}
    if (document.querySelector('meta[name="csrf-token"]') != null) {
      enc['X-CSRF-Token'] = document.
        querySelector('meta[name="csrf-token"]').getAttribute('content')
    }
    if (tipo == 'script') {
      // https://stackoverflow.com/questions/44803944/can-i-run-a-js-script-from-another-using-fetch
      const promesaScript = new Promise((resolve, reject) => {
          const script = document.createElement('script');
          document.body.appendChild(script);
          script.onload = resolve;
          script.onerror = reject;
          script.async = true;
          script.src = url;
      });

      promesaScript
        .then(resultado => {
          console.log('Éxito:', resultado);
        })
        .catch(error => {
          console.error('Error:', error);
          if (alertaerror) {
            alert('Error: el servicio respondió: ' + error)
          }
        });

    } else {
      if (tipo == 'json') {
        enc['Content-Type'] = 'application/json'
      } else if (tipo == 'texto') {
        enc['Content-Type'] = 'text/plain'
      } else if (tipo == 'html') {
        enc['Content-Type'] = 'text/html'
      } else {
        alert('Tipo desconocido: ' + tipo)
        return;
      }

      fetch(url, {
        method: metodo,
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin', // include, *same-origin, omit
        headers: enc,
        redirect: 'follow', // manual, *follow, error
        referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        body: datos
      })
        .then(respuesta => respuesta.json())
        .then(resultado => {
          console.log('Éxito:', resultado);
        })
        .catch(error => {
          console.error('Error:', error);
          if (alertaerror) {
            alert('Error: el servicio respondió: ' + error)
          }
        });
    }
  }
  return
  }


/** Envia datos de un formulario empleando AJAX
 * @param f Formulario
 */
function MsipEnviarFormularioAjax(f, metodo='GET', tipo='script', 
  alertaerror=true, vcommit='Enviar', agenviarautom = true) {

  var a = f.getAttribute('action')
  const datosFormulario = new FormData(f);
  datosFormulario.append('commit', vcommit)
  if (agenviarautom) {
    datosFormulario.push('_msip_enviarautomatico', 1)
  }
  MsipEnviarAjax(a, datosFormulario, metodo, tipo, alertaerror)
}

function MsipCalcularCambiosParaBitacora() {
  let bitacora = document.querySelector("input.bitacora_cambio");
  if (bitacora == null) {
    return { vacio: false };
  }
  window.bitacora_estado_final_formulario = MsipSerializarFormularioEnArreglo(
    bitacora.closest("form")
  );
  if (typeof window.bitacora_estado_inicial_formulario != "object") {
    return { vacio: false };
  }
  let cambio = {};
  let di = {};
  window.bitacora_estado_inicial_formulario.forEach(
    (v) => di[v.name] = v.value
  );
  let df = {};
  window.bitacora_estado_final_formulario.forEach((v) => {
    df[v.name] = v.value;
    if (typeof di[v.name] == "undefined") {
      cambio[v.name] = [null, v.value];
    }
  });
  for (const i in di) {
    if (typeof df[i] == "undefined") {
      cambio[i] = [di[i], null];
    } else if (df[i] != di[i] && i.search(/\[bitacora_cambio\]/) < 0) {
      cambio[i] = [di[i], df[i]];
    }
  }
  return cambio;
}


/*
 * Con AJAX actualiza formulario, espera recibir formulario guardado
 * para repintar áreas identificadas con listaIdsRepintar y llamar
 * la retrollamada.
 *
 * Se espera que en rails la función update, maneje PATCH y request.xhr?
 * para no ir a hacer redirect_to con lo proveniente de un XHR 
 * (ver ejemplo en lib/sip/concerns/controllers/modelos_controller.rb)
 *
 * @param listaIdsRepintar Lista de ids de elementos por repintar
 *   Si hay uno llamado errores no vacio después de pintar detiene
 *   con mensaje de error.
 * @param retrollamada_exito Función por llamar en caso de éxito
 * @parama argumentos_exito Por pasar a la función retrollamada_exito (se 
 * sugiere que sea un registro).
 * @param retrollamada_falla Función por llamar en caso de falla
 * @parama argumentos_falla Por pasar a la función retrollamada_falla (se 
 *  sugiere que sea un registro).
 */
function MsipGuardarFormularioYRepintar(listaIdsRepintar, retrollamada_exito, 
  argumentos_exito, retrollamada_falla = null, argumentos_falla = null) {
  if (document.body.style.cursor == 'wait') {
    alert('Hay un procedimiento en curso, por favor espere a que termine')
    return
  }
  document.body.style.cursor = 'wait'
  let formulario = document.querySelector('form')
  if (formulario == null) {
    document.body.style.cursor = 'default'
    alert('** MsipGuardarFormularioYRepintar: No se encontró formulario')
    if (retrollamada_falla != null) {
      retrollamada_falla(argumentos_falla)
    }
    return
  }
  let datos = new FormData(formulario);
  datos.set('commit', 'Enviar')
  datos.set('siguiente', 'editar')
  datos.set('_msip_enviarautomatico_y_repinta', 'editar')
  let paramUrl = new URLSearchParams(datos).toString()
  document.getElementById('errores').innerText=''
  window.Rails.ajax({
    type: 'PATCH',
    url: formulario.getAttribute('action'),
    data: datos,
    dataType: 'html',
    success: (resp, estado, xhr) => {
      document.body.style.cursor = 'default'
      let hayErrores = false
      listaIdsRepintar.forEach((idfrag) => {
        let f = document.getElementById(idfrag)
        let nf = resp.getElementById(idfrag)
        if (nf) {
          f.innerHTML = nf.innerHTML
          if (idfrag === 'errores' && nf.innerHTML.trim() !== '') {
            hayErrores = true
          }
        }
      })
      if (hayErrores) {
        document.body.style.cursor = 'default'
        alert('Revise los errores de validación, resuelvalos y vuelva a intentar')
        if (retrollamada_falla != null) {
          retrollamada_falla(argumentos_falla)
        }
        return
      }
      retrollamada_exito(argumentos_exito)
    },
    error: (req, estado, xhr) => {
      document.body.style.cursor = 'default'
      window.alert('No se pudo guardar formulario.')
      if (retrollamada_falla != null) {
        retrollamada_falla(argumentos_falla);
      }
      return
    }
  })
}

function MsipIniciar() {

  MsipAutocompletaAjaxContactos.iniciar()
  MsipAutocompletaAjaxFamiliares.iniciar()

}

// MACHETE PARA MEDIO SOPORTAR PAQUETES ESTILO COMMONJS EN NAVEGADOR
// REQUIRE CAMBIAR USOS QUE SE HACIAN DE root = exports PARA QUE SEAN root =
// window
exports = {}
module = { exports: exports}
;
Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var MsipAutocompletaAjaxContactos = (function () {
  function MsipAutocompletaAjaxContactos() {
    _classCallCheck(this, MsipAutocompletaAjaxContactos);
  }

  // Queriamos hacer dentro de MsipAutocompletaAjaxConactos static
  // claseEnvoltura = 'campos_persona' pero la versión de bable usada por babel-transpiler, usado por sprockets4 no lo soporta así que:
  _createClass(MsipAutocompletaAjaxContactos, null, [{
    key: 'operarElegida',

    /* No usamos constructor ni this porque en operaElegida sería
     * del objeto AutocompletaAjaxExpreg y no esta clase.
     * Más bien en esta todo static
     */

    // Elije una persona en autocompletación
    value: function operarElegida(eorig, cadpersona, id, otrosop) {
      var root = window;
      msip_arregla_puntomontaje(root);
      var cs = id.split(';');
      var idPersona = cs[0];
      if ([].concat(_toConsumableArray(document.querySelector('#orgsocial_persona').querySelectorAll('[id$=_attributes_id]'))).filter(function (e) {
        return e.value == idPersona;
      }).length > 0) {
        window.alert("La misma persona ya está en el listado de contactos");
        return;
      }
      var d = '&persona_id=' + idPersona;
      d += '&ac_orgsocial_persona=true';
      var a = root.puntomontaje + 'personas/datos';

      window.Rails.ajax({
        type: 'GET',
        url: a,
        data: d,
        success: function success(resp, estado, xhr) {
          var divcp = eorig.target.closest('.' + MsipAutocompletaAjaxContactos.claseEnvoltura);
          if (divcp == null) {
            alert('No se encontró elmento con clase ' + MsipAutocompletaAjaxContactos.claseEnvoltura);
          }
          divcp.querySelector('[id$=_attributes_id]').value = resp.id;
          divcp.querySelector('[id$=_attributes_nombres]').value = resp.nombres;
          divcp.querySelector('[id$=_attributes_apellidos]').value = resp.apellidos;
          divcp.querySelector('[id$=_attributes_sexo]').value = resp.sexo;
          var tdocid = divcp.querySelector('[id$=_attributes_tdocumento_id]');
          if (tdocid != null) {
            var idop = null;
            tdocid.childNodes.forEach(function (o) {
              if (typeof o.innerText === 'string' && o.innerText === resp.tdocumento) {
                idop = o.value;
              }
            });
            if (idop != null) {
              tdocid.value = idop;
            }
          }
          var numdoc = divcp.querySelector('[id$=_numerodocumento]');
          if (numdoc != null) {
            numdoc.value = resp.numerodocumento;
          }
          var anionac = divcp.querySelector('[id$=_anionac]');
          if (anionac != null) {
            anionac.value = resp.anionac;
          }
          var mesnac = divcp.querySelector('[id$=_mesnac]');
          if (mesnac != null) {
            mesnac.value = resp.mesnac;
          }
          var dianac = divcp.querySelector('[id$=_dianac]');
          if (dianac != null) {
            dianac.value = resp.dianac;
          }
          var cargo = divcp.querySelector('[id$=_cargo]');
          if (cargo != null && typeof resp.cargo != 'undefined') {
            cargo.value = resp.cargo;
          }
          var correo = divcp.querySelector('[id$=_correo]');
          if (correo != null && typeof resp.correo != 'undefined') {
            correo.value = resp.correo;
          }
          eorig.target.setAttribute('data-autocompleta', 'no');
          eorig.target.removeAttribute('list');
          var sel = document.getElementById(MsipAutocompletaAjaxContactos.idDatalist);
          sel.innerHTML = '';
          document.dispatchEvent(new Event('msip:autocompletado-contacto'));
        },
        error: function error(resp, estado, xhr) {
          window.alert('Error con ajax ' + resp);
        }
      });
    }
  }, {
    key: 'iniciar',
    value: function iniciar() {
      console.log("MsipAutocompletaAjaxContactos msip");
      var url = window.puntomontaje + 'personas.json';
      var contactos = new window.AutocompletaAjaxExpreg([/^orgsocial_orgsocial_persona_attributes_[0-9]*_persona_attributes_nombres$/], url, MsipAutocompletaAjaxContactos.idDatalist, MsipAutocompletaAjaxContactos.operarElegida);
      contactos.iniciar();
    }
  }]);

  return MsipAutocompletaAjaxContactos;
})();

exports['default'] = MsipAutocompletaAjaxContactos;
MsipAutocompletaAjaxContactos.claseEnvoltura = 'campos_persona';
MsipAutocompletaAjaxContactos.idDatalist = 'fuente-contactos-orgsocial';
module.exports = exports['default'];
Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var MsipAutocompletaAjaxFamiliares = (function () {
  function MsipAutocompletaAjaxFamiliares() {
    _classCallCheck(this, MsipAutocompletaAjaxFamiliares);
  }

  // Sobrellevamos imposibilidad de hacer static claseEnvoltura y
  // static idDatalist dentro de la clase MsipAutocompletaAjaxFamiliares asi:
  _createClass(MsipAutocompletaAjaxFamiliares, null, [{
    key: 'operarElegida',

    /* No usamos constructor ni this porque en operaElegida sería
     * del objeto AutocompletaAjaxExpreg y no esta clase.
     * Más bien en esta todo static
     */

    // Elije una persona en autocompletación
    value: function operarElegida(eorig, cadpersona, id, otrosop) {
      var root = window;
      msip_arregla_puntomontaje(root);
      var cs = id.split(';');
      var idPersona = cs[0];
      var divcpf = eorig.target.closest('.' + MsipAutocompletaAjaxFamiliares.claseEnvoltura);
      divcpf.querySelector('.persona_persona_trelacion1_personados_id > input').value = idPersona;
      divcpf.querySelector('.persona_persona_trelacion1_personados_nombres > input').value = "";
      divcpf.querySelector('.persona_persona_trelacion1_personados_apellidos > input').value = "";
      divcpf.querySelector('input[value=Actualizar]').click();
    }
  }, {
    key: 'iniciar',
    value: function iniciar() {
      console.log("MsipAutocompletaAjaxFamiliares");
      var url = window.puntomontaje + 'personas.json';
      var asistentes = new window.AutocompletaAjaxExpreg([/^persona_persona_trelacion1_attributes_[0-9]*_personados_attributes_nombres$/], url, MsipAutocompletaAjaxFamiliares.idDatalist, MsipAutocompletaAjaxFamiliares.operarElegida);
      asistentes.iniciar();
    }
  }]);

  return MsipAutocompletaAjaxFamiliares;
})();

exports['default'] = MsipAutocompletaAjaxFamiliares;
MsipAutocompletaAjaxFamiliares.claseEnvoltura = 'nested-fields';
MsipAutocompletaAjaxFamiliares.idDatalist = 'fuente-familiares';
module.exports = exports['default'];
(function() {
  this.msip_remplaza_opciones_select = function(idsel, nuevasop, usachosen, cid, cetiqueta, opvacia) {
    var nh, s, sel;
    if (usachosen == null) {
      usachosen = false;
    }
    if (cid == null) {
      cid = 'id';
    }
    if (cetiqueta == null) {
      cetiqueta = 'nombre';
    }
    if (opvacia == null) {
      opvacia = false;
    }
    s = $("#" + idsel);
    if (s.length !== 1) {
      alert('msip_remplaza_opciones_select: no se encontró ' + idsel);
      return;
    }
    sel = s.val();
    nh = '';
    if (opvacia) {
      nh = "<option value=''></option>";
    }
    nuevasop.forEach(function(v) {
      var id, tx;
      id = v[cid];
      nh = nh + "<option value='" + id + "'";
      if (id !== '' && sel !== null && (('' + id) === ('' + sel) || sel.indexOf('' + id) >= 0)) {
        nh = nh + ' selected';
      }
      tx = v[cetiqueta];
      return nh = nh + ">" + tx + "</option>";
    });
    s.html(nh);
    if (usachosen) {
      $('#' + idsel).trigger("chosen:updated");
    }
  };

  this.msip_escapaHtml = function(cadena) {
    return cadena.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  };

  this.msip_actualiza_cuadros_seleccion_dependientes = function(idfuente, posfijo_id_fuente, posfijo_etiqueta_fuente, seldestino, opvacia) {
    var lobj, nuevasop;
    if (opvacia == null) {
      opvacia = false;
    }
    nuevasop = [];
    lobj = $('#' + idfuente + ' .nested-fields[style!="display: none;"]');
    lobj.each(function(k, v) {
      var etiqueta, id;
      id = $(v).find('input[id$=' + posfijo_id_fuente + ']').val();
      etiqueta = $(v).find('input[id$=' + posfijo_etiqueta_fuente + ']').val();
      return nuevasop.push({
        id: id,
        etiqueta: etiqueta
      });
    });
    seldestino.forEach(function(sel) {
      return $(sel).each(function(i, r) {
        var conch;
        conch = $(r).hasOwnProperty('chosen');
        return msip_remplaza_opciones_select($(r).attr('id'), nuevasop, conch, 'id', 'etiqueta', opvacia);
      });
    });
  };

  this.msip_actualiza_cuadros_seleccion_dependientes_fun_etiqueta = function(idfuente, posfijo_id_fuente, fun_etiqueta, seldestino, opvacia) {
    var lobj, nuevasop;
    if (opvacia == null) {
      opvacia = false;
    }
    nuevasop = [];
    lobj = $('#' + idfuente + ' .nested-fields[style!="display: none;"]');
    lobj.each(function(k, v) {
      var etiqueta, id;
      id = $(v).find('input[id$=' + posfijo_id_fuente + ']').val();
      etiqueta = fun_etiqueta($(v));
      return nuevasop.push({
        id: id,
        etiqueta: etiqueta
      });
    });
    seldestino.forEach(function(sel) {
      return $(sel).each(function(i, r) {
        var conch;
        conch = $(r).hasOwnProperty('chosen');
        return msip_remplaza_opciones_select($(r).attr('id'), nuevasop, conch, 'id', 'etiqueta', opvacia);
      });
    });
  };

  this.msip_intenta_eliminar_fila = function(fila, prefijo_url, seldep) {
    var bid, d, ide, num, purl, root, t;
    t = Date.now();
    d = -1;
    if (window.ajax_t) {
      d = (t - window.ajax_t) / 1000;
    }
    window.ajax_t = t;
    if (d === -1 || d > 2) {
      bid = fila.find('input[id$=_id]');
      if (bid.length !== 1) {
        return false;
      }
      ide = +$(bid[0]).val();
      if (seldep !== null) {
        num = 0;
        seldep.forEach(function(sel) {
          return $(sel + ' option:selected').each(function() {
            if (+$(this).val() === ide) {
              return num += 1;
            }
          });
        });
        if (num > 0) {
          alert('Hay elementos que depende de este (' + num + '). ' + ' Eliminelos antes.');
          return false;
        }
      }
      root = window;
      purl = prefijo_url;
      if (prefijo_url.substr(0, root.puntomontaje.length) !== root.puntomontaje) {
        purl = root.puntomontaje + prefijo_url;
      }
      $.ajax({
        url: purl + ide,
        type: 'DELETE',
        dataType: 'json',
        beforeSend: (function(xhr) {
          return xhr.setRequestHeader('X-CSRF-Token', $('meta[name="csrf-token"]').attr('content'));
        }),
        success: (function(response) {
          return $(fila).remove();
        }),
        error: (function(response) {
          if (response.status !== 0 && response.responseText !== '') {
            return alert('Error: el servicio respondio con: ' + response.status + '\n' + response.responseText);
          }
        })
      });
    }
    return true;
  };

  if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function(suffix) {
      return this.indexOf(suffix, this.length - suffix.length) !== -1;
    };
  }

  this.msip_meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  this.msip_retorna_fecha_localizada = function(fecha, formato_fecha) {
    var fecha_sep, mes_nom, mes_nom_cap, pc, pcmayus, resto;
    fecha_sep = msip_partes_fecha_localizada(fecha, formato_fecha);
    mes_nom = this.msip_meses[fecha_sep[1] - 1];
    pc = mes_nom.substring(0, 1);
    pcmayus = pc.toUpperCase();
    resto = mes_nom.substring(1);
    mes_nom_cap = pcmayus + resto;
    return fecha_sep[2].toString() + '/' + mes_nom_cap + '/' + fecha_sep[0].toString();
  };

  this.msip_partes_fecha_localizada = function(fecha, formato_fecha) {
    var anio, dia, mes, nmes;
    if (formato_fecha === 'dd/M/yyyy' || formato_fecha === 'dd-M-yyyy') {
      anio = +fecha.slice(7, 11);
      dia = +fecha.slice(0, 2);
      nmes = fecha.slice(3, 6);
      if (typeof nmes !== 'undefined' && this.msip_meses.includes(nmes.toLowerCase())) {
        mes = this.msip_meses.indexOf(nmes.toLowerCase()) + 1;
      } else {
        mes = 6;
      }
    } else if (typeof fecha === 'string') {
      anio = +fecha.slice(0, 4);
      mes = +fecha.slice(5, 7);
      dia = +fecha.slice(8, 10);
    } else {
      anio = 1900;
      mes = 1;
      dia = 1;
    }
    return [anio, mes, dia];
  };

  this.fecha_valida = function(text) {
    var comp, d, date, m, y;
    date = Date.parse(text);
    if (isNaN(date)) {
      return false;
    }
    comp = text.split('-');
    if (comp.length !== 3) {
      return false;
    }
    y = parseInt(comp[0], 10);
    m = parseInt(comp[1], 10);
    d = parseInt(comp[2], 10);
    date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() + 1 === m && date.getDate() === d;
  };

  this.msip_ajax_recibe_json = function(root, ruta, datos, funproc) {
    var d, rutac, t;
    msip_arregla_puntomontaje(root);
    t = Date.now();
    d = -1;
    if (root.msip_ajax_recibe_json_t) {
      if (root.msip_ajax_recibe_json_t[ruta]) {
        d = (t - root.msip_ajax_recibe_json_t[ruta]) / 1000;
      }
    } else {
      root.msip_ajax_recibe_json_t = {};
    }
    root.msip_ajax_recibe_json_t[ruta] = t;
    if (d === -1 || d > 2) {
      rutac = root.puntomontaje + ruta + ".json";
      $.ajax({
        url: rutac,
        data: datos,
        dataType: 'json',
        method: 'GET'
      }).fail(function(jqXHR, texto) {
        return alert('Error - ' + texto);
      }).done(function(e, r) {
        return funproc(root, e);
      });
    }
    return true;
  };

  this.msip_envia_ajax_datos_ruta_y_pinta = function(ruta, datos, selresp, selelem, metodo, tipo, concsrf) {
    var d, root, rutac, t, token;
    if (metodo == null) {
      metodo = 'GET';
    }
    if (tipo == null) {
      tipo = 'html';
    }
    if (concsrf == null) {
      concsrf = false;
    }
    root = window;
    t = Date.now();
    d = -1;
    if (root.msip_envia_ajax_t) {
      d = (t - root.msip_envia_ajax_t) / 1000;
    }
    root.msip_envia_ajax_t = t;
    if (d === -1 || d > 2) {
      msip_arregla_puntomontaje(root);
      token = $('meta[name="csrf-token"]').attr('content');
      rutac = root.puntomontaje + ruta + ".js";
      $.ajax({
        url: rutac,
        data: datos,
        dataType: tipo,
        beforeSend: (function(xhr) {
          if (concsrf) {
            return xhr.setRequestHeader('X-CSRF-Token', token);
          }
        }),
        method: metodo
      }).fail(function(jqXHR, texto) {
        return alert("Error con ajax a " + rutac + ": " + texto);
      }).done(function(e, r) {
        if (selresp !== '' && selelem !== '') {
          t = $(e).find(selresp)[0];
          if (selresp === selelem) {
            $(selelem).replaceWith(t);
          } else {
            $(selelem).html(t);
            $('[data-behaviour~=datepicker]').datepicker({
              format: root.formato_fecha,
              autoclose: true,
              todayHighlight: true,
              language: 'es'
            });
          }
        }
      });
    }
  };

  this.msip_enviarautomatico_formulario_y_repinta = function(idf, listaidsrempl, metodo, alertaerror, vcommit) {
    var a, d, dat, f, root, t, vd;
    if (metodo == null) {
      metodo = 'GET';
    }
    if (alertaerror == null) {
      alertaerror = true;
    }
    if (vcommit == null) {
      vcommit = 'Enviar';
    }
    root = window;
    t = Date.now();
    d = -1;
    if (root.msip_enviarautomatico_t) {
      d = (t - root.msip_enviarautomatico_t) / 1000;
    }
    root.msip_enviarautomatico_t = t;
    f = $('form[id=' + idf + ']');
    root.msip_enviarautomatico_idf = idf;
    root.msip_enviarautomatico_l = listaidsrempl;
    if (f.length === 1 && (d === -1 || d > 2)) {
      a = f.attr('action');
      vd = f.serializeArray();
      vd.push({
        name: 'commit',
        value: vcommit
      });
      vd.push({
        name: '_msip_enviarautomatico',
        value: 1
      });
      vd.push({
        name: '_msip_enviarautomatico_y_repinta',
        value: 1
      });
      dat = $.param(vd);
      if (!root.dant || root.dant !== d) {
        root.dant = d;
        $.ajax({
          url: a,
          data: dat,
          method: metodo,
          dataType: 'html',
          beforeSend: (function(xhr) {
            return xhr.setRequestHeader('X-CSRF-Token', $('meta[name="csrf-token"]').attr('content'));
          }),
          error: (function(response) {
            if (alertaerror && response.status !== 0 && response.responseText !== '') {
              return alert('Error: el servicio respondió: ' + response.status + '\n' + response.responseText);
            }
          }),
          success: (function(e, r, j) {
            var listaidsremp;
            listaidsremp = root.msip_enviarautomatico_l;
            listaidsremp.forEach(function(idf) {
              t = $(e).find('#' + idf)[0];
              return $('#' + idf).html(t.innerHTML);
            });
          })
        });
      }
    }
  };

  this.msip_enviarautomatico_formulario = function(f, metodo, tipo, alertaerror, vcommit, agenviarautom) {
    var a, d, dat, root, t, vd;
    if (metodo == null) {
      metodo = 'GET';
    }
    if (tipo == null) {
      tipo = 'script';
    }
    if (alertaerror == null) {
      alertaerror = true;
    }
    if (vcommit == null) {
      vcommit = 'Enviar';
    }
    if (agenviarautom == null) {
      agenviarautom = true;
    }
    root = window;
    t = Date.now();
    d = -1;
    if (root.msip_enviarautomatico_t) {
      d = (t - root.msip_enviarautomatico_t) / 1000;
    }
    root.msip_enviarautomatico_t = t;
    if (d === -1 || d > 2) {
      a = f.attr('action');
      vd = f.serializeArray();
      vd.push({
        name: 'commit',
        value: vcommit
      });
      if (agenviarautom) {
        vd.push({
          name: '_msip_enviarautomatico',
          value: 1
        });
      }
      dat = $.param(vd);
      if (!root.dant || root.dant !== d) {
        root.dant = d;
        $.ajax({
          url: a,
          data: dat,
          method: metodo,
          dataType: tipo,
          beforeSend: (function(xhr) {
            return xhr.setRequestHeader('X-CSRF-Token', $('meta[name="csrf-token"]').attr('content'));
          }),
          error: (function(response) {
            if (alertaerror && response.status !== 0 && response.responseText !== '') {
              return alert('Error: el servicio respondió: ' + response.status + '\n' + response.responseText);
            }
          }),
          success: (function(response) {
            a = document.querySelectorAll(".tom-select");
            return a.forEach(function(el) {
              if (typeof el.tomselect === 'undefined') {
                return new TomSelect(el, window.configuracionTomSelect);
              }
            });
          })
        });
      }
    }
  };

  this.msip_completa_enlace = function(elema, idruta, rutagenera) {
    var d, e, f, root;
    if (idruta === null) {
      f = $(elema).closest('form');
    } else {
      f = $("form[action$='" + idruta + "']");
    }
    d = f.serialize();
    d += '&commit=Enviar';
    root = window;
    msip_arregla_puntomontaje(root);
    if ((root.puntomontaje !== '/' || rutagenera[0] !== '/') && rutagenera.substring(0, root.puntomontaje.length) !== root.puntomontaje) {
      rutagenera = root.puntomontaje + rutagenera;
    }
    e = rutagenera + '?' + d;
    return $(elema).attr('href', e);
  };

  this.msip_funcion_tras_AJAX = function(rutajson, params, f, descerr, root) {
    var d, t, x;
    if (root == null) {
      root = window;
    }
    msip_arregla_puntomontaje(root);
    t = Date.now();
    d = -1;
    if (root.msip_funcion_tras_AJAX_t) {
      d = (t - root.msip_funcion_tras_AJAX_t) / 1000;
    }
    root.msip_funcion_tras_AJAX_t = t;
    if (d > 0 && d <= 2) {
      return;
    }
    x = $.getJSON(root.puntomontaje + rutajson + ".json", params);
    x.done(function(res) {
      return f(root, res);
    });
    return x.fail(function(m1, m2, m3) {
      return alert('Problema ' + descerr + '. ' + params + ' ' + m1 + ' ' + m2 + ' ' + m3);
    });
  };

  this.msip_funcion_1p_tras_AJAX = function(rutajson, params, f, p1, descerr, root) {
    var d, t, x;
    if (root == null) {
      root = window;
    }
    msip_arregla_puntomontaje(root);
    t = Date.now();
    d = -1;
    if (root.msip_funcion_1p_tras_AJAX_t) {
      d = (t - root.msip_funcion_1p_tras_AJAX_t) / 1000;
    }
    root.msip_funcion_1p_tras_AJAX_t = t;
    if (d > 0 && d <= 1) {
      return;
    }
    x = $.getJSON(root.puntomontaje + rutajson + ".json", params);
    x.done(function(res) {
      return f(root, res, p1);
    });
    return x.fail(function(m1, m2, m3) {
      return alert('Problema ' + descerr + '. ' + params + ' ' + m1 + ' ' + m2 + ' ' + m3);
    });
  };

  this.msip_cambia_cuadrotexto_AJAX = function(rutajson, params, iddest, descerr, f, root) {
    var d, t, x;
    if (f == null) {
      f = null;
    }
    if (root == null) {
      root = window;
    }
    msip_arregla_puntomontaje(root);
    t = Date.now();
    d = -1;
    if (root.msip_cambia_cuadrotexto_AJAX_t) {
      d = (t - root.msip_cambia_cuadrotexto_AJAX_t) / 1000;
    }
    root.msip_cambia_cuadrotexto_AJAX_t = t;
    if (d > 0 && d <= 2) {
      return;
    }
    x = $.getJSON(root.puntomontaje + rutajson + ".json", params);
    x.done(function(datos) {
      $('#' + iddest).val(datos['res']);
      if (f !== null) {
        return f(root);
      }
    });
    return x.fail(function(m1, m2, m3) {
      return alert('Problema ' + descerr + '. ' + params + ' ' + m1 + ' ' + m2 + ' ' + m3);
    });
  };

  this.msip_elige_opcion_select_con_AJAX = function($elem, rutajson, lid, descerr, f, root) {
    var d, t, val, x;
    if (f == null) {
      f = null;
    }
    if (root == null) {
      root = window;
    }
    msip_arregla_puntomontaje(root);
    t = Date.now();
    d = -1;
    if (root.msip_elige_opcion_select_con_AJAX_t) {
      d = (t - root.msip_elige_opcion_select_con_AJAX_t) / 1000;
    }
    root.msip_elige_opcion_select_con_AJAX_t = t;
    if (d > 0 && d <= 2) {
      return;
    }
    val = $elem.val();
    x = $.getJSON(root.puntomontaje + rutajson + ".json");
    x.done(function(datos) {
      lid.forEach(function(p) {
        return $('#' + p[0]).val(datos[p[1]]);
      });
      if (f !== null) {
        return f(root);
      }
    });
    return x.fail(function(m1, m2, m3) {
      return alert('Problema ' + descerr + '. ' + param + ' ' + m1 + ' ' + m2 + ' ' + m3);
    });
  };

  this.msip_llena_select_con_AJAX = function($elem, idsel, rutajson, nomparam, descerr, root, paramfiltro, cid, cnombre, f) {
    var d, param, t, val, x;
    if (root == null) {
      root = window;
    }
    if (paramfiltro == null) {
      paramfiltro = false;
    }
    if (cid == null) {
      cid = 'id';
    }
    if (cnombre == null) {
      cnombre = 'nombre';
    }
    if (f == null) {
      f = null;
    }
    msip_arregla_puntomontaje(root);
    t = Date.now();
    d = -1;
    if (root.msip_llena_select_con_AJAX_t) {
      d = (t - root.msip_llena_select_con_AJAX_t) / 1000;
    }
    root.msip_llena_select_con_AJAX_t = t;
    if (d > 0 && d <= 2) {
      return;
    }
    val = $elem.val();
    param = {};
    param[nomparam] = val;
    if (cnombre === 'presenta_nombre') {
      param['presenta_nombre'] = 1;
    }
    if (paramfiltro) {
      param = {
        filtro: param
      };
    }
    x = $.getJSON(root.puntomontaje + rutajson, param);
    x.done(function(datos) {
      msip_remplaza_opciones_select(idsel, datos, true, cid, cnombre);
      if (f !== null) {
        return f(root);
      }
    });
    return x.fail(function(m1, m2, m3) {
      return alert('Problema ' + descerr + '. ' + param + ' ' + m1 + ' ' + m2 + ' ' + m3);
    });
  };

  this.msip_llena_select_con_AJAX2 = function(rutajson, params, idsel, descerr, root, cid, cnombre, f, opvacia) {
    var d, pv, rv, t, x;
    if (root == null) {
      root = window;
    }
    if (cid == null) {
      cid = 'id';
    }
    if (cnombre == null) {
      cnombre = 'nombre';
    }
    if (f == null) {
      f = null;
    }
    if (opvacia == null) {
      opvacia = false;
    }
    msip_arregla_puntomontaje(root);
    t = Date.now();
    d = -1;
    if (root.msip_llena_select_con_AJAX2_t) {
      d = (t - root.msip_llena_select_con_AJAX2_t) / 1000;
    }
    root.msip_llena_select_con_AJAX2_t = t;
    rv = "";
    if (root.msip_llena_select_con_AJAX2_rv) {
      rv = root.msip_llena_select_con_AJAX2_rv;
    }
    root.msip_llena_select_con_AJAX2_rv = rutajson;
    pv = {};
    if (root.msip_llena_select_con_AJAX2_pv) {
      pv = root.msip_llena_select_con_AJAX2_pv;
    }
    root.msip_llena_select_con_AJAX2_pv = params;
    if (d > 0 && d <= 2 && rutajson === root.msip_llena_select_con_AJAX2_r && params === root.msip_llena_select_con_AJAX2_p) {
      return;
    }
    x = $.getJSON(root.puntomontaje + rutajson, params);
    x.done(function(datos) {
      msip_remplaza_opciones_select(idsel, datos, true, cid, cnombre, opvacia);
      if (f !== null) {
        return f(root);
      }
    });
    return x.fail(function(m1, m2, m3) {
      return alert('Problema ' + descerr + '. ' + params + ' ' + m1 + ' ' + m2 + ' ' + m3);
    });
  };

  this.busca_gen = function(s, sel_id, fuente) {
    s.autocomplete({
      source: fuente,
      minLength: 2,
      select: function(event, ui) {
        if (ui.item) {
          if (sel_id !== null) {
            $(sel_id).val(ui.item.value);
          }
          s.val(ui.item.label);
          event.stopPropagation();
          return event.preventDefault();
        }
      }
    });
  };

  this.msip_arregla_puntomontaje = function(root) {
    if (typeof root.puntomontaje === 'undefined') {
      root.puntomontaje = '/';
    }
    if (root.puntomontaje[root.puntomontaje.length - 1] !== '/') {
      return root.puntomontaje += '/';
    }
  };

  this.msip_pone_tema = function(root, tema) {
    $('.table-striped>tbody>tr:nth-child(odd)').css('background-color', tema.fondo_lista);
    $('.navbar').css('background-image', 'linear-gradient(' + tema.nav_ini + ', ' + tema.nav_fin + ')');
    $('.navbar-default .navbar-nav>li>a').css('color', tema.nav_fuente);
    $('.navbar-default .navbar-brand').css('color', tema.nav_fuente);
    $('.navbar-light .navbar-nav .nav-link').attr('style', 'color: ' + tema.nav_fuente + ' !important');
    $('.navbar-light .navbar-brand').attr('style', 'color: ' + tema.nav_fuente + ' !important');
    $('.dropdown-menu').css('background-color', tema.nav_fin);
    $('.dropdown-item').css('color', tema.nav_fuente);
    $('.dropdown-item').hover(function() {
      return $(this).css({
        'color': tema.color_flota_subitem_fuente,
        'background-color': tema.color_flota_subitem_fondo
      });
    }, function() {
      return $(this).css({
        'color': tema.nav_fuente,
        'background-color': tema.nav_fin
      });
    });
    $('.alert-success').css('color', tema.alerta_exito_fuente);
    $('.alert-success').css('background-color', tema.alerta_exito_fondo);
    $('.alert-danger').css('color', tema.alerta_problema_fuente);
    $('.alert-danger').css('background-color', tema.alerta_problema_fondo);
    $('.btn').css('background-image', 'linear-gradient(to bottom, ' + tema.btn_accion_fondo_ini + ', ' + tema.btn_accion_fondo_fin + ')');
    $('.btn').css('color', tema.btn_accion_fuente);
    $('.btn-primary').css('background-image', 'linear-gradient(to bottom, ' + tema.btn_primario_fondo_ini + ', ' + tema.btn_primario_fondo_fin + ')');
    $('.btn-primary').css('color', tema.btn_primario_fuente);
    $('.btn-danger').css('background-image', 'linear-gradient(to bottom, ' + tema.btn_peligro_fondo_ini + ', ' + tema.btn_peligro_fondo_fin + ')');
    $('.btn-danger').css('color', tema.btn_peligro_fuente);
    $('body').css('background-color', tema.fondo);
    $('.card').css('background-color', tema.fondo);
    $('.msip-sf-bs-input:not(.form-check-input)').css('background-color', tema.fondo);
    $('.msip-sf-bs-input:not(.form-check-input)').css('color', tema.color_fuente);
    $('.page-link').attr('style', 'background-color: ' + tema.fondo + ' !important');
    $('body').css('color', tema.color_fuente);
    return $('table').css('color', tema.color_fuente);
  };

  this.msip_autocompleta_ubicacionpre = function(etiqueta, id, ubipre, root) {
    msip_arregla_puntomontaje(root);
    ubipre.find('[id$=ubicacionpre_id]').val(id);
    ubipre.find('[id$=ubicacionpre_texto]').val(etiqueta);
    ubipre.find('[id$=ubicacionpre_mundep_texto]').val(etiqueta);
    $(document).trigger("msip:autocompletada-ubicacionpre");
  };

  this.msip_busca_ubicacionpre_mundep = function(s) {
    var cnom, root, ubipre, v;
    root = window;
    msip_arregla_puntomontaje(root);
    cnom = s.attr('id');
    v = $("#" + cnom).data('autocompleta');
    if (v !== 1 && v !== "no") {
      $("#" + cnom).data('autocompleta', 1);
      ubipre = s.closest('.div_ubicacionpre');
      if (typeof ubipre === 'undefined') {
        alert('No se ubico .div_ubicacionpre');
        return;
      }
      if ($(ubipre).find("[id$='ubicacionpre_id']").length !== 1) {
        alert('Dentro de .div_ubicacionpre no se ubicó ubicacionpre_id');
        return;
      }
      if ($(ubipre).find("[id$='ubicacionpre_mundep_texto']").length !== 1) {
        alert('Dentro de .div_ubicacionpre no se ubicó ubicacionpre_mundep_texto');
        return;
      }
      $("#" + cnom).autocomplete({
        source: root.puntomontaje + "ubicacionespre_mundep.json",
        minLength: 2,
        select: function(event, ui) {
          if (ui.item) {
            msip_autocompleta_ubicacionpre(ui.item.value, ui.item.id, ubipre, root);
            event.stopPropagation();
            return event.preventDefault();
          }
        }
      });
    }
  };

  this.msip_busca_ubicacionpre = function(s) {
    var cnom, root, ubipre, v;
    root = window;
    msip_arregla_puntomontaje(root);
    cnom = s.attr('id');
    v = $("#" + cnom).data('autocompleta');
    if (v !== 1 && v !== "no") {
      $("#" + cnom).data('autocompleta', 1);
      ubipre = s.closest('.div_ubicacionpre');
      if (typeof ubipre === 'undefined') {
        alert('No se ubico .div_ubicacionpre');
        return;
      }
      if ($(ubipre).find("[id$='ubicacionpre_id']").length !== 1) {
        alert('Dentro de .div_ubicacionpre no se ubicó ubicacionpre_id');
        return;
      }
      if ($(ubipre).find("[id$='ubicacionpre_texto']").length !== 1) {
        alert('Dentro de .div_ubicacionpre no se ubicó ubicacionpre_texto');
        return;
      }
      $("#" + cnom).autocomplete({
        source: root.puntomontaje + "ubicacionespre.json",
        minLength: 2,
        select: function(event, ui) {
          if (ui.item) {
            msip_autocompleta_ubicacionpre(ui.item.value, ui.item.id, ubipre, root);
            event.stopPropagation();
            return event.preventDefault();
          }
        }
      });
    }
  };

  this.msip_registra_cambios_para_bitacora = function(root) {
    if ($('input.bitacora_cambio').length > 0) {
      root.bitacora_estado_inicial_formulario = $('input.bitacora_cambio').closest('form').serializeArray();
    }
    $(document).on('submit', 'form:has(.bitacora_cambio)', function(e) {
      var cambio, df, di, i;
      root.bitacora_estado_final_formulario = $('input.bitacora_cambio').closest('form').serializeArray();
      cambio = {};
      di = {};
      root.bitacora_estado_inicial_formulario.forEach(function(v) {
        return di[v.name] = v.value;
      });
      df = {};
      root.bitacora_estado_final_formulario.forEach(function(v) {
        df[v.name] = v.value;
        if (typeof di[v.name] === 'undefined') {
          return cambio[v.name] = [null, v.value];
        }
      });
      for (i in di) {
        e = di[i];
        if (typeof df[i] === 'undefined') {
          cambio[i] = [e, null];
        } else if (df[i] !== e && i.search(/\[bitacora_cambio\]/) < 0) {
          cambio[i] = [e, df[i]];
        }
      }
      return $('input.bitacora_cambio').val(JSON.stringify(cambio));
    });
  };

  this.msip_reconocer_decimal_locale_es_CO = function(n) {
    var i, r;
    if (n === "") {
      return 0;
    }
    i = 0;
    r = "";
    while (i < n.length) {
      if (n[i] === ',') {
        r = r + '.';
      }
      if (n[i] >= '0' && n[i] <= '9') {
        r = r + n[i];
      }
      i++;
    }
    return parseFloat(r);
  };

  this.msip_inicializaMotor = function(conenv) {
    if (conenv == null) {
      conenv = true;
    }
    window.puntomontaje = "/learntg-admin/";
    if (conenv && false) {
      window.puntomontaje = "";
    }
    msip_arregla_puntomontaje(window);
    window.msip_sincoord = false;
    window.formato_fecha = 'yyyy-mm-dd';
    return window.msip_idioma_predet = 'es';
  };

  this.msip_prepara_eventos_comunes = function(root, sincoord, conenv) {
    var detieneRotador, iniciaRotador;
    if (sincoord == null) {
      sincoord = false;
    }
    if (conenv == null) {
      conenv = true;
    }
    if (typeof root.formato_fecha === 'undefined') {
      msip_inicializaMotor(conenv);
    }
    $('[data-behaviour~=datepicker]').datepicker({
      format: root.formato_fecha,
      autoclose: true,
      todayHighlight: true,
      language: 'es'
    });
    $('[data-toggle="tooltip"]').tooltip();
    $(document).on('cocoon:after-insert', function(e) {
      $('[data-behaviour~=datepicker]').datepicker({
        format: root.formato_fecha,
        autoclose: true,
        todayHighlight: true,
        language: 'es'
      });
      return $('[data-toggle="tooltip"]').tooltip();
    });
    msip_ajax_recibe_json(root, 'temausuario', {}, msip_pone_tema);
    jQuery(function() {
      $("a[rel~=popover], .has-popover").popover();
      return $("a[rel~=tooltip], .has-tooltip").tooltip();
    });
    $(document).on('change', 'select[id$=_pais_id]', function(e) {
      if (typeof e.target.tomselect === 'undefined') {
        return llena_departamento($(this), root, sincoord);
      }
    });
    $(document).on('change', 'select[id$=_pais_id]', function(e) {
      if (typeof e.target.tomselect === 'undefined') {
        return llena_departamento($(this), root, sincoord);
      }
    });
    $(document).on('change', 'select[id$=_departamento_id]', function(e) {
      if (typeof e.target.tomselect === 'undefined') {
        return llena_municipio($(this), root, sincoord);
      }
    });
    $(document).on('change', 'select[id$=_departamento_id]', function(e) {
      if (typeof e.target.tomselect === 'undefined') {
        return llena_municipio($(this), root, sincoord);
      }
    });
    $(document).on('change', 'select[id$=_municipio_id]', function(e) {
      if (typeof e.target.tomselect === 'undefined') {
        return llena_centropoblado($(this), root, sincoord);
      }
    });
    $(document).on('change', 'select[id$=_municipio_id]', function(e) {
      if (typeof e.target.tomselect === 'undefined') {
        return llena_centropoblado($(this), root, sincoord);
      }
    });
    $(document).on('change', 'select[id$=_centropoblado_id]', function(e) {
      if (typeof e.target.tomselect === 'undefined') {
        return pone_tipourbano($(this));
      }
    });
    $(document).on('change', 'select[id$=_centropoblado_id]', function(e) {
      if (typeof e.target.tomselect === 'undefined') {
        return pone_tipourbano($(this));
      }
    });
    $('#mundep').on('focusin', function(e) {
      msip_arregla_puntomontaje(root);
      return busca_gen($(this), null, root.puntomontaje + "mundep.json");
    });
    $(document).on('click', 'a.enviarautomatico[href^="#"]', function(e) {
      msip_enviarautomatico_formulario($('form'), 'POST', 'json', false);
    });
    $(document).on('change', 'select[data-enviarautomatico]', function(e) {
      return msip_enviarautomatico_formulario($(e.target.form));
    });
    $(document).on('change', 'input[data-enviarautomatico]', function(e) {
      return msip_enviarautomatico_formulario($(e.target.form));
    });
    iniciaRotador = function() {
      $("html").css("cursor", "progress");
    };
    detieneRotador = function() {
      $("html").css("cursor", "auto");
    };
    $(document).on('turbo:click', function(event) {
      if (event.target.getAttribute('href').charAt(0) === '#') {
        return event.preventDefault();
      }
    });
    $(document).on("page:fetch", iniciaRotador);
    $(document).on("page:receive", detieneRotador);
  };

  this.msip_ejecutarAlCargarPagina = function(root) {
    var evento;
    console.log('Msip: Ejecutando al cargar pagina');
    if (typeof window.formato_fecha === 'undefined' || window.formato_fecha === '{}') {
      msip_inicializaMotor();
    }
    $('[data-behaviour~=datepicker]').datepicker({
      format: root.formato_fecha,
      autoclose: true,
      todayHighlight: true,
      language: 'es'
    });
    $('[data-toggle="tooltip"]').tooltip();
    $(document).on('cocoon:after-insert', function(e) {
      $('[data-behaviour~=datepicker]').datepicker({
        format: root.formato_fecha,
        autoclose: true,
        todayHighlight: true,
        language: 'es'
      });
      return $('[data-toggle="tooltip"]').tooltip();
    });
    MsipIniciar();
    msip_ajax_recibe_json(root, 'temausuario', {}, msip_pone_tema);
    jQuery(function() {
      $("a[rel~=popover], .has-popover").popover();
      return $("a[rel~=tooltip], .has-tooltip").tooltip();
    });
    evento = new Event('msip:cargado');
    return document.dispatchEvent(evento);
  };

  this.msip_edadDeFechaNacFechaRef = function(anionac, mesnac, dianac, anioref, mesref, diaref) {
    var na;
    if (typeof anionac === 'undefined' || anionac === '') {
      return -1;
    }
    if (typeof anioref === 'undefined' || anioref === '') {
      return -1;
    }
    na = anioref - anionac;
    if (typeof mesnac !== 'undefined' && mesnac !== '' && mesnac > 0 && typeof mesref !== 'undefined' && mesref !== '' && mesref > 0 && mesnac >= mesref) {
      if (mesnac > mesref || (dianac !== 'undefined' && dianac !== '' && dianac > 0 && diaref !== 'undefined' && diaref !== '' && diaref > 0 && dianac > diaref)) {
        na--;
      }
    }
    return na;
  };

}).call(this);
(function() {
  this.heb412_gen_completa_generarp = function(elema, idselplantilla, idruta, rutagenera, formatosalida) {
    var d, e, f, formato, nplantilla, p, root;
    if (formatosalida == null) {
      formatosalida = 'ods';
    }
    formato = formatosalida;
    p = $(idselplantilla).val().split('.');
    nplantilla = p[0].replace(/[^a-zA-Z0-9_]/g, "");
    if (p.length === 2) {
      if (p[1] !== 'html' && p[1] !== 'ods' && p[1] !== 'odt' && p[1] !== 'xrlat' && p[1] !== 'json' && p[1] !== 'csv') {
        nplantilla = '';
      } else {
        formato = p[1];
        if (formato === 'html' || formato === 'odt' || formato === 'xrlat' || formato === 'json' || formato === 'csv') {
          formatosalida = formato;
        }
      }
    }
    if (nplantilla.length > 0) {
      if (idruta === null) {
        f = $(elema).closest('form');
      } else {
        f = $("form[action$='" + idruta + "']");
      }
      d = f.serialize();
      d += '&idplantilla=' + nplantilla;
      d += '&formato=' + formato;
      d += '&formatosalida=' + formatosalida;
      d += '&commit=Enviar';
      root = window;
      msip_arregla_puntomontaje(root);
      if ((root.puntomontaje !== '/' || rutagenera[0] !== '/') && rutagenera.substring(0, root.puntomontaje.length) !== root.puntomontaje) {
        rutagenera = root.puntomontaje + rutagenera;
      }
      e = rutagenera + '.' + formatosalida + '?' + d;
      return $(elema).attr('href', e);
    } else {
      return false;
    }
  };

  this.heb412_gen_eliminar_archivo = function(urlelim) {
    var el, narc, rarc, rnarc, ub;
    el = document.createElement('a');
    el.href = urlelim;
    rnarc = el.pathname.replace(/^.*\/sis\//, '') + '/' + el.search.substr(10);
    ub = rnarc.lastIndexOf('/');
    if (ub < 0) {
      return false;
    }
    rarc = rnarc.substr(0, ub);
    narc = rnarc.substr(ub + 1);
    return msip_envia_ajax_datos_ruta_y_pinta('sis/eliminararc', {
      ruta: rarc,
      arc: narc
    }, '', '', 'POST', 'script', true);
  };

  this.heb412_gen_eliminar_directorio = function(urlelim) {
    var el, ndir, rarc, rnarc, ub;
    el = document.createElement('a');
    el.href = urlelim;
    rnarc = el.pathname.replace(/^.*\/sis\//, '');
    ub = rnarc.lastIndexOf('/');
    if (ub < 0) {
      return false;
    }
    rarc = rnarc.substr(0, ub);
    ndir = rnarc.substr(ub + 1);
    return msip_envia_ajax_datos_ruta_y_pinta('sis/eliminardir', {
      ruta: rarc,
      dir: ndir
    }, '', '', 'POST', 'script', true);
  };

  this.heb412_gen_prepara_eventos_comunes = function(root) {
    if (window.location.href.match(/\/plantillahcm\//)) {
      $(document).on('change', '#plantillahcm_vista', function(e) {
        return msip_envia_ajax_datos_ruta_y_pinta('plantillahcm/pintacampos', 'vista=' + $(this).val(), '#gen_divcampos', '#divcampos');
      });
    }
    $("#heb412_mcarc").hide();
    $("#heb412_mcdir").hide();
    $(".heb412_archivo").bind("contextmenu", function(e) {
      var indice;
      indice = 0;
      if (e.target.classList.contains('heb412_archivo')) {
        indice = e.target.dataset['heb412Indice'];
      } else if (e.target.parentElement.classList.contains('heb412_archivo')) {
        indice = e.target.parentElement.dataset['heb412Indice'];
      }
      if (indice > 0) {
        window.heb412_mcarc_descarga = document.querySelector('#heb412-enlace-' + indice);
      } else {
        window.heb412_mcarc_descarga = null;
      }
      $("#heb412_mcarc").css({
        'display': 'block',
        'left': e.pageX,
        'top': e.pageY
      });
      return false;
    });
    $(".heb412_directorio").bind("contextmenu", function(e) {
      if (e.target.getAttribute('href') === null) {
        window.heb412_mcdir_enlace = e.target.parentElement;
      } else {
        window.heb412_mcdir_enlace = e.target;
      }
      $("#heb412_mcdir").css({
        'display': 'block',
        'left': e.pageX,
        'top': e.pageY
      });
      return false;
    });
    $(document).click(function(e) {
      if (e.button === 0) {
        return $(".heb412_menucontextual").css("display", "none");
      }
    });
    $(".heb412_menucontextual").mouseleave(function() {});
    $(document).keydown(function(e) {
      if (e.keyCode === 27) {
        return $(".heb412_menucontextual").css("display", "none");
      }
    });
    $("#heb412_mcarc").click(function(e) {
      var d, t;
      root = window;
      msip_arregla_puntomontaje(root);
      t = Date.now();
      d = -1;
      if (root.heb412_mcarc_t) {
        d = (t - root.heb412_mcarc_t) / 1000;
      }
      if (d === -1 || d > 2) {
        root.heb412_mcarc_t = t;
        switch (e.target.id) {
          case "descargar":
            root.heb412_mcarc_descarga.click();
            break;
          case "renombrar":
            alert("renombrado archivo!");
            break;
          case "eliminar":
            heb412_gen_eliminar_archivo(root.heb412_mcarc_descarga.href);
            break;
          case "permisos":
            alert("estableciendo establecidos!");
        }
      }
      return false;
    });
    $("#heb412_mcdir").click(function(e) {
      var d, t;
      t = Date.now();
      d = -1;
      if (window.heb412_mcdir_t) {
        d = (t - root.heb412_mcdir_t) / 1000;
      }
      if (d === -1 || d > 2) {
        window.heb412_mcdir_t = t;
        switch (e.target.id) {
          case "abrir":
            return window.heb412_mcdir_enlace.click();
          case "renombrar":
            return alert("renombrado directorio!");
          case "eliminar":
            return heb412_gen_eliminar_directorio(root.heb412_mcdir_enlace.href);
          case "permisos":
            return alert("estableciendo permisos a directorio!");
        }
      }
    });
  };

}).call(this);
// Ahora gridstack se carga como módulo


// Pasa ubicaciones de elementos del formulario del
// esquema visual al esquema texto
function mr519ef_visual_a_texto() {
  document.querySelectorAll('.grid-stack-item').forEach((i) => {
    var vx = i.getAttribute('data-gs-x');
    var vy = i.getAttribute('data-gs-y');
    var vwidth = i.getAttribute('data-gs-width');
    if (!i.getAttribute('class').includes('grid-stack-placeholder')) {
      var vid = +i.getAttribute('data-gs-id');
      $('#formulario_campo_attributes_' + vid + '_fila').attr('value', 
        +vy + 1);
      $('#formulario_campo_attributes_' + vid + '_columna').attr('value', 
        +vx + 1 );
      $('#formulario_campo_attributes_' + vid + '_ancho').attr('value', 
        +vwidth);
    }
  })
}
 
// Pasa ubicaciones de elementos del formulario del
// esquema texto al esquema visual
function mr519ef_texto_a_visual() {
  document.querySelectorAll('[id^=formulario_campo_attributes_][id$=_id]').forEach((i) => {
    console.log(i)
    if (i.parentElement.parentElement.parentElement.getAttribute('style') === null  || !i.parentElement.parentElement.parentElement.getAttribute('style').includes('display: none')) {
      // No agrega a esquema visual los eliminados
      if (i.getAttribute('id').split('_')[4] == 'id'){
        let idc = i.getAttribute('id').split('_')[3]
        let vx = +document.querySelector('#formulario_campo_attributes_' + idc + 
          '_columna').value
        let vy = +document.querySelector('#formulario_campo_attributes_' + idc + 
          '_fila').value
        let vancho = +document.querySelector('#formulario_campo_attributes_' + 
          idc + '_ancho').value
        let vnombre = msip_escapaHtml(
          document.querySelector('#formulario_campo_attributes_' + 
          idc + '_nombre').value
        )

        document.addNewWidget({
          x: vx > 0 ? vx - 1 : 0,
          y: vy > 0 ? vy - 1 : 0,
          width: vancho > 0 ? vancho : 12,
          height: 1,
          minWidth: 1,
          auto_position: true,
          id: idc,
          contenido: vnombre ,
        })
      }
    }
  })
}

// Prepara esquema visual de formulario y sincronización con esquema texto
// y configura primer esquema visual con esquema texto desplegado
function mr519ef_prepara() {

  var opciones = {
    float: true,
    auto: false,
    resizable: { handles: 'e, w'},
  };
  if (typeof $.fn.gridstack === 'undefined') {
    return
  }

  $('.grid-stack').gridstack(opciones);
  document.grid = $('.grid-stack').data('gridstack');

  document.addNewWidget = function (datos = null) {
    var node = {
      x: 12 * Math.random(),
      y: 5 * Math.random(),
      width: 1 + 3 * Math.random(),
      height: 1,
    };
    if (datos != null) {
      node = {
        x: datos.x,
        y: datos.y,
        width: datos.width,
        height: 1,
        auto_position: true,
        id: datos.id
      };
    }
    document.grid.addWidget($('<div><div class="grid-stack-item-content">' +
      datos.contenido + '</div></div>'), node);
    return false;
  }.bind(document);  


  $(document).on('cocoon:after-insert', '#campos', function(e, campo){
    if (e.target.id == "campos") { 
      var ultimaFila = e.target.lastElementChild;
      var ultimaColumna = ultimaFila.lastElementChild;
      var elementoId = ultimaColumna.firstElementChild;
      var laid = elementoId.firstElementChild.value
      var maxy = 0
      document.querySelectorAll('.grid-stack-item').forEach( i => {
        y = +i.getAttribute('data-gs-y')
        if (y > maxy) {
          maxy = y
        }
      })
      var node = {
        x: 0,
        y: maxy,
        width: 12,
        height: 1,
        minWidth: 1,
        auto_position: true,
        id: laid,
        contenido: laid
      }
      document.grid.addWidget($('<div><div class="grid-stack-item-content">' +
        node.contenido + '</div></div>'), node);
    }
  });

  $(document).on('cocoon:after-remove', '#campos', function(e, campo){
    if (e.target.id == "campos") { 
      document.grid.removeAll()
      mr519ef_texto_a_visual()
    }  
  })

  $(document).on('change', '#campos',function(event, items) {
    if (event.target.id == "campos") { 
      document.grid.removeAll()
    mr519ef_texto_a_visual()
    }
  })

  $(document).on('change', '.grid-stack',function(event, items) {
    mr519ef_visual_a_texto()
  })

  mr519ef_texto_a_visual();

}
;
(function() {
  this.mr519_gen_nombre_a_nombreinterno = function(nombre) {
    var ni;
    ni = nombre.replace(/[^A-Za-z0-9_]/g, '_');
    ni = ni.toLowerCase();
    ni = ni.substring(0, 60);
    return ni;
  };

  this.mr519_gen_prepara_eventos_comunes = function(root, opciones) {
    if (opciones == null) {
      opciones = {};
    }
    $(document).on('change', '[id^=formulario_campo_attributes_][id$=_tipo]', function(event) {
      root = window;
      if ($(this).find('option:selected').length > 0 && ($(this).find('option:selected').text() === 'Selección Múltiple' || $(this).find('option:selected').text() === 'Selección Simple')) {
        $(this).parent().parent().parent().find('.espopciones').show();
      } else {
        $(this).parent().parent().parent().find('.espopciones').hide();
      }
      if ($(this).find('option:selected').length > 0 && ($(this).find('option:selected').text() === 'Selección Múltiple con Tabla Básica' || $(this).find('option:selected').text() === 'Selección Simple con Tabla Básica')) {
        return $(this).parent().parent().parent().find('.tablabasica').show();
      } else {
        return $(this).parent().parent().parent().find('.tablabasica').hide();
      }
    });
    $(document).on('change', '#formulario_nombre', function(event) {
      var idni;
      root = window;
      idni = $(this).attr('id').replace('nombre', 'nombreinterno');
      if ($('#' + idni).length === 1 && ($('#' + idni).val() === '' || $('#' + idni).val() === 'N')) {
        return $('#' + idni).val(mr519_gen_nombre_a_nombreinterno($(this).val()));
      }
    });
    $(document).on('change', 'input[id^=formulario_campo_attributes_][id$=_nombre]', function(event) {
      var idni;
      root = window;
      idni = $(this).attr('id').replace('nombre', 'nombreinterno');
      if ($('#' + idni).length === 0) {
        idni = $(this).attr('id').replace('nombre', 'valor');
      }
      if ($('#' + idni).length === 1 && ($('#' + idni).val() === '' || $('#' + idni).val() === 'N')) {
        return $('#' + idni).val(mr519_gen_nombre_a_nombreinterno($(this).val()));
      }
    });
    if ($('.grid-stack').length > 0) {
      mr519ef_prepara();
    }
    return 0;
  };

}).call(this);
(function() {
  this.cor1440_gen_establece_duracion = function(root, obdur) {
    return $('#proyectofinanciero_duracion').val(obdur.duracion);
  };

  this.cor1440_gen_recalcula_duracion = function(root) {
    var datos;
    datos = {
      fechainicio_localizada: $('#proyectofinanciero_fechainicio_localizada').val(),
      fechacierre_localizada: $('#proyectofinanciero_fechacierre_localizada').val()
    };
    if (datos.fechainicio_localizada !== '' && datos.fechacierre_localizada !== '') {
      return msip_ajax_recibe_json(window, 'api/cor1440gen/duracion', datos, cor1440_gen_establece_duracion);
    } else {
      return $('#proyectofinanciero_duracion').val('');
    }
  };

  this.cor1440_gen_eventos_duracion = function(root) {
    $(document).on('change', '#proyectofinanciero_fechaformulacion_mes', function(e) {
      var s;
      s = 2;
      if ($('#proyectofinanciero_fechaformulacion_mes').val() <= 6) {
        s = 1;
      }
      return $('#proyectofinanciero_semestreformulacion').val(s);
    });
    $(document).on('change', '#proyectofinanciero_fechainicio_localizada', function(e) {
      return cor1440_gen_recalcula_duracion(window);
    });
    $(document).on('change', '#proyectofinanciero_fechacierre_localizada', function(e) {
      return cor1440_gen_recalcula_duracion(window);
    });
    $(document).on('change', '#proyectofinanciero_fechainicio_localizada', function(e) {
      return cor1440_gen_recalcula_duracion(window);
    });
    return $(document).on('change', '#proyectofinanciero_fechacierre_localizada', function(e) {
      return cor1440_gen_recalcula_duracion(window);
    });
  };

  this.cor1440_gen_recalcula_aemergente_pesos_localizado = function(campo, tasa) {
    var vc, vcp, vcpl;
    vc = $('#' + campo).val();
    if (typeof vc !== 'undefined' && vc !== '' && typeof tasa !== 'undefined' && tasa > 0) {
      vcp = msip_reconocer_decimal_locale_es_CO(vc) * tasa;
      vcpl = new Intl.NumberFormat('es-CO').format(vcp);
      return $('#' + campo).attr('title', '$ ' + vcpl).tooltip('fixTitle').tooltip('show');
    }
  };

  this.cor1440_gen_recalcula_montospesos_localizado = function(root) {
    var sum, suml, sump, sumpl, te, tel, tf, tfl;
    if ($('#proyectofinanciero_tasa_localizado').length > 0) {
      tfl = $('#proyectofinanciero_tasa_localizado').val();
      tf = msip_reconocer_decimal_locale_es_CO(tfl);
      sum = 0;
      sump = 0;
      $.each([['monto', 'montopesos'], ['aportepropio', 'aportepropiop'], ['aotrosfin', 'aporteotrosp'], ['saldo', 'saldop']], function(i, c) {
        var v, vl, vp, vpl;
        vl = $('#proyectofinanciero_' + c[0] + '_localizado').val();
        v = msip_reconocer_decimal_locale_es_CO(vl);
        sum += v;
        vp = v * tf;
        vpl = new Intl.NumberFormat('es-CO').format(vp);
        $('#proyectofinanciero_' + c[1] + '_localizado').val(vpl);
        return sump += vp;
      });
      suml = new Intl.NumberFormat('es-CO').format(sum);
      sumpl = new Intl.NumberFormat('es-CO').format(sump);
      $('#proyectofinanciero_presupuestototal_localizado').val(suml);
      $('#proyectofinanciero_presupuestototalp_localizado').val(sumpl);
    }
    if ($('#proyectofinanciero_tasaej_localizado').length > 0) {
      tel = $('#proyectofinanciero_tasaej_localizado').val();
      te = msip_reconocer_decimal_locale_es_CO(tel);
      sum = 0;
      sump = 0;
      $.each([['montoej', 'montoejp'], ['aportepropioej', 'aportepropioejp'], ['aporteotrosej', 'aporteotrosejp']], function(i, c) {
        var v, vl, vp, vpl;
        vl = $('#proyectofinanciero_' + c[0] + '_localizado').val();
        v = msip_reconocer_decimal_locale_es_CO(vl);
        sum += v;
        vp = v * te;
        vpl = new Intl.NumberFormat('es-CO').format(vp);
        $('#proyectofinanciero_' + c[1] + '_localizado').val(vpl);
        return sump += vp;
      });
      suml = new Intl.NumberFormat('es-CO').format(sum);
      sumpl = new Intl.NumberFormat('es-CO').format(sump);
      $('#proyectofinanciero_presupuestototalej_localizado').val(suml);
      $('#proyectofinanciero_presupuestototalejp_localizado').val(sumpl);
    }
  };

  this.cor1440_gen_eventos_montospesos = function(root) {
    $(document).on('change', '#proyectofinanciero_tasa_localizado', function(e) {
      return cor1440_gen_recalcula_montospesos_localizado(root);
    });
    $(document).on('change', '#proyectofinanciero_tasaej_localizado', function(e) {
      return cor1440_gen_recalcula_montospesos_localizado(root);
    });
    $.each(['monto', 'aportepropio', 'aporteotros', 'montoej', 'aportepropioej', 'aporteotrosej'], function(i, c) {
      return $(document).on('change', '#proyectofinanciero_' + c + '_localizado', function(e) {
        return cor1440_gen_recalcula_montospesos_localizado(root);
      });
    });
  };

}).call(this);
(function() {
  this.cor1440_gen_llena_medicion = function(root, res) {
    var cont, enlace, hid, meta;
    hid = res.hmindicadorpf_id;
    $('[id=mindicadorpf_pmindicadorpf_attributes_' + hid + '_fecha_localizada]').val(res.fechaloc);
    cont = 0;
    res.datosint.forEach(function(v) {
      $('[id$=_' + hid + '_datointermedioti_pmindicadorpf_attributes_' + cont + '_valor]').val(v.valor);
      $('[id$=_' + hid + '_datointermedioti_pmindicadorpf_attributes_' + cont + '_rutaevidencia]').val(v.rutaevidencia);
      return cont++;
    });
    $('[id=mindicadorpf_pmindicadorpf_attributes_' + hid + '_resind]').val(res.resind);
    $('[id=mindicadorpf_pmindicadorpf_attributes_' + hid + '_rutaevidencia]').val(res.rutaevidencia);
    meta = +$('[id=mindicadorpf_pmindicadorpf_attributes_' + hid + '_meta]').val();
    if (meta > 0) {
      $('[id=mindicadorpf_pmindicadorpf_attributes_' + hid + '_porcump]').val(res.resind * 100 / meta);
    }
    enlace = $('[id=mindicadorpf_pmindicadorpf_attributes_' + hid + '_resind]').closest('td').find('a.enlaceevidencia');
    enlace.html(res.resind);
    return enlace.attr('href', res.rutaevidencia);
  };

  this.cor1440_gen_calcula_pmindicadorpf = function(elem, event) {
    var datos, efinicio, hid, r, root;
    event.stopPropagation();
    event.preventDefault();
    root = window;
    r = $(elem).closest('tr');
    efinicio = r.find('[id$=finicio_localizada]');
    hid = efinicio.attr('id').replace(/.*_attributes_([0-9]*)_finicio_localizada/, '$1');
    datos = {
      finicio_localizada: efinicio.val(),
      ffin_localizada: r.find('[id$=ffin_localizada]').val(),
      indicadorpf_id: $(document).find('#mindicadorpf_indicadorpf_id').val(),
      hmindicadorpf_id: hid,
      mindicadorpf_id: $('form.edit_mindicadorpf')[0].id.split('_')[2]
    };
    msip_ajax_recibe_json(root, 'api/cor1440gen/medir_indicador', datos, cor1440_gen_llena_medicion);
  };

  this.cor1440_gen_preparamindicadorespf = function(root) {
    $("#cor1440_gen_mfun").hide();
    $(".cor1440_gen_funcion").bind("contextmenu", function(e) {
      window.cor1440_gen_mfun_enlace = e.target;
      $("#cor1440_gen_mfun").css({
        'display': 'block',
        'left': e.pageX,
        'top': e.pageY
      });
      return false;
    });
    $(document).click(function(e) {
      if (e.button === 0) {
        return $(".cor1440_gen_menucontextual").css("display", "none");
      }
    });
    $(document).keydown(function(e) {
      if (e.keyCode === 27) {
        return $(".cor1440_gen_menucontextual").css("display", "none");
      }
    });
    return $("#cor1440_gen_mfun").click(function(e) {
      var d, t;
      root = window;
      msip_arregla_puntomontaje(root);
      t = Date.now();
      d = -1;
      if (root.cor1440_gen_mcarc_t) {
        d = (t - root.cor1440_gen_mcarc_t) / 1000;
      }
      if (d === -1 || d > 2) {
        root.cor1440_gen_mcarc_t = t;
        switch (e.target.id) {
          case "actividades":
            window.cor1440_gen_mfun_enlace.value = "cuenta(Actividades_contribuyentes)";
            break;
          case "poblacion":
            window.cor1440_gen_mfun_enlace.value = 'suma(mapeaproy(Actividades_contribuyentes, poblacion))';
            break;
          case "asistentes":
            window.cor1440_gen_mfun_enlace.value = 'cuenta(aplana(mapeaproy(Actividades_contribuyentes, Asistentes)))';
            break;
          case "asistentesunicos":
            window.cor1440_gen_mfun_enlace.value = 'cuenta(unicos(mapeaproy(aplana(mapeaproy(Actividades_contribuyentes, Asistentes)), persona)))';
            break;
          case "organizaciones":
            window.cor1440_gen_mfun_enlace.value = "cuenta(aplana(mapeaproy(Actividades_contribuyentes, Organizaciones)))";
            break;
          case "organizacionesunicas":
            window.cor1440_gen_mfun_enlace.value = "cuenta(unicas(aplana(mapeaproy(Actividades_contribuyentes, Organizaciones))))";
        }
        $(".cor1440_gen_menucontextual").css("display", "none");
      }
      return false;
    });
  };

}).call(this);
Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var Cor1440GenAutocompletaAjaxAsistentes = (function () {
  function Cor1440GenAutocompletaAjaxAsistentes() {
    _classCallCheck(this, Cor1440GenAutocompletaAjaxAsistentes);
  }

  // Queriamos hacer dentro de Cor1440GenAutocompletaAjaxAsistentes static claseEnvoltura = 'campos_asistente' pero la versión de bable usada por babel-transpiler, usado por sprockets4 no lo soporta así que:
  _createClass(Cor1440GenAutocompletaAjaxAsistentes, null, [{
    key: 'operarElegida',

    /* No usamos constructor ni this porque en operaElegida sería
     * del objeto AutocompletaAjaxExpreg y no esta clase.
     * Más bien en esta todo static
     */

    // Elije una persona en autocompletación
    value: function operarElegida(eorig, cadpersona, id, otrosop) {
      var root = window;
      msip_arregla_puntomontaje(root);
      var cs = id.split(';');
      var idPersona = cs[0];
      if ([].concat(_toConsumableArray(document.querySelector('#asistencia').querySelectorAll('[id$=_attributes_id]'))).filter(function (e) {
        return e.value == idPersona;
      }).length > 0) {
        window.alert("La misma persona ya está en el listado de asistencia");
        return;
      }
      var d = '&persona_id=' + idPersona;
      d += '&ac_asistente_persona=true';
      var a = root.puntomontaje + 'personas/datos';

      window.Rails.ajax({
        type: 'GET',
        url: a,
        data: d,
        success: function success(resp, estado, xhr) {
          var divcp = eorig.target.closest('.' + Cor1440GenAutocompletaAjaxAsistentes.claseEnvoltura);
          if (divcp == null) {
            alert('No se encontró elmento con clase ' + Cor1440GenAutocompletaAjaxAsistentes.claseEnvoltura);
          }
          divcp.querySelector('[id$=_attributes_id]').value = resp.id;
          divcp.querySelector('[id$=_attributes_nombres]').value = resp.nombres;
          divcp.querySelector('[id$=_attributes_apellidos]').value = resp.apellidos;
          divcp.querySelector('[id$=_attributes_sexo]').value = resp.sexo;
          var tdocid = divcp.querySelector('[id$=_attributes_tdocumento_id]');
          if (tdocid != null) {
            var idop = null;
            tdocid.childNodes.forEach(function (o) {
              if (typeof o.innerText === 'string' && o.innerText === resp.tdocumento) {
                idop = o.value;
              }
            });
            if (idop != null) {
              tdocid.value = idop;
            }
          }
          var numdoc = divcp.querySelector('[id$=_numerodocumento]');
          if (numdoc != null) {
            numdoc.value = resp.numerodocumento;
          }
          var anionac = divcp.querySelector('[id$=_anionac]');
          if (anionac != null) {
            anionac.value = resp.anionac;
          }
          var mesnac = divcp.querySelector('[id$=_mesnac]');
          if (mesnac != null) {
            mesnac.value = resp.mesnac;
          }
          var dianac = divcp.querySelector('[id$=_dianac]');
          if (dianac != null) {
            dianac.value = resp.dianac;
          }
          var cargo = divcp.querySelector('[id$=_cargo]');
          if (cargo != null) {
            cargo.value = resp.cargo;
          }
          var correo = divcp.querySelector('[id$=_correo]');
          if (correo != null) {
            correo.value = resp.correo;
          }
          eorig.target.setAttribute('data-autocompleta', 'no');
          eorig.target.removeAttribute('list');
          var sel = document.getElementById(Cor1440GenAutocompletaAjaxAsistentes.idDatalist);
          sel.innerHTML = '';
          // $(document).trigger('cor1440gen:autocompletado-asistente')
          document.dispatchEvent(new Event('cor1440gen:autocompletado-asistente'));
        },
        error: function error(resp, estado, xhr) {
          window.alert('Error con ajax ' + resp);
        }
      });
    }
  }, {
    key: 'iniciar',
    value: function iniciar() {
      console.log("Cor1440GenAutocompletaAjaxAsistentes cor1440_gen");
      var url = window.puntomontaje + 'personas.json';
      var asistentes = new window.AutocompletaAjaxExpreg([/^actividad_asistencia_attributes_[0-9]*_persona_attributes_numerodocumento$/], url, Cor1440GenAutocompletaAjaxAsistentes.idDatalist, Cor1440GenAutocompletaAjaxAsistentes.operarElegida);
      asistentes.iniciar();
    }
  }]);

  return Cor1440GenAutocompletaAjaxAsistentes;
})();

exports['default'] = Cor1440GenAutocompletaAjaxAsistentes;
Cor1440GenAutocompletaAjaxAsistentes.claseEnvoltura = 'campos_asistente';
Cor1440GenAutocompletaAjaxAsistentes.idDatalist = 'fuente-asistentes';
module.exports = exports['default'];
(function() {
  var cor1440_gen_rangoedadac_tot, cor1440_gen_rangoedadac_uno, cor1440_gen_rangoedadc_todos;

  this.DEP_OBJETIVOPF = ['select[id^=proyectofinanciero_resultadopf_attributes][id$=_objetivopf_id]', 'select[id^=proyectofinanciero_indicadorobjetivo_attributes][id$=_objetivopf_id]'];

  this.DEP_RESULTADOPF = ['select[id^=proyectofinanciero_indicadorpf_attributes][id$=_resultadopf_id]', 'select[id^=proyectofinanciero_actividadpf_attributes][id$=_resultadopf_id]'];

  this.DEP_INDICADORPF = [];

  cor1440_gen_rangoedadac_uno = function(ini, col) {
    var sumc;
    sumc = 0;
    $('[id^=' + ini + '][id$=' + col + ']').each(function(o) {
      var ab, v;
      v = $(this).val();
      if (v !== "") {
        ab = $(this).parent().parent().css('display');
        if (ab !== 'none') {
          return sumc += parseInt(v);
        }
      }
    });
    $("#tactividad" + col).text(sumc);
  };

  cor1440_gen_rangoedadac_tot = function() {
    var fl, fr, ml, mr, sr;
    fl = parseInt($("#tactividadfl").text());
    fr = parseInt($("#tactividadfr").text());
    ml = parseInt($("#tactividadml").text());
    mr = parseInt($("#tactividadmr").text());
    sr = parseInt($("#tactividads").text());
    $("#tactividadtot").text(fl + fr + ml + mr + sr);
  };

  this.cor1440_gen_rangoedadac = function($this) {
    var cid, col, ini, n;
    cid = $this.attr('id');
    if (typeof cid !== "undefined") {
      n = cid.lastIndexOf('_');
      col = cid.slice(n + 1);
      ini = cid.slice(0, cid.indexOf("attributes") + 10);
      cor1440_gen_rangoedadac_uno(ini, col);
      cor1440_gen_rangoedadac_tot();
    }
  };

  cor1440_gen_rangoedadc_todos = function() {
    var ini;
    ini = 'actividad_actividad_rangoedadac_attributes';
    cor1440_gen_rangoedadac_uno(ini, 'fl');
    cor1440_gen_rangoedadac_uno(ini, 'fr');
    cor1440_gen_rangoedadac_uno(ini, 'ml');
    cor1440_gen_rangoedadac_uno(ini, 'mr');
    cor1440_gen_rangoedadac_uno(ini, 's');
    return cor1440_gen_rangoedadac_tot();
  };

  this.cor1440_gen_identifica_ids_rangoedad = function(resp, rangos, idrf) {
    var i, r;
    for (i in resp) {
      r = resp[i];
      rangos[r.id] = [r.limiteinferior, r.limitesuperior];
      idrf[r.id] = -1;
    }
    return $('select[id^=actividad_actividad_rangoedadac_attributes_][id$=_rangoedadac_id]').each(function(i, v) {
      var fl1, fl2, ml1, ml2, nr, prl, sl1, sl2;
      nr = +$(this).val();
      if (idrf[nr] !== -1) {
        fl2 = $(this).parent().parent().find('input[id^=actividad_actividad_rangoedadac_attributes_][id$=_fl]').val();
        ml2 = $(this).parent().parent().find('input[id^=actividad_actividad_rangoedadac_attributes_][id$=_ml]').val();
        sl2 = $(this).parent().parent().find('input[id^=actividad_actividad_rangoedadac_attributes_][id$=_sl]').val();
        $(this).parent().parent().find('a.remove_fields').click();
        prl = '#actividad_actividad_rangoedadac_attributes_' + idrf[nr];
        fl1 = $(prl + '_fl').val();
        ml1 = $(prl + '_ml').val();
        sl1 = $(prl + '_sl').val();
        $(prl + '_fl').val(fl1 + fl2);
        $(prl + '_ml').val(ml1 + ml2);
        return $(prl + '_sl').val(sl1 + sl2);
      } else {
        return idrf[nr] = /actividad_actividad_rangoedadac_attributes_(.*)_rangoedadac_id/.exec($(this).attr('id'))[1];
      }
    });
  };

  this.cor1440_gen_recalcula_poblacion2 = function(root, resp, fsig) {
    var anioref, arf, diaref, idrf, mesref, rangos;
    rangos = {};
    idrf = {};
    cor1440_gen_identifica_ids_rangoedad(resp, rangos, idrf);
    arf = msip_partes_fecha_localizada($('#actividad_fecha_localizada').val(), window.formato_fecha);
    anioref = arf[0];
    mesref = arf[1];
    diaref = arf[2];
    $('[id^=actividad_asistencia_attributes][id$=_persona_attributes_anionac]').each(function(i, v) {
      var anionac, dianac, e, ida, idran, mesnac, r, ransin, sexo;
      if ($(this).parent().parent().parent().css('display') !== 'none') {
        ida = /actividad_asistencia_attributes_(.*)_persona_attributes_anionac/.exec($(this).attr('id'))[1];
        anionac = $(this).val();
        mesnac = $('[id=actividad_asistencia_attributes_' + ida + '_persona_attributes_mesnac]').val();
        dianac = $('[id=actividad_asistencia_attributes_' + ida + '_persona_attributes_dianac]').val();
        e = +msip_edadDeFechaNacFechaRef(anionac, mesnac, dianac, anioref, mesref, diaref);
        idran = -1;
        ransin = -1;
        for (i in rangos) {
          r = rangos[i];
          if ((r[0] <= e || r[0] === '' || r[0] === null) && (e <= r[1] || r[1] === '' || r[1] === null)) {
            idran = i;
          } else if (r[0] === -1) {
            ransin = i;
          }
        }
        if (idran === -1) {
          idran = ransin;
        }
        sexo = $(this).parent().parent().parent().find('[id^=actividad_asistencia_attributes][id$=_persona_attributes_sexo]:visible').val();
        if (idran < 0) {
          return alert('No pudo ponerse en un rango de edad');
        } else {
          return cor1440_gen_aumenta_poblacion(idrf, sexo, idran, 1);
        }
      }
    });
    if (fsig !== null) {
      return fsig(rangos, idrf);
    }
  };

  this.cor1440_gen_recalcula_poblacion = function(fsig) {
    if (fsig == null) {
      fsig = null;
    }
    if ($('[id^=actividad_asistencia_attributes]:visible').length > 0 || $('#actividad_casosjr').find('tr:visible').length > 0) {
      $('input[id^=actividad_actividad_rangoedadac_attributes_][id$=_fr]').each(function(i, v) {
        $(this).val(0);
        return $(this).prop('readonly', true);
      });
      $('input[id^=actividad_actividad_rangoedadac_attributes_][id$=_mr]').each(function(i, v) {
        $(this).val(0);
        return $(this).prop('readonly', true);
      });
      $('input[id^=actividad_actividad_rangoedadac_attributes_][id$=_s]').each(function(i, v) {
        $(this).val(0);
        return $(this).prop('readonly', true);
      });
    } else {
      $('input[id^=actividad_actividad_rangoedadac_attributes_][id$=_fr]').each(function(i, v) {
        $(this).val(0);
        return $(this).prop('readonly', false);
      });
      $('input[id^=actividad_actividad_rangoedadac_attributes_][id$=_mr]').each(function(i, v) {
        $(this).val(0);
        return $(this).prop('readonly', false);
      });
      $('input[id^=actividad_actividad_rangoedadac_attributes_][id$=_s]').each(function(i, v) {
        $(this).val(0);
        return $(this).prop('readonly', false);
      });
    }
    return msip_funcion_1p_tras_AJAX('admin/rangosedadac.json?filtro[bushabilitado]=Si&filtrar=Filtrar', {}, cor1440_gen_recalcula_poblacion2, fsig, 'solicitando rangos de edad a servidor');
  };

  this.cor1440_gen_super_recalcula_poblacion = function() {
    return cor1440_gen_recalcula_poblacion(null);
  };

  this.cor1440_gen_aumenta_fila_poblacion = function(idrf, idrango) {
    var e, uf;
    $('a[data-association-insertion-node$=actividad_rangoedadac]').click();
    uf = $('#actividad_rangoedadac').children().last();
    if (uf.length > 0) {
      e = uf.find('[id^=actividad_actividad_rangoedadac_attributes][id$=_rangoedadac_id]');
      idrf[idrango] = /actividad_actividad_rangoedadac_attributes_(.*)_rangoedadac_id/.exec(e.attr('id'))[1];
      return $('select[id^=actividad_actividad_rangoedadac_attributes_' + idrf[idrango] + '_rangoedadac_id]').val(idrango);
    }
  };

  this.cor1440_gen_aumenta_poblacion = function(idrf, sexo, idran, cantidad) {
    var fr, mr, pref, sr;
    if (+cantidad === 0) {
      return;
    }
    if (idrf[idran] === -1) {
      cor1440_gen_aumenta_fila_poblacion(idrf, idran);
    }
    pref = '#actividad_actividad_rangoedadac_attributes_' + idrf[idran];
    if (sexo === 'F') {
      fr = +$(pref + '_fr').val();
      $(pref + '_fr').val(fr + (+cantidad));
      cor1440_gen_rangoedadac($(pref + '_fr'));
    } else if (sexo === 'M') {
      mr = +$(pref + '_mr').val();
      $(pref + '_mr').val(mr + (+cantidad));
      cor1440_gen_rangoedadac($(pref + '_mr'));
    } else {
      sr = +$(pref + '_s').val();
      $(pref + '_s').val(sr + (+cantidad));
      cor1440_gen_rangoedadac($(pref + '_s'));
    }
    return $('#actividad_rangoedadac').find('input[id^=actividad_actividad_rangoedadac_attributes]').each(function() {
      if (+$(this).val() === 0) {
        return cor1440_gen_rangoedadac($(this));
      }
    });
  };

  this.cor1440_gen_fun_etiqueta_resultadopf = function(jv) {
    var et;
    et = jv.find('select[id$=_objetivopf_id] option[selected]').text() + jv.find('input[id$=_numero]').val();
    return et;
  };

  this.cor1440_gen_actualiza_objetivos = function(e, objetivo) {
    msip_actualiza_cuadros_seleccion_dependientes('objetivospf', '_id', '_numero', DEP_OBJETIVOPF, 'id', 'numero');
    return msip_actualiza_cuadros_seleccion_dependientes_fun_etiqueta('resultadospf', '_id', cor1440_gen_fun_etiqueta_resultadopf, DEP_RESULTADOPF, 'id', 'numero');
  };

  this.cor1440_gen_actualiza_resultados = function(e, resultado) {
    return msip_actualiza_cuadros_seleccion_dependientes_fun_etiqueta('resultadospf', '_id', cor1440_gen_fun_etiqueta_resultadopf, DEP_RESULTADOPF, 'id', 'numero');
  };

  this.cor1440_gen_actividad_actualiza_camposdinamicos = function(root) {
    var params, ruta;
    ruta = document.location.pathname;
    if (ruta.length === 0) {
      return;
    }
    if (ruta.startsWith(root.puntomontaje)) {
      ruta = ruta.substr(root.puntomontaje.length);
    }
    if (ruta[0] === '/') {
      ruta = ruta.substr(1);
    }
    params = {
      actividadpf_ids: $('#actividad_actividadpf_ids').val()
    };
    return msip_envia_ajax_datos_ruta_y_pinta(ruta, params, '#camposdinamicos', '#camposdinamicos');
  };

  this.cor1440_gen_llena_actividadpf_relacionadas = function(root, res) {
    var ac_relacionadas, val_actuales;
    ac_relacionadas = res.ac_ids_relacionadas;
    val_actuales = [];
    if (ac_relacionadas.length > 0) {
      $('#actividad_proyectofinanciero tr').not(':hidden').each(function() {
        val_actuales = $(this).find('select[id$=actividadpf_ids]').val();
        if (val_actuales.length > 0) {
          return ac_relacionadas = ac_relacionadas.concat(val_actuales);
        }
      });
      return $('#actividad_proyectofinanciero tr').not(':hidden').each(function() {
        $(this).find('select[id$=actividadpf_ids]').val(ac_relacionadas);
        return $(this).find('select[id$=actividadpf_ids]').each(function(el) {
          return Msip__Motor.configurarElementoTomSelect(el);
        });
      });
    }
  };

  this.cor1440_gen_actividad_actualiza_mismotipo = function(root, res) {
    var acids, params, prids;
    if (res.selected != null) {
      acids = [''];
      $('select[id^=actividad_actividad_proyectofinanciero_attributes_][id$=_actividadpf_ids]').each(function() {
        var t;
        t = $(this);
        if (t.parent().parent().parent().not(':hidden').length > 0) {
          return acids = acids.concat(t.val());
        }
      });
      prids = [];
      $('#actividad_proyectofinanciero tr').not(':hidden').each(function() {
        var idex;
        idex = $(this).find('select[id$=proyectofinanciero_id]').val();
        return prids.push(idex);
      });
      params = {
        actividadpf_ids: acids,
        proyectofinanciero_ids: prids
      };
      return msip_ajax_recibe_json(root, 'api/actividades/relacionadas', params, cor1440_gen_llena_actividadpf_relacionadas);
    }
  };

  this.cor1440_gen_llena_actividadpf_conancestros = function(root, res) {
    var ac_conancestros;
    ac_conancestros = res.ac_ids_conancestros;
    return $('select[id^=actividad_actividad_proyectofinanciero_attributes][id$=actividadpf_ids]').each(function() {
      var actuales, int, posibles;
      actuales = $(this).val();
      posibles = [];
      $(this).find('option').each(function() {
        return posibles.push(+this.value);
      });
      int = posibles.filter(function(v) {
        return ac_conancestros.includes(v);
      });
      $(this).val(int);
      Msip__Motor.configurarElementoTomSelect(this);
      if (int.length !== actuales.length) {
        return $(this).trigger('cor1440_gen:conancestros_actualizado');
      }
    });
  };

  this.cor1440_gen_actividad_actualiza_conancestros = function(root, res) {
    var acids, params, prids;
    if (res.selected != null) {
      acids = [''];
      $('select[id^=actividad_actividad_proyectofinanciero_attributes_][id$=_actividadpf_ids]').each(function() {
        var t;
        t = $(this);
        if (t.parent().parent().parent().not(':hidden').length > 0) {
          return acids = acids.concat(t.val());
        }
      });
      prids = [];
      $('#actividad_proyectofinanciero tr').not(':hidden').each(function() {
        var idex;
        idex = $(this).find('select[id$=proyectofinanciero_id]').val();
        return prids.push(idex);
      });
      params = {
        actividadpf_ids: acids,
        proyectofinanciero_ids: prids
      };
      return msip_ajax_recibe_json(root, 'actividadespf/conancestros', params, cor1440_gen_llena_actividadpf_conancestros);
    }
  };

  this.cor1440_gen_actividad_actualiza_camposdinamicos2 = function(root) {
    var acids, params, ruta;
    ruta = document.location.pathname;
    if (ruta.length === 0) {
      return;
    }
    if (ruta.startsWith(root.puntomontaje)) {
      ruta = ruta.substr(root.puntomontaje.length);
    }
    if (ruta[0] === '/') {
      ruta = ruta.substr(1);
    }
    acids = [''];
    $('select[id^=actividad_actividad_proyectofinanciero_attributes_][id$=_actividadpf_ids]').each(function() {
      var t;
      t = $(this);
      if (t.parent().parent().parent().not(':hidden').length > 0) {
        return acids = acids.concat(t.val());
      }
    });
    params = {
      actividadpf_ids: acids
    };
    return msip_envia_ajax_datos_ruta_y_pinta(ruta, params, '#camposdinamicos', '#camposdinamicos');
  };

  this.cor1440_gen_actividad_actualiza_actividadpf_pf = function(root, proyectofinanciero_id) {
    var params;
    params = {
      pfl: [proyectofinanciero_id]
    };
    return msip_llena_select_con_AJAX2('actividadespf', params, 'actividad_actividadpf_ids', 'con Actividades de convenio', root, 'id', 'nombre', cor1440_gen_actividad_actualiza_camposdinamicos);
  };

  this.cor1440_gen_actividad_actualiza_actividadpf = function(root) {
    var params;
    params = {
      pfl: $('#actividad_proyectofinanciero_ids').val()
    };
    return msip_llena_select_con_AJAX2('actividadespf', params, 'actividad_actividadpf_ids', 'con Actividades de convenio', root, 'id', 'nombre', cor1440_gen_actividad_actualiza_camposdinamicos);
  };

  this.cor1440_gen_actividad_actualiza_pf = function(root) {
    var params;
    params = {
      fecha: $('#actividad_fecha_localizada').val()
    };
    return msip_llena_select_con_AJAX2('proyectosfinancieros', params, 'actividad_proyectofinanciero_ids', 'con Convenios financiados', root, 'id', 'nombre', cor1440_gen_actividad_actualiza_actividadpf);
  };

  this.cor1440_gen_actividad_actualiza_pf2 = function(root, pfpend) {
    var pfex, pfpendid;
    if (pfpend == null) {
      pfpend = null;
    }
    if (pfpend !== null) {
      pfpendid = pfpend.map((function(_this) {
        return function(e) {
          return e.id;
        };
      })(this));
      pfex = [];
      $('#actividad_proyectofinanciero tr').not(':hidden').each(function() {
        var idex;
        idex = $(this).find('select[id$=proyectofinanciero_id]').val();
        if (!(pfpendid.includes(+idex))) {
          return $(this).remove();
        }
      });
    }
    return cor1440_gen_actividad_actualiza_camposdinamicos2(root);
  };

  this.cor1440_gen_actividad_limita_pf_actualiza_actividadpf = function(root, pfpend) {
    var pfex, pfpendid;
    if (pfpend == null) {
      pfpend = null;
    }
    if (pfpend !== null) {
      pfpendid = pfpend.map((function(_this) {
        return function(e) {
          return e.id;
        };
      })(this));
      pfex = [];
      return $('#actividad_proyectofinanciero tr').not(':hidden').each(function() {
        var idex;
        idex = $(this).find('select[id$=proyectofinanciero_id]').val();
        if (!(pfpendid.includes(+idex))) {
          return $(this).remove();
        }
      });
    }
  };

  this.cor1440_gen_actividad_actualiza_fecha2 = function(root) {
    var params;
    params = {
      fecha: $('#actividad_fecha_localizada').val()
    };
    return msip_funcion_tras_AJAX('proyectosfinancieros', params, cor1440_gen_actividad_actualiza_pf2, 'con Convenios Financiados', root);
  };

  this.cor1440_gen_actividad_actualiza_pf_op = function(root, resp, objetivo) {
    var el, idsel, nuevasop, otrospfid;
    otrospfid = [];
    objetivo.siblings().not(':hidden').find('select[id$=proyectofinanciero_id]').each(function() {
      return otrospfid.push(+this.value);
    });
    idsel = objetivo.find('select').attr('id');
    resp.sort(function(a, b) {
      if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) {
        return -1;
      } else if (a.nombre.toLowerCase() > a.nombre.toLowerCase()) {
        return 1;
      } else {
        return 0;
      }
    });
    nuevasop = [];
    resp.forEach(function(r) {
      if (!otrospfid.includes(+r.id)) {
        return nuevasop.push({
          'id': +r.id,
          'nombre': r.nombre
        });
      }
    });
    msip_remplaza_opciones_select(idsel, nuevasop, true, 'id', 'nombre', true);
    $('#' + idsel).val('');
    el = document.querySelector('#' + idsel);
    Msip__Motor.configurarElementoTomSelect(el);
  };

  this.cor1440_gen_actividad_actualiza_sel_rango = function(root, resp, objetivo) {
    var idsel, nuevasop, otrospfid, valac, valsel;
    otrospfid = [];
    objetivo.siblings().not(':hidden').find('select').each(function() {
      return otrospfid.push(+this.value);
    });
    idsel = objetivo.find('select').attr('id');
    valac = +$('#' + idsel).val();
    valsel = 7;
    nuevasop = [];
    resp.forEach(function(r) {
      if (!otrospfid.includes(+r.id)) {
        nuevasop.push({
          'id': +r.id,
          'nombre': r.nombre
        });
        if (r.id === valac) {
          return valsel = valac;
        }
      }
    });
    msip_remplaza_opciones_select(idsel, nuevasop, true, 'id', 'nombre', false);
    $('#' + idsel).val(valsel);
    $('#' + idsel).trigger('chosen:updated');
  };

  this.cor1440_gen_persona_actualiza_camposdinamicos = function(root) {
    var params, pfids, ruta;
    ruta = document.location.pathname;
    if (ruta.length === 0) {
      return;
    }
    if (ruta.startsWith(root.puntomontaje)) {
      ruta = ruta.substr(root.puntomontaje.length);
    }
    if (ruta[0] === '/') {
      ruta = ruta.substr(1);
    }
    pfids = $('#persona_proyectofinanciero_ids').val();
    if (pfids.length === 0) {
      pfids = [-1];
    }
    params = {
      proyectofinanciero_ids: pfids
    };
    return msip_envia_ajax_datos_ruta_y_pinta(ruta, params, '#acordeon-caracterizacion', '#acordeon-caracterizacion');
  };

  this.cor1440_gen_instala_recalcula_poblacion = function() {
    $(document).on('change', '[id^=actividad_asistencia_attributes][id$=_persona_attributes_sexo]:visible', function(e) {
      if (typeof cor1440_gen_recalcula_poblacion === 'function') {
        return cor1440_gen_recalcula_poblacion();
      }
    });
    $(document).on('change', '[id^=actividad_asistencia_attributes][id$=_persona_attributes_anionac]:visible', function(e) {
      if (typeof cor1440_gen_recalcula_poblacion === 'function') {
        return cor1440_gen_recalcula_poblacion();
      }
    });
    $(document).on('change', '[id^=actividad_asistencia_attributes][id$=_persona_attributes_mesnac]:visible', function(e) {
      if (typeof cor1440_gen_recalcula_poblacion === 'function') {
        return cor1440_gen_recalcula_poblacion();
      }
    });
    $(document).on('change', '[id^=actividad_asistencia_attributes][id$=_persona_attributes_dianac]:visible', function(e) {
      if (typeof cor1440_gen_recalcula_poblacion === 'function') {
        return cor1440_gen_recalcula_poblacion();
      }
    });
    $('#asistencia').on('cocoon:after-remove', function(e, papa) {
      if (typeof cor1440_gen_recalcula_poblacion === 'function') {
        return cor1440_gen_recalcula_poblacion();
      }
    });
    return $(document).on('cor1440gen:autocompletado-asistente', function(e, papa) {
      if (typeof cor1440_gen_recalcula_poblacion === 'function') {
        return cor1440_gen_recalcula_poblacion();
      }
    });
  };

  this.cor1440_gen_prepara_eventos_comunes = function(root, opciones) {
    if (opciones == null) {
      opciones = {};
    }
    this.cor1440_gen_preparamindicadorespf(root);
    $(document).on('click', '.envia_filtrar', function(e) {
      var a, f;
      f = e.target.form;
      a = f.action;
      if (a.endsWith(".pdf")) {
        $(f).attr("action", a.substr(0, a.length - 4));
        return $(f).removeAttr("target");
      }
    });
    $(document).on('click', '.envia_generar_pdf', function(e) {
      var a, f;
      f = e.target.form;
      a = f.action;
      if (!a.endsWith(".pdf")) {
        $(f).attr("action", a + ".pdf");
        return $(f).attr("target", "_blank");
      }
    });
    $(document).on('change', 'input[id^=actividad_actividad_rangoedadac_attributes]', function(e) {
      return cor1440_gen_rangoedadac($(this));
    });
    $(document).on('cocoon:after-remove', function(e) {
      return cor1440_gen_rangoedadc_todos();
    });
    if (!opciones['sin_eventos_cambia_proyecto']) {
      $('#actividad_fecha_localizada').on('change', function(ev) {
        return cor1440_gen_actividad_actualiza_fecha2(root);
      });
      $('#actividad_fecha_localizada').datepicker({
        format: root.formato_fecha,
        autoclose: true,
        todayHighlight: true,
        language: 'es'
      }).on('changeDate', function(ev) {
        return cor1440_gen_actividad_actualiza_fecha2(root);
      });
      $(document).on('cocoon:after-insert', '#actividad_proyectofinanciero', function(e, objetivo) {
        var params;
        Msip__Motor.configurarElementosTomSelect();
        window.Msip__Motor.configurarElementosTomSelect();
        params = {
          fecha: $('#actividad_fecha_localizada').val()
        };
        if ($('#actividad_grupo_ids').length > 0) {
          params['grupo_ids'] = $('#actividad_grupo_ids').val();
        }
        return msip_funcion_1p_tras_AJAX('proyectosfinancieros', params, cor1440_gen_actividad_actualiza_pf_op, objetivo, 'con Convenios Financiados', root);
      });
      $(document).on('cocoon:after-insert', '#actividad_rangoedadac', function(e, objetivo) {
        var params;
        params = {};
        return msip_funcion_1p_tras_AJAX('admin/rangosedadac', params, cor1440_gen_actividad_actualiza_sel_rango, objetivo, 'con Rangos de edad', root);
      });
      $(document).on('change', 'select[id^=actividad_actividad_rangoedadac_attributes_][id$=rangoedadac_id]', function(e, res) {
        $(e.target).attr('disabled', true);
        return Msip__Motor.configurarElementoTomSelect(e.target);
      });
      $(document).on('cocoon:after-remove', '#actividad_proyectofinanciero', function(e, objetivo) {
        return cor1440_gen_actividad_actualiza_camposdinamicos2(root);
      });
      $(document).on('change', 'select[id^=actividad_actividad_proyectofinanciero_attributes_][id$=proyectofinanciero_id]', function(e, res) {
        var el, idac, params;
        $(e.target).attr('disabled', true);
        el = document.createElement('input');
        el.setAttribute('name', e.target.name);
        el.setAttribute('type', 'hidden');
        el.setAttribute('value', e.target.value);
        e.target.parentNode.append(el);
        Msip__Motor.configurarElementoTomSelect(e.target);
        idac = $(e.target).parent().parent().parent().find('select[id$=actividadpf_ids]').attr('id');
        params = {
          pfl: [+e.target.value]
        };
        return msip_llena_select_con_AJAX2('actividadespf', params, idac, 'con Actividades de convenio ' + e.target.value, root, 'id', 'nombre', null);
      });
      $("form[id^=edit_actividad]").submit(function() {
        $('select[id^=actividad_actividad_proyectofinanciero_attributes_][id$=_proyectofinanciero_id]').removeAttr('disabled');
        $('select[id^=actividad_actividad_rangoedadac_attributes_][id$=_rangoedadac_id]').removeAttr('disabled');
        return $('select[id^=actividad_detallefinanciero_attributes_][id$=_convenioactividad]').removeAttr('disabled');
      });
      $(document).on('change', 'select[id^=actividad_actividad_proyectofinanciero_attributes_][id$=actividadpf_ids]', function(e, res) {
        if (typeof root.cor1440_gen_activa_autocompleta_mismotipo !== 'undefined' && root.cor1440_gen_activa_autocompleta_mismotipo === true) {
          cor1440_gen_actividad_actualiza_mismotipo(root, res);
        }
        if (typeof root.cor1440_gen_activa_autocompleta_conancestros !== 'undefined' && root.cor1440_gen_activa_autocompleta_conancestros === true) {
          cor1440_gen_actividad_actualiza_conancestros(root, res);
        }
        return cor1440_gen_actividad_actualiza_camposdinamicos2(root);
      });
    }
    $(document).on('change', '#objetivospf [id$=_numero]', cor1440_gen_actualiza_objetivos);
    $(document).on('cocoon:after-remove', '#objetivospf', cor1440_gen_actualiza_objetivos);
    $(document).on('cocoon:after-insert', '#objetivospf', cor1440_gen_actualiza_objetivos);
    $(document).on('cocoon:before-remove', '#objetivospf', function(e, objetivo) {
      return msip_intenta_eliminar_fila(objetivo, '/objetivospf/', DEP_OBJETIVOPF);
    });
    $(document).on('cocoon:before-remove', '#indicadoresobjetivos', function(e, indicador) {
      return msip_intenta_eliminar_fila(indicador, '/indicadorespf/', DEP_INDICADORPF);
    });
    $(document).on('change', '#indicadoresobjetivos [id$=_id]', function(e, result) {
      return msip_enviarautomatico_formulario($('form'), 'POST', 'json', false, 'Enviar');
    });
    $(document).on('cocoon:after-insert', '#indicadoresobjetivos', cor1440_gen_actualiza_objetivos);
    $(document).on('change', '#resultadospf [id$=_numero]', cor1440_gen_actualiza_resultados);
    $(document).on('cocoon:after-remove', '#resultadospf', cor1440_gen_actualiza_resultados);
    $(document).on('cocoon:after-insert', '#resultadospf', cor1440_gen_actualiza_objetivos);
    $(document).on('cocoon:before-remove', '#resultadospf', function(e, resultado) {
      return msip_intenta_eliminar_fila(resultado, '/resultadospf/', DEP_RESULTADOPF);
    });
    $(document).on('change', '#resultadospf [id$=_id]', function(e, result) {
      return msip_enviarautomatico_formulario($('form'), 'POST', 'json', false, 'Enviar');
    });
    $(document).on('cocoon:before-remove', '#indicadorespf', function(e, indicador) {
      return msip_intenta_eliminar_fila(indicador, '/indicadorespf/', DEP_INDICADORPF);
    });
    $(document).on('change', '#indicadorespf [id$=_id]', function(e, result) {
      return msip_enviarautomatico_formulario($('form'), 'POST', 'json', false, 'Enviar');
    });
    $(document).on('cocoon:after-insert', '#indicadorespf', cor1440_gen_actualiza_resultados);
    $(document).on('cocoon:after-insert', '#actividadespf', cor1440_gen_actualiza_resultados);
    $(document).on('change', '#actividadespf [id$=_id]', function(e, result) {
      return msip_enviarautomatico_formulario($('form'), 'POST', 'json', false, 'Enviar');
    });
    Cor1440GenAutocompletaAjaxAsistentes.iniciar();
    $(document).on('change', '[data-enviar-haciendo-click]', function(e, result) {
      return $('[name=' + $(this).data('enviar-haciendo-click') + ']').trigger('click');
    });
    $(document).on('cocoon:after-insert', '#pmindicadorpf', function(e, objetivo) {
      var cuenta, dids, idpm;
      dids = $.map($('[name^=datosintermediosti]'), (function(_this) {
        return function(e) {
          return +e.value;
        };
      })(this));
      cuenta = objetivo.parent().parent().find('input[name^=datosintermediosti]').length - 1;
      idpm = +objetivo.find('input[id^=mindicadorpf_pmindicadorpf_attributes_][id$=_id]')[0].id.match(/mindicadorpf_pmindicadorpf_attributes_([0-9]*)_id/)[1];
      return objetivo.parent().parent().find('input[name^=datosintermediosti]').each(function(d) {
        $(objetivo.children('td')[4]).before('<td> <div class="input float optional mindicadorpf_pmindicadorpf_datointermedioti_pmindicadorpf_valor"><input class="numeric float optional form-control span10" type="number" step="any" name="mindicadorpf[pmindicadorpf_attributes][' + idpm + '][datointermedioti_pmindicadorpf_attributes][' + cuenta + '][valor]" id="mindicadorpf_pmindicadorpf_attributes_' + idpm + '_datointermedioti_pmindicadorpf_attributes_' + cuenta + '_valor" style="background-color: rgb(255, 255, 255); color: rgb(0, 0, 0);"></div><div class="input hidden mindicadorpf_pmindicadorpf_datointermedioti_pmindicadorpf_rutaevidencia"><input class="hidden form-control span10" type="hidden" name="mindicadorpf[pmindicadorpf_attributes][' + idpm + '][datointermedioti_pmindicadorpf_attributes][' + cuenta + '][rutaevidencia]" id="mindicadorpf_pmindicadorpf_attributes_' + idpm + '_datointermedioti_pmindicadorpf_attributes_' + cuenta + '_rutaevidencia" style="background-color: rgb(255, 255, 255); color: rgb(0, 0, 0);"></div><input class="hidden form-control span10" type="hidden" value="' + dids[cuenta] + '" name="mindicadorpf[pmindicadorpf_attributes][' + idpm + '][datointermedioti_pmindicadorpf_attributes][' + cuenta + '][datointermedioti_id]" id="mindicadorpf_pmindicadorpf_attributes_' + idpm + '_datointermedioti_pmindicadorpf_attributes_' + cuenta + '_datointermedioti_id"> <input class="hidden form-control span10" type="hidden" value="" name="mindicadorpf[pmindicadorpf_attributes][' + idpm + '][datointermedioti_pmindicadorpf_attributes][' + cuenta + '][id]" id="mindicadorpf_pmindicadorpf_attributes_' + idpm + '_datointermedioti_pmindicadorpf_attributes_' + cuenta + '_id"></td>');
        return cuenta--;
      });
    });
    $(document).on('change', 'select[id=persona_proyectofinanciero_ids]', function(e, res) {
      return cor1440_gen_persona_actualiza_camposdinamicos(root);
    });
    if (!opciones['sin_eventos_recalcular_poblacion']) {
      cor1440_gen_instala_recalcula_poblacion();
    }
    cor1440_gen_eventos_duracion();
    cor1440_gen_eventos_montospesos();
  };

}).call(this);
// This is a manifest file that'll be compiled into application.js, which will include all the files
// listed below.
//
// Any JavaScript/Coffee file within this directory, lib/assets/javascripts, vendor/assets/javascripts,
// or vendor/assets/javascripts of plugins, if any, can be referenced here using a relative path.
//
// It's not advisable to add code directly here, but if you do, it'll appear at the bottom of the
// compiled file.
//
// Read Sprockets README (https://github.com/sstephenson/sprockets#sprockets-directives) for details
// about supported directives.
//







msip_prepara_eventos_comunes(window)
;
// This is a manifest file that'll be compiled into application.js, which will include all the files
// listed below.
//
// Any JavaScript/Coffee file within this directory, lib/assets/javascripts, vendor/assets/javascripts,
// or vendor/assets/javascripts of plugins, if any, can be referenced here using a relative path.
//
// It's not advisable to add code directly here, but if you do, it'll appear at the bottom of the
// compiled file.
//
// Read Sprockets README (https://github.com/sstephenson/sprockets#sprockets-directives) for details
// about supported directives.
//




;
