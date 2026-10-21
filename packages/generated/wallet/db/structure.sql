--
-- Motor `wallet` — esquema de referencia (https://gitlab.com/pasosdeJesus/m/-/work_items/50)
-- Tablas propias: billetera_usuario (N billeteras por usuario) + billetera_invitada.
-- `eng:sync` deriva `model.tables` de aquí; las migraciones reales viven en `db/migrations/`.
--

CREATE SEQUENCE public.billetera_usuario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.billetera_usuario (
    id bigint DEFAULT nextval('public.billetera_usuario_id_seq'::regclass) NOT NULL,
    billetera character varying(60) NOT NULL,
    usuario_id integer NOT NULL,
    nonce character varying(255),
    nonce_expires_at timestamp without time zone,
    linked_at timestamp without time zone NOT NULL DEFAULT now(),
    linked_by character varying(60),
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT billetera_usuario_pkey PRIMARY KEY (id),
    CONSTRAINT billetera_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id),
    CONSTRAINT billetera_usuario_billetera_key UNIQUE (billetera),
    CONSTRAINT billetera_usuario_usuario_id_billetera_key UNIQUE (usuario_id, billetera)
);

CREATE INDEX billetera_usuario_usuario_id_idx ON public.billetera_usuario (usuario_id);

CREATE SEQUENCE public.billetera_invitada_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.billetera_invitada (
    id bigint DEFAULT nextval('public.billetera_invitada_id_seq'::regclass) NOT NULL,
    direccion_invitada character varying(60) NOT NULL,
    usuario_id integer NOT NULL,
    invited_by integer,
    used_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    expires_at timestamp without time zone NOT NULL DEFAULT (now() + interval '30 days'),
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT billetera_invitada_pkey PRIMARY KEY (id),
    CONSTRAINT billetera_invitada_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id)
);

CREATE UNIQUE INDEX billetera_invitada_pendiente_direccion_idx ON public.billetera_invitada (direccion_invitada) WHERE used_at IS NULL AND cancelled_at IS NULL;

CREATE UNIQUE INDEX billetera_invitada_pendiente_usuario_idx ON public.billetera_invitada (usuario_id, direccion_invitada) WHERE used_at IS NULL AND cancelled_at IS NULL;
