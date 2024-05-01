#!/usr/bin/env sh
./bin/infra.js download-salzburg-ag --target day --headless
./bin/infra.js import-salzburg-ag --target day --file ./Lastprofilwerte.csv
rm ./Lastprofilwerte.csv
./bin/infra.js download-salzburg-ag --target night --headless
./bin/infra.js import-salzburg-ag --target night --file ./Lastprofilwerte.csv
rm ./Lastprofilwerte.csv
