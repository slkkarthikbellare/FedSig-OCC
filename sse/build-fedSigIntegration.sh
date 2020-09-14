#!/bin/bash

additionalOptions=$1 $2 $3

mv dist/fedSigIntegrations.zip dist/fedSigIntegrations.zip.bak
cd fedSigIntegrations
zip ${additionalOptions} -r ../dist/fedSigIntegrations.zip *
