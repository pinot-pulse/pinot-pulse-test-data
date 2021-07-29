#!/bin/bash
set -ex

# Variables
GIT_ROOT=$(git rev-parse --show-toplevel)
DOMAIN="dashboard"
COMMONNAME="${DOMAIN}.example.com"
COUNTRY=US
STATE=CA
LOCALITY=Cupertino
ORG=Apple
OU=AIS
EMAIL=noreply@apple.com
PASSWORD=dUmmypAssw0rd

WORK_DIR=${GIT_ROOT}/examples/eks/apps/kubernetes-dashboard/overlays/dev/certs
mkdir -p ${WORK_DIR}

function cleanup {
  rm -rf "$WORK_DIR"
  echo "Deleted temp working directory $WORK_DIR"
}

# register the cleanup function to be called on the EXIT signal
trap cleanup EXIT

function gen_certs {
  #Generate a key
  echo "Generating key request for ${DOMAIN}"
  openssl genrsa -des3 -passout pass:${PASSWORD} -out ${WORK_DIR}/${DOMAIN}.key 2048 -noout


  #Create the request
  echo "Creating CSR"
  openssl req -new -key ${WORK_DIR}/${DOMAIN}.key -out ${WORK_DIR}/${DOMAIN}.csr -passin pass:${PASSWORD} \
      -subj "/C=${COUNTRY}/ST=${STATE}/L=${LOCALITY}/O=${ORG}/OU=${OU}/CN=${COMMONNAME}/emailAddress=${EMAIL}"

  #Remove passphrase from the key. Comment the line out to keep the passphrase
  echo "Removing passphrase from key"
  openssl rsa -in ${WORK_DIR}/${DOMAIN}.key -passin pass:${PASSWORD} -out ${WORK_DIR}/${DOMAIN}.key

  # Create self signed cert
  openssl x509 -req -days 365 -in ${WORK_DIR}/${DOMAIN}.csr -signkey ${WORK_DIR}/${DOMAIN}.key -out ${WORK_DIR}/${DOMAIN}.crt
}

gen_certs
curl -o ${GIT_ROOT}/examples/eks/apps/kubernetes-dashboard/base/dashboard.yaml https://raw.githubusercontent.com/kubernetes/dashboard/v1.10.1/src/deploy/recommended/kubernetes-dashboard.yaml
curl -o ${GIT_ROOT}/examples/eks/apps/kubernetes-dashboard/base/heapster.yaml https://raw.githubusercontent.com/kubernetes/heapster/master/deploy/kube-config/influxdb/heapster.yaml
curl -o ${GIT_ROOT}/examples/eks/apps/kubernetes-dashboard/base/influxdb.yaml https://raw.githubusercontent.com/kubernetes/heapster/master/deploy/kube-config/influxdb/influxdb.yaml
curl -o ${GIT_ROOT}/examples/eks/apps/kubernetes-dashboard/base/heapster-rbac.yaml https://raw.githubusercontent.com/kubernetes/heapster/master/deploy/kube-config/rbac/heapster-rbac.yaml

kubectl apply -k ${GIT_ROOT}/examples/eks/apps/kubernetes-dashboard/overlays/dev
