class Ability  < Cor1440Gen::Ability

  def tablasbasicas 
    Msip::Ability::BASICAS_PROPIAS + BASICAS_PROPIAS - [
      ['Msip', 'fuenteprensa'], 
      ['Msip', 'oficina'], 
      ['Cor1440Gen', 'proyecto'], 
      ['Msip', 'tdocumento'], 
      ['Msip', 'trelacion'], 
      ['Msip', 'tsitio']
    ]
  end

  # Autorizacion con CanCanCan
  def initialize(usuario = nil)
    # Sin autenticación puede consultarse información geográfica
    # Cursos para todos
    can(:read, [
      Msip::Pais, 
      Msip::Departamento, 
      Msip::Municipio, 
      Msip::Centropoblado
    ])
    can(:read, Cor1440Gen::Proyectofinanciero)
    can(:read, Heb412Gen::Doc)

    if !usuario || usuario.fechadeshabilitacion
      return
    end

    can([:nuevo, :new], Cor1440Gen::Actividad)
    can([:nuevo, :new], Cor1440Gen::Actividadpf)
    can(:read, Cor1440Gen::Rangoedadac)

    can(:read, Heb412Gen::Doc)
    can(:read, Heb412Gen::Plantilladoc)
    can(:read, Heb412Gen::Plantillahcm)
    can(:read, Heb412Gen::Plantillahcr)

    can(:descarga_anexo, Msip::Anexo)
    can(:contar, Msip::Ubicacion)
    can(:buscar, Msip::Ubicacion)
    can(:lista, Msip::Ubicacion)
    can(:nuevo, Msip::Ubicacion)

    if !usuario.nil? && !usuario.rol.nil?
      case usuario.rol
      when ROLOPERADOR

        can(:manage, Cor1440Gen::Actividadpf)
        can :manage, Cor1440Gen::Asistencia
        presponsable = Cor1440Gen::Proyectofinanciero.where(
          responsable_id: usuario.id,
        ).map(&:id)
        can([:create, :destroy], [
          Cor1440Gen::Indicadorpf,
          Cor1440Gen::Objetivopf,
          Cor1440Gen::Resultadopf
        ])

        can(
          [:read, :edit, :update],
          Cor1440Gen::Proyectofinanciero,
          responsable: { id: usuario.id },
        )

        can(:manage, [
          Cor1440Gen::Actividadpf,
          Cor1440Gen::ActividadProyectofinanciero,
          Cor1440Gen::AnexoProyectofinanciero,
          Cor1440Gen::Desembolso,
          Cor1440Gen::Informeauditoria,
          Cor1440Gen::Informefinanciero,
          Cor1440Gen::Informenarrativo,
          Cor1440Gen::ProyectofinancieroUsuario
        ])
        # Convención: Los proyectos sin usuarios se suponen como
        # institucionales o para todos los usuarios
        psinusuario = Cor1440Gen::Proyectofinanciero.all.map(&:id) -
          Cor1440Gen::ProyectofinancieroUsuario.all.map(
            &:proyectofinanciero_id
          ).uniq
          can(
            :read,
            Cor1440Gen::Proyectofinanciero,
            id: psinusuario,
          )
          # Puede ver proyectos en cuyo equipo de trabajo este
          penequipo1 = Cor1440Gen::ProyectofinancieroUsuario.where(
            usuario_id: usuario.id,
          ).map(&:proyectofinanciero_id).uniq
          penequipo = penequipo1 | presponsable
          penequipo.uniq!
          # Según
          # https://github.com/CanCanCommunity/cancancan/blob/develop/docs/Defining-Abilities:-Best-Practices.md
          # Al poner varios corresponde al OR
          # Poner varios hashes en una línea es un AND
          can(
            :read,
            Cor1440Gen::Proyectofinanciero,
            id: penequipo,
          )

          can(
            :manage,
            Cor1440Gen::Actividad,
            responsable: { id: usuario.id },
          )
          can(
            :read,
            Cor1440Gen::Actividad,
            actividad_proyectofinanciero: { proyectofinanciero_id: penequipo },
          )
          can :manage, Cor1440Gen::Asistencia

          # Responsable de un proyecto puede eliminar  y editar actividades
          # del mismo
          can(
            :manage,
            Cor1440Gen::Actividad,
            actividad_proyectofinanciero: { proyectofinanciero_id: presponsable },
          )

          can(:read, Cor1440Gen::Efecto)
          can(:read, Cor1440Gen::FormularioTipoindicador)
          can(:read, Cor1440Gen::Informe)

          can(
            [:new, :create, :read, :index, :edit, :update],
            Msip::Orgsocial,
          )
          can(:manage, Msip::Persona)

      when Ability::ROLADMIN, Ability::ROLDIR
        can(:manage, [
          Cor1440Gen::Actividad,
          Cor1440Gen::ActividadProyectofinanciero,
          Cor1440Gen::AnexoProyectofinanciero,
          Cor1440Gen::Asistencia,
          Cor1440Gen::Actividadpf,
          Cor1440Gen::Desembolso,
          Cor1440Gen::Efecto,
          Cor1440Gen::Financiador,
          Cor1440Gen::FormularioTipoindicador,
          Cor1440Gen::Indicadorpf,
          Cor1440Gen::Informe,
          Cor1440Gen::Informeauditoria,
          Cor1440Gen::Informefinanciero,
          Cor1440Gen::Informenarrativo,
          Cor1440Gen::Mindicadorpf,
          Cor1440Gen::Objetivopf,
          Cor1440Gen::Pmindicadorpf, 
          Cor1440Gen::Proyectofinanciero,
          Cor1440Gen::ProyectofinancieroUsuario,
          Cor1440Gen::Resultadopf,
          Cor1440Gen::Tipoindicador,

          Heb412Gen::Doc,
          Heb412Gen::Plantilladoc,
          Heb412Gen::Plantillahcm,
          Heb412Gen::Plantillahcr,

          Mr519Gen::Campo,
          Mr519Gen::Formulario,
          Mr519Gen::Encuestausuario,

          Msip::Orgsocial,
          Msip::Sectororgsocial,
          Msip::Persona,

          Usuario,
          :tablasbasicas
        ])
        tablasbasicas.each do |t|
          c = Ability.tb_clase(t)
          can(:manage, c)
        end
      end
    end

    cannot :read, Msip::Oficina

  end # initialize

end

