#!/bin/bash
# This is a helper script to simplify testing of the API Gateway REST API and the example Flask API
# we've provided.
#
# You can optionally test the Flask API application locally by including the `-l` option when executing
# the script. See the README for more information.


set -eu

source ./scripts/vars.sh

LOCAL=false
DSID=""
CMD=0

function usage() {
  echo "Usage: $0 [options]"
  echo " -h, --help                 show this message"
  echo " -l, --local                only test the Flask API app (must be running on :5000)"
  echo " -d, --dsid                 the DSID (prsId) of the user"
  echo " --get-user -d <dsid>       GET a user from the api"
  echo " --get-users                GET all users from the api"
  echo " --create-user -d <dsid>    POST a user to the api"
  echo " --delete-user -d <dsid>    DELETE a user from the api"
}

function get_user() {
  if $LOCAL; then
    set -x
    curl -sS "localhost:5000/api/user/$DSID" | jq
  else
    set -x
    aws apigateway test-invoke-method \
      --rest-api-id $API_ID \
      --resource-id $RESOURCE_ID \
      --http-method get \
      --path-with-query-string "/api/user/$DSID" \
      | jq -r '.body' \
      | jq
  fi
}

function get_users() {
  if $LOCAL; then
    set -x
    curl -sS "localhost:5000/api/user" | jq
  else
    set -x
    aws apigateway test-invoke-method \
      --rest-api-id $API_ID \
      --resource-id $RESOURCE_ID \
      --http-method get \
      --path-with-query-string "/api/user" \
      | jq -r '.body' \
      | jq
  fi
}

function create_user() {
  if $LOCAL; then
    set -x
    curl \
      -sS \
      -H "Content-Type: application/json" \
      --data '{"firstName": "Jane", "lastName": "Doe", "emailAddress": "jane_doe@apple.com"}' \
      "localhost:5000/api/user/$DSID" \
      | jq
  else
    set -x
    aws apigateway test-invoke-method \
      --rest-api-id $API_ID \
      --resource-id $RESOURCE_ID \
      --http-method post \
      --path-with-query-string "/api/user/$DSID" \
      --body '{"firstName": "Jane", "lastName": "Doe", "emailAddress": "jane_doe@apple.com"}' \
      --headers Content-Type=application/json \
      | jq -r '.body' \
      | jq
  fi
}

function delete_user() {
  if $LOCAL; then
    set -x
    curl \
    -sS \
    -X DELETE \
    "localhost:5000/api/user/$DSID" \
    | jq
  else
    set -x
    aws apigateway test-invoke-method \
      --rest-api-id $API_ID \
      --resource-id $RESOURCE_ID \
      --http-method delete \
      --path-with-query-string "/api/user/$DSID" \
      | jq -r '.body' \
      | jq
  fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help )
      usage
      exit 0
      ;;
    -l|--local)
      LOCAL=true
      ;;
    -d|--dsid)
      DSID="$2"
      shift
      ;;
    --get-user)
      CMD=1
      ;;
    --get-users)
      CMD=2
      ;;
    --create-user)
      CMD=3
      ;;
    --delete-user)
      CMD=4
      ;;
    *)
      echo "Invalid option: $1" 1>&2
      usage
      exit 1
  esac
  shift
done

case "$CMD" in
  1)
  get_user
  ;;
  2)
  get_users
  ;;
  3)
  create_user
  ;;
  4)
  delete_user
  ;;
esac

