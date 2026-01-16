# To learn more about how to use Nix to configure your environment
# see: https://firebase.google.com/docs/studio/customize-workspace
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"

  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.pnpm
    pkgs.postgresql
    pkgs.postgresql.lib
    pkgs.ruby_3_3
    pkgs.gcc
    pkgs.gnumake
    pkgs.libxml2.dev
    pkgs.binutils
    pkgs.pkg-config
    pkgs.libyaml.dev
    pkgs.openssl.dev
    pkgs.autoconf
    pkgs.automake
    pkgs.libtool
    pkgs.m4
    pkgs.patch
  ];

  # Sets environment variables in the workspace
  env = {};
  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      # "vscodevim.vim"
    ];

    # Enable previews
    previews = {
      enable = true;
      previews = {
        # web = {
        #   # Example: run "npm run dev" with PORT set to IDX's defined port for previews,
        #   # and show it in IDX's web preview panel
        #   command = ["npm" "run" "dev"];
        #   manager = "web";
        #   env = {
        #     # Environment variables to set for your server
        #     PORT = "$PORT";
        #   };
        # };
      };
    };

    # Workspace lifecycle hooks
    workspace = {
      # Runs when a workspace is first created
      onCreate = {
        git-user-name = "git config --global user.name \"Vladimir Támara Patiño\"";
        git-user-email = "git config --global user.email \"vtamara@pasosdeJesus.org\"";
      };
      # Runs when the workspace is (re)started
      onStart = {
        # Example: start a background task to watch and re-build backend code
        # watch-backend = "npm run watch-backend";
      };
    };
  };
}
