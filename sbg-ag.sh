#!/usr/bin/env sh
Xvfb :99 &
export DISPLAY=:99

export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20

./bin/infra.js download-salzburg-ag --target day --headless
./bin/infra.js import-salzburg-ag --target day --file ./Lastprofilwerte.csv
rm ./Lastprofilwerte.csv
./bin/infra.js download-salzburg-ag --target night --headless
./bin/infra.js import-salzburg-ag --target night --file ./Lastprofilwerte.csv
rm ./Lastprofilwerte.csv
