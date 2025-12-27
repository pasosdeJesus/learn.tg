# Learn.tg - Main Backend Server

This directory contains the Ruby on Rails backend for Learn.tg. It 
serves as an administrative API and management hub for courses, users, 
and educational content.

### Requirements
* Ruby version >= 3.4
* PostgreSQL >= 16.2 with extension unaccent 
* We suggest to run on adJ 7.7 (that includes all the components mentioned).
  The following instructions suppose that you are working on that 
  environment.

To add the gem `rbsecp256k1`, we suggest:

1. Install other gems that it will require

        doas gem install --install-dir /var/www/bundler/ruby/3.4 securerandom openssl keccak scrypt

2. Install `autoconf`:

        doas pkg_add autoconf
    and choose `2.69x`

3. Install `automake`:

        doas pkg_add automake
  and choose `1.16.x`

4. Install `libtool`:
        doas pkg_add libtool

5. And then `rbsecp256k1` with the correct environment variables:

        AUTOMAKE_VERSION=1.16 AUTOCONF_VERSION=2.69 doas gem install --install-dir /var/www/bundler/ruby/3.4 rbsecp256k1


### Architecture

It is an application that uses the generic Pasos de Jesús-style 
engine `msipn`.
See https://github.com/pasosdeJesus/msip branch msipn
and the cor1440_gen engine, see https://github.com/pasosdeJesus/cor1440_gen,
among others.

## Run a development instance

Generate a certificate to run in TLS. Private key and public key should 
be at:
`../cert/llave.pem` ../.cert/cert.pem

The list of certification authorities is expected at `/etc/ssl/cert.pem` you
could set a different location by replacing it in `IPDES`

Configure environment variables:

        cp .env.plantilla .env

Change at least:
1. Variables for the PostgreSQL engine: `BD_SERVIDOR`, `BD_USUARIO`, 
   `BD_CLAVE`, 
2. Name of the databases: development `BD_DES`, test `BD_PRUEBA` and 
   production `BD_PRO`
3. Path to the sources in `DIRAP`

Create the database user you specified in `BD_USUARIO`, for example 
`learntg`, with:

```sh
doas su - _postgresql
createuser -h /var/www/var/run/postgresql -U postgres -s learntg
psql -h /var/www/var/run/postgresql -U postgres
> alter user learntg with password 'mypassword';
> \e
exit
```

And add the password for the `learntg` user at `~/.pgpass` with a line 
like:
```
*:*:*:learntg:mypassword
```

Create the database you specified in `BD_DES` (for example `learntg_des`)
with something like:
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

To stop it, from another terminal, you can run: `./bin/detiene`

Once started, with a browser check <https://127.0.0.1:3000/learntg-admin>

You can login with the default user `cor1440` and password `cor1440`.

## Testing

The project uses Minitest for Ruby tests and Rubocop for linting.

### Running Tests

To run the test suite:

```sh
bundle exec rails test
```

Or using rake:

```sh
bundle exec rake test
```

### Code Quality and Linting

To run Rubocop and check code style:

```sh
bundle exec rubocop
```

To automatically fix some linting issues:

```sh
bundle exec rubocop -a
```

