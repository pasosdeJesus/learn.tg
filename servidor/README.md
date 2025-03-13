# learn.tg

[![Revisado por Hound](https://img.shields.io/badge/Reviewed_by-Hound-8E64B0.svg)](https://houndci.com) Pruebas y seguridad:[![Estado Construcción](https://gitlab.com/pasosdeJesus/learntg/badges/main/pipeline.svg)](https://gitlab.com/pasosdeJesus/learntg/-/pipelines?page=1&scope=all&ref=main) [![Clima del Código](https://codeclimate.com/github/pasosdeJesus/learntg/badges/gpa.svg)](https://codeclimate.com/github/pasosdeJesus/learntg) [![Cobertura de Pruebas](https://codeclimate.com/github/pasosdeJesus/learntg/badges/coverage.svg)](https://codeclimate.com/github/pasosdeJesus/learntg)

Sistema para planeación y seguimiento de actividades e informes en una ONG.


### Requerimientos
* Ruby version >= 3.4
* PostgreSQL >= 16.2 con extensión unaccent disponible
* Recomendado sobre adJ 7.6 (que incluye todos los componentes mencionados).  Las siguientes instrucciones suponen que opera en este ambiente.

Para añadir la gema rbsecp256k1 antes se recomienda:

gemil securerandom openssl keccak scrypt

        doas pkg_add autoconf
y elegir 2.69x

        doas pkg_add automake
y elegir 1.16.x

Tras eso desde el directorio `servidor`:


### Arquitectura

Es una aplicación que emplea el motor genérico estilo Pasos de Jesús ```msip```
Ver https://github.com/pasosdeJesus/msip
y el motor cor1440_gen ver https://github.com/pasosdeJesus/cor1440_gen entre
otros.

## Uso

Por favor vea las instrucciones de sivel2 pues es muy similar:
https://github.com/pasosdeJesus/sivel2

