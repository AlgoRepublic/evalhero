module.exports = {
  apps: [
    {
      name: "evalhero-web-dev",
      script: "npx",
      args: "serve -s dist -l 5173",
      cwd: "/var/www/evalhero-web"
    },
    {
      name: "evalhero-web-prod",
      script: "npx",
      args: "serve -s dist -l 5173",
      cwd: "/var/www/evalhero-web"
    }
  ]
};
