#!/bin/sh

idus=$1
if (test "$idus" = "") then {
  echo Falta id de usuario
  exit 1
} fi;
bin/m db:console "Update public.usuario set passport_name=nombre, passport_nationality=pais_id where id=$idus"
