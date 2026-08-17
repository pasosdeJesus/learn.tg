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

Native gems (with C extensions) must be installed with `doas` because the
extension `make install` runs `install -o root -g bin` (requires root to
`chown`). Use `gem install` directly — it works from any shell (sh, bash,
zsh), no helper needed:

```sh
doas gem install -N --install-dir <BUNDLE_PATH>/ruby/3.4/ <gem> -v <version>
```

`<BUNDLE_PATH>` is the `BUNDLE_PATH` value in `~/.bundle/config` (e.g.
`/var/www/adJ-ia/bundler`). The `-N` flag skips ri/rdoc docs. Install each
native gem this way, e.g.:

```sh
doas gem install -N --install-dir /var/www/adJ-ia/bundler/ruby/3.4/ bcrypt -v 3.1.22
doas gem install -N --install-dir /var/www/adJ-ia/bundler/ruby/3.4/ pg -v 1.6.3
doas gem install -N --install-dir /var/www/adJ-ia/bundler/ruby/3.4/ libxml-ruby -v 5.0.6
# ... puma nio4r unicorn kgio raindrops sassc ffi msgpack redcarpet bindex websocket-driver etc.
```

> Tip: zsh users may wrap the above in a function (the `gemil` helper in
> `~/.zsh/funciones/gemil` does exactly this), but it is not required — plain
> `doas gem install` works from any shell.

To add the gem `rbsecp256k1`, it needs the autotools toolchain and GNU
libtool (its `autogen.sh` invokes `autoreconf` and requires the libtool m4
macros for `LT_INIT`):

1. Install the autotools meta wrapper plus the versions rbsecp256k1 expects:

        doas pkg_add -I autoconf-2.69p3 automake-1.16.5p0 metaauto-1.0p4 libtool-2.4.2p3

2. And then `rbsecp256k1` with the matching environment variables (also works
   from any shell):

        AUTOMAKE_VERSION=1.16 AUTOCONF_VERSION=2.69 doas gem install -N --install-dir /var/www/adJ-ia/bundler/ruby/3.4/ rbsecp256k1 -v 6.0.0

3. Verify all gems are present:

        bundle check


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

### First-time asset pipeline (required or HTML pages return 500)

In development mode the asset pipeline needs the JS/CSS build outputs and
the engine asset symlinks. Without these, `stylesheet_link_tag "application"`
raises `Sprockets::ArgumentError (link_tree argument must be a directory)`
or `Sprockets::FileNotFound (couldn't find file 'msip/application.css')`.

```sh
CXX=c++ yarn install                      # JS deps -> node_modules
bundle exec bin/rails msip:enlaces_motores # engine asset symlinks
yarn build:css                            # postcss -> app/assets/builds/application.css
yarn build                                # esbuild -> app/assets/builds/*.js
bundle exec bin/rails assets:precompile
```

No `config/initializers/assets.rb` change is needed: sprockets-rails
automatically adds every existing directory under `app/assets/` to the load
path at boot (`existent_directories`). Once `yarn build` has created
`app/assets/builds/`, `stylesheet_link_tag "application"` resolves to the
built `application.css`. Just make sure the server starts *after* `yarn build`,
which the normal `bin/corre` flow already does.

> Note: `R=f` (fast mode) skips `yarn build`. On a fresh checkout the first
> `R=f bin/corre` run 500s until you run `yarn build:css` + `yarn build` once
> and restart the server.

### Run

And then run the development server (must be via `bundle exec` — `dotenv`
lives in the bundle path, not the system gem path; and the data segment limit
must be at least 7 GB):

```sh
ulimit -d 7340032 && bundle exec ./bin/corre
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

