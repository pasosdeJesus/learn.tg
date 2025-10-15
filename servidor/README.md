# learn.tg

[![Revisado por Hound](https://img.shields.io/badge/Reviewed_by-Hound-8E64B0.svg)](https://houndci.com) Pruebas y seguridad:[![Estado Construcción](https://gitlab.com/pasosdeJesus/learn.tg/badges/main/pipeline.svg)](https://gitlab.com/pasosdeJesus/learn.tg/-/pipelines?page=1&scope=all&ref=main) [![Clima del Código](https://codeclimate.com/github/pasosdeJesus/learn.tg/badges/gpa.svg)](https://codeclimate.com/github/pasosdeJesus/learn.tg) [![Cobertura de Pruebas](https://codeclimate.com/github/pasosdeJesus/learn.tg/badges/coverage.svg)](https://codeclimate.com/github/pasosdeJesus/learn.tg)

Manage courses.


### Requerimientos
* Ruby version >= 3.4
* PostgreSQL >= 16.2 with extension unaccent 
* We suggest to run on adJ 7.6 (that includes all the components mentioned).
  The following instructions suppose that you are working on that environment.

To add the gem `rbsecp256k1`, we suggest:

1. Install other gems that it will require

        doas gem install --install-dir /var/www/bundler/ruby/3.4 securerandom openssl keccak scrypt

2. Install `autoconf`:

        doas pkg_add autoconf
    and choose 2.69x

3. Install `automake`:

        doas pkg_add automake
  and choose 1.16.x

4. Install `libtool`:
        doas pkg_add libtool

5. And then `rbsecp256k1` with the correct environment variables:

        AUTOMAKE_VERSION=1.16 AUTOCONF_VERSION=2.69 doas gem install --install-dir /var/www/bundler/ruby/3.4 rbsecp256k1


### Arquitectura

Es una aplicación que emplea el motor genérico estilo Pasos de Jesús ```msip```
Ver https://github.com/pasosdeJesus/msip
y el motor cor1440_gen ver https://github.com/pasosdeJesus/cor1440_gen entre
otros.

## Run a development instance

Generate a certificate to run in TLS. Private key and public key should be at:
`../cert/llave.pem` ../.cert/cert.pem

The list of certification authorities is expected at `/etc/ssl/cert.pem` you
could set a different location by replacing it in `IPDES`

Configure environment variables:

        cp .env.plantilla .env

Change at least:
1. Variables for the PostgreSQL engine: `BD_SERVIDOR`, `BD_USUARIO`, `BD_CLAVE`, 
2. Name of databases development `BD_DES`, test `BD_PRUEBA` and 
   production `BD_PRO`
3. Path to the sources in `DIRAP`

Create the user for the database that you specified in `BD_USUARIO`, for example `learntg` with:

```sh
doas su - _postgresql
createuser -h /var/www/var/run/postgresql -U postgres -s learntg
psql -h /var/www/var/run/postgresql -U postgres learntg
> alter user learntg with password 'mypassword';
> \e
exit
```

And add the password for the user `learntg` at `~/.pgpass` with a line like:
```
*:*:*:learntg:mypassword
```

Create the database that you specified in `BD_DES` (for example `learntg_des`) with something like:
```sh
createdb -U learntg -h /var/www/var/run/postgresql learntg_des
```

Create the schema and the initial data (seed) with:
```sh
bin/rails db:drop db:create db:setup db:seed msip:indices
```

And then run the development server with:
```sh
./bin/corre
```

To stop it, from another terminal you could run: `./bin/detiene`

Once started, with a browser check https://127.0.0.1:3000/learntg-admin

You can login with the default user `cor1440` and password `cor1440`.




