

INSERT INTO public.usuario 
	(nusuario, nombre, email, encrypted_password, password, 
  fechacreacion, created_at, updated_at, rol) 
	VALUES ('cor1440', 'cor1440', 'cor1440@localhost', 
	'$2a$10$q0KcAa.H6.3VrXeKTJHa/ue8uT0y7WVKKHlAVor.Nejpz1OAgAQOq',
	'', '2014-08-26', '2014-08-26', '2014-08-26', 1);


INSERT INTO public.cor1440_gen_proyectofinanciero (id, nombre, observaciones, fechainicio, fechacierre, responsable_id, fechacreacion, fechadeshabilitacion, created_at, updated_at, compromisos, monto, sectorapc_id, titulo, poromision, fechaformulacion, fechaaprobacion, fechaliquidacion, estado, dificultad, tipomoneda_id, saldoaejecutarp, centrocosto, tasaej, montoej, aportepropioej, aporteotrosej, presupuestototalej, subtitulo, idioma, "prefijoRuta", imagen, "creditoImagen", "enlaceImagen", "altImagen", "resumenMd", "sinBilletera", "conBilletera", "creditosMd", "porPagar") VALUES (1, 'Una relación con Jesús', NULL, '2024-07-01', NULL, 1, NULL, NULL, '2024-07-14 00:24:13.852896', '2025-02-01 18:03:37.829339', NULL, 1.0, NULL, 'Una relación con Jesús', NULL, '2024-06-15', NULL, NULL, 'E', 'N', NULL, NULL, '', 1, 0, 0, 0, 0, 'Cuatro breves guías para empezar una relación con Jesús como Señor, Salvador y amigo', 'es', '/una-relacion-con-Jesus', '/img/Jn6_col.jpg', 'Dibujo de Juan Carlos Partidas', 'https://misdibujoscristianos.blogspot.com/', 'Dibujo de Jesús con pan y amigos', 'Jesús es más que una religión o una denominación, te invitamos a conocerlo de manera personal.

Si quieres retroalimentar, preguntar o conocer más puedes escribir por WhatsApp o Telegram al +57 316 5383162 --si quieres una videollamado propon un horario.

Si lo deseas también podemos sugerirte una iglesia cercana.', true, true, 'Preparado por [Vladimir Támara Patiño](mailto:vtamara@pasosdeJesus.org) y 
[Julián Martinez](mailto:julianrz98@gmail.co). Este es contenido abierto con licencia. 
[CC-BY Internacional 4.0](https://creativecommons.org/licenses/by/4.0/)', NULL);


INSERT INTO public.cor1440_gen_proyectofinanciero (id, nombre, observaciones, fechainicio, fechacierre, responsable_id, fechacreacion, fechadeshabilitacion, created_at, updated_at, compromisos, monto, sectorapc_id, titulo, poromision, fechaformulacion, fechaaprobacion, fechaliquidacion, estado, dificultad, tipomoneda_id, saldoaejecutarp, centrocosto, tasaej, montoej, aportepropioej, aporteotrosej, presupuestototalej, subtitulo, idioma, "prefijoRuta", imagen, "creditoImagen", "enlaceImagen", "altImagen", "resumenMd", "sinBilletera", "conBilletera", "creditosMd", "porPagar") VALUES (2, 'A relationship with Jesus', NULL, '2024-07-01', NULL, 1, NULL, NULL, '2024-07-14 00:24:13.852896', '2025-02-02 11:50:56.182794', NULL, 1.0, NULL, 'A relationship with Jesus', NULL, '2024-06-15', NULL, NULL, 'E', 'N', NULL, NULL, '', 1, 0, 0, 0, 0, 'Four brief guides to start a relationship with Jesus as Savior, Lord and friend', 'en', '/a-relationship-with-Jesus', '/img/Jn6_col.jpg', 'A drawing of Juan Carlos Partidas', 'https://misdibujoscristianos.blogspot.com/', 'A drawing of Jesus with bread and friends', 'Jesus is more than a religion and a denomination, we invite you to get to know Him personally.



If you want to give us feedback, to ask or to know more, you can write to us on WhatsApp or Telegram to the phone number +57 316 5383162 --if you want a videocall please propose a schedule.



If you want, we can also connect you with a church nearby.', true, true, '', NULL);


INSERT INTO public.cor1440_gen_objetivopf (id, proyectofinanciero_id, numero, objetivo) VALUES (1, 1, 'O1', 'Facilitar entablar una relación con Jesús');
INSERT INTO public.cor1440_gen_objetivopf (id, proyectofinanciero_id, numero, objetivo) VALUES (2, 2, 'O1', 'Make it easier to establish a relationship with Jesus');

INSERT INTO public.cor1440_gen_resultadopf (id, proyectofinanciero_id, objetivopf_id, numero, resultado) VALUES (1, 1, 1, 'R1', 'Facilitar relación personal mediante el Santo Espíritu y la lectura de la Biblia  y oración');
INSERT INTO public.cor1440_gen_resultadopf (id, proyectofinanciero_id, objetivopf_id, numero, resultado) VALUES (2, 1, 1, 'R2', 'Facilitar relación comunitaria mediante el Santo Espíritu, la interacción con otros creyentes y participando en una iglesia');
INSERT INTO public.cor1440_gen_resultadopf (id, proyectofinanciero_id, objetivopf_id, numero, resultado) VALUES (3, 2, 2, 'R1', 'Facilitate a personal relationship with Jesus through the Holy Spirit, reading of Bible and prayer.');
INSERT INTO public.cor1440_gen_resultadopf (id, proyectofinanciero_id, objetivopf_id, numero, resultado) VALUES (4, 2, 2, 'R2', 'Facilitate a communitary relationship wiith Jesus through the Holy Spirit, interacting with other belivers and participating in a church.');


INSERT INTO public.cor1440_gen_actividadpf (id, proyectofinanciero_id, nombrecorto, titulo, descripcion, resultadopf_id, actividadtipo_id, formulario_id, heredade_id, "sufijoRuta") VALUES (1, 1, 'G1', 'No tengas miedo - Marcos 6:45-52', '', 1, NULL, NULL, NULL, 'guia1');
INSERT INTO public.cor1440_gen_actividadpf (id, proyectofinanciero_id, nombrecorto, titulo, descripcion, resultadopf_id, actividadtipo_id, formulario_id, heredade_id, "sufijoRuta") VALUES (2, 1, 'G2', 'Encuentro con Jesús - Juan 4:1-26', '', 1, NULL, NULL, NULL, 'guia2');
INSERT INTO public.cor1440_gen_actividadpf (id, proyectofinanciero_id, nombrecorto, titulo, descripcion, resultadopf_id, actividadtipo_id, formulario_id, heredade_id, "sufijoRuta") VALUES (3, 1, 'G3', 'Ve a encontrarte con Jesús - Juan 11:17-27', '', 1, NULL, NULL, NULL, 'guia3');
INSERT INTO public.cor1440_gen_actividadpf (id, proyectofinanciero_id, nombrecorto, titulo, descripcion, resultadopf_id, actividadtipo_id, formulario_id, heredade_id, "sufijoRuta") VALUES (4, 1, 'G4', 'Hablando con Dios - Hechos 8:26-39', '', 1, NULL, NULL, NULL, 'guia4');
INSERT INTO public.cor1440_gen_actividadpf (id, proyectofinanciero_id, nombrecorto, titulo, descripcion, resultadopf_id, actividadtipo_id, formulario_id, heredade_id, "sufijoRuta") VALUES (15, 2, 'I1', 'Meet with other beliver, study Bible and pray', '', 4, NULL, NULL, NULL, '');
INSERT INTO public.cor1440_gen_actividadpf (id, proyectofinanciero_id, nombrecorto, titulo, descripcion, resultadopf_id, actividadtipo_id, formulario_id, heredade_id, "sufijoRuta") VALUES (16, 2, 'I2', 'Attend to a church', '', 4, NULL, NULL, NULL, '');
INSERT INTO public.cor1440_gen_actividadpf (id, proyectofinanciero_id, nombrecorto, titulo, descripcion, resultadopf_id, actividadtipo_id, formulario_id, heredade_id, "sufijoRuta") VALUES (12, 2, 'G2', 'Meeting with Jesus - John 4:1-26', '', 3, NULL, NULL, NULL, 'guide2');
INSERT INTO public.cor1440_gen_actividadpf (id, proyectofinanciero_id, nombrecorto, titulo, descripcion, resultadopf_id, actividadtipo_id, formulario_id, heredade_id, "sufijoRuta") VALUES (13, 2, 'G3', 'Go out to meet Jesus - John 11:17-27', '', 3, NULL, NULL, NULL, 'guide3');
INSERT INTO public.cor1440_gen_actividadpf (id, proyectofinanciero_id, nombrecorto, titulo, descripcion, resultadopf_id, actividadtipo_id, formulario_id, heredade_id, "sufijoRuta") VALUES (14, 2, 'G4', 'Talking with God - Acts 8:26-39', '', 3, NULL, NULL, NULL, 'guide4');
INSERT INTO public.cor1440_gen_actividadpf (id, proyectofinanciero_id, nombrecorto, titulo, descripcion, resultadopf_id, actividadtipo_id, formulario_id, heredade_id, "sufijoRuta") VALUES (11, 2, 'G1', 'Don''t be afraid - Mark 6:45-52', '', 3, NULL, NULL, NULL, 'guide1');


