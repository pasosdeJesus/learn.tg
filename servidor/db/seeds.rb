conexion = ActiveRecord::Base.connection();

#cor1440, cor1440
conexion.execute("INSERT INTO public.usuario 
(nusuario, nombre, email, encrypted_password, password, 
  fechacreacion, created_at, updated_at, rol) 
  VALUES ('cor1440', 'cor1440', 'cor1440@localhost', 
  '$2a$10$q0KcAa.H6.3VrXeKTJHa/ue8uT0y7WVKKHlAVor.Nejpz1OAgAQOq',
  '', '2014-08-26', '2014-08-26', '2014-08-26', 1);")

# De motores
motor = ['msip', 'cor1440_gen', nil]
motor.each do |m|
    Msip::carga_semillas_sql(conexion, m, :cambios)
    Msip::carga_semillas_sql(conexion, m, :datos)
end


