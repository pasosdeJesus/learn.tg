# frozen_string_literal: true

class AgregaCursosEsc < ActiveRecord::Migration[7.2]
  def up
    execute(<<~SQL)
            INSERT INTO public.cor1440_gen_proyectofinanciero (id, nombre, observaciones, fechainicio, fechacierre, responsable_id, fechacreacion, fechadeshabilitacion, created_at, updated_at, compromisos, monto, sectorapc_id, titulo, poromision, fechaformulacion, fechaaprobacion, fechaliquidacion, estado, dificultad, tipomoneda_id, saldoaejecutarp, centrocosto, tasaej, montoej, aportepropioej, aporteotrosej, presupuestototalej, subtitulo, idioma, "prefijoRuta", imagen, "creditoImagen", "enlaceImagen", "altImagen", "resumenMd", "sinBilletera", "conBilletera") VALUES (1, 'Una relación con Jesús', NULL, '2024-07-01', NULL, 1, NULL, NULL, '2024-07-14 00:24:13.852896', '2024-09-05 09:09:33.655404', NULL, 1.0, NULL, 'Una relación con Jesús', NULL, '2024-06-15', NULL, NULL, 'E', 'N', NULL, NULL, '', 1, 0, 0, 0, 0, 'Cuatro breves guías para empezar una relación con Jesús como Señor, Salvador y amigo', 'es', '/una-relacion-con-Jesus', '/img/Jn6_col.jpg', 'Dibujo de Juan Carlos Partidas', 'https://misdibujoscristianos.blogspot.com/', 'Dibujo de Jesús con pan y amigos', 'Jesús es más que una religión o una denominación, te invitamos a conocerlo de manera personal.

      Si quieres retroalimentar, preguntar o conocer más puedes escribir por WhatsApp o Telegram al +57 316 5383162 --si quieres una
      videollamado propon un horario.

      Si lo deseas también podemos ponerte en contacto con una iglesia cercana.', true, true);



      INSERT INTO public.cor1440_gen_objetivopf (id, proyectofinanciero_id, numero, objetivo) VALUES (1, 1, 'O1', 'Facilitar entablar una relación con Jesús');


      INSERT INTO public.cor1440_gen_resultadopf (id, proyectofinanciero_id, objetivopf_id, numero, resultado) VALUES (1, 1, 1, 'R1', 'Facilitar relación personal mediante el Santo Espíritu y la lectura de la Biblia  y oración');
      INSERT INTO public.cor1440_gen_resultadopf (id, proyectofinanciero_id, objetivopf_id, numero, resultado) VALUES (2, 1, 1, 'R2', 'Facilitar relación comunitaria mediante el Santo Espíritu, la interacción con otros creyentes y participando en una iglesia');


      INSERT INTO public.cor1440_gen_actividadpf (id, proyectofinanciero_id, nombrecorto, titulo, descripcion, resultadopf_id, actividadtipo_id, formulario_id, heredade_id, rutamd, "posfijoRuta") VALUES (1, 1, 'G1', 'No tengas miedo - Marcos 6:45-52', '', 1, NULL, NULL, NULL, NULL, '/cursos/relacion/Guia1NoTengasMiedo.md');
      INSERT INTO public.cor1440_gen_actividadpf (id, proyectofinanciero_id, nombrecorto, titulo, descripcion, resultadopf_id, actividadtipo_id, formulario_id, heredade_id, rutamd, "posfijoRuta") VALUES (2, 1, 'G2', 'Encuentro con Jesús - Juan 4:1-26', '', 1, NULL, NULL, NULL, NULL, '/cursos/relacion/Guia2EncuentroConJesus.md');
      INSERT INTO public.cor1440_gen_actividadpf (id, proyectofinanciero_id, nombrecorto, titulo, descripcion, resultadopf_id, actividadtipo_id, formulario_id, heredade_id, rutamd, "posfijoRuta") VALUES (3, 1, 'G3', 'Ve a encontrarte con Jesús - Juan 11:17-27', '', 1, NULL, NULL, NULL, NULL, '/cursos/relacion/Guia3VeAEncontrarteConJesus.md');
      INSERT INTO public.cor1440_gen_actividadpf (id, proyectofinanciero_id, nombrecorto, titulo, descripcion, resultadopf_id, actividadtipo_id, formulario_id, heredade_id, rutamd, "posfijoRuta") VALUES (4, 1, 'G4', 'Hablando con Dios - Hechos 8:26-39', '', 1, NULL, NULL, NULL, NULL, '/cursos/relacion/Guia4HablandoConDios.md');
      INSERT INTO public.cor1440_gen_actividadpf (id, proyectofinanciero_id, nombrecorto, titulo, descripcion, resultadopf_id, actividadtipo_id, formulario_id, heredade_id, rutamd, "posfijoRuta") VALUES (5, 101, 'I1', 'Reunirse con otro creyente a estudiar y orar', '', 103, NULL, NULL, NULL, NULL, NULL);
      INSERT INTO public.cor1440_gen_actividadpf (id, proyectofinanciero_id, nombrecorto, titulo, descripcion, resultadopf_id, actividadtipo_id, formulario_id, heredade_id, rutamd, "posfijoRuta") VALUES (6, 101, 'I2', 'Asistir a una iglesia', '', 103, NULL, NULL, NULL, NULL, NULL);




    SQL
  end

  def down
    execute(<<-SQL)
      DELETE FROM public.cor1440_gen_actividadpf WHERE id>='1' AND id<='6';
      DELETE FROM public.cor1440_gen_resultadopf WHERE id>='1' AND id<='2';
      DELETE FROM public.cor1440_gen_objetivopf WHERE id='1';
      DELETE FROM public.cor1440_gen_proyectofinanciero WHERE id='1';
    SQL
  end
end
