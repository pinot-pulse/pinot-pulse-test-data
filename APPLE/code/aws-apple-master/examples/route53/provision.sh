#!/bin/bash

set -e

source vars.sh

function usage() {
    echo "Usage: $0 [options]"
    echo " -hz, --hosted-zone               create Hosted Zone? (default: false)"
    echo " -c, --cname                      create CNAME record? (default: false)"
}


function create_cname() {
    echo
    read -p "Please enter CNAME record (i.e. apple.test.com, test.apple.com): " varrs
    echo "var: $varhz"
    if [[ -z "$varhz" ]]
    then
      :
    else
      if [[ $varrs =~ $varhz ]];
      then
          :
      else
          echo
          echo "\"$varrs\" is not in the hosted zone: \"$varhz\""
          exit 1
      fi
    fi
    echo
    read -p "Please enter VPC-E DNS name to map to CNAME record: " varvpcdns
    echo
    echo  "Mapping \"$varvpcdns\" to CNAME entry for \"$varrs\" for SLD \"$varhz\""

    aws cloudformation deploy \
    --no-fail-on-empty-changeset \
    --template-file recordset.yaml \
    --stack-name r53-rs-for-"$(echo $varrs | sed -e 's/[.]/-/g')" \
    --parameter-overrides \
        HZName=$varhz. \
        NameRecord=$varrs \
        ResourceRecord=$varvpcdns
}

function die() {
  usage
  echo "$0: error: $1" 1>&2
  exit 1
}

function create_hosted_zone(){
    echo
    read -p "Please enter Hosted Zone name (i.e. test.com, apple.com): " varhz
    if [ "$(echo "$varhz" | grep -o '\.' | wc -l)" -ne 1 ]; then
      echo
      echo "Please include TLD (i.e. .com, )"
      exit 1
    fi
    echo
    echo "Creating hosted zone for \"$varhz\""

    aws cloudformation deploy \
    --no-fail-on-empty-changeset \
    --template-file hostedzone.yaml \
    --stack-name r53-hz-for-"${varhz/./-}" \
    --parameter-overrides \
        HostedZoneName=$varhz

}

function choice(){
    echo
    read -p "Create CNAME entry for \"$varhz\"? (y/n): " varanswer
    if [[ $varanswer == "y" ]]; then
      echo $varhz
      create_cname
    elif [[ $varanswer == "n" ]]; then
      echo
      read -p "Please enter Hosted Zone name (i.e. 'apple.com', 'test.com'): " varhz
      echo $varhz
      create_cname
    else
      echo
      echo "Not a valid entry"
    fi
}


while [ $# -gt 0 ]; do
  case "$1" in
    --help|-h )
      usage
      exit 0
      ;;
    --hosted-zone|-hz )
      HOSTED_ZONE="$2"
      ;;
    --cname|-c )
      CNAME="$2"
      ;;
    *)
      echo "Invalid option: $1" 1>&2
      usage
      exit 1
  esac
  shift
  shift
done

  case $HOSTED_ZONE in
	true)
        create_hosted_zone
        if [[ $CNAME == "true" ]];
        then
            choice
        fi
		;;
	false)
        if [[ $CNAME == "true" ]];
        then
		      create_cname
        fi
		;;
	*)
		echo "Not a valid entry"
		;;
  esac
