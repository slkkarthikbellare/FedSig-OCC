#!/bin/bash

additionalOptions=$1 $2 $3

mv dist/externalPriceSSE.zip dist/externalPriceSSE.zip.bak
cd externalPriceSSE
zip -q -r ../dist/externalPriceSSE.zip *
zip -q -r ../dist/externalPriceSSE.zip .env
