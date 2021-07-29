#!/bin/bash

source vars.sh

function usage() {
    echo "Usage: $0 [options]"
    echo " -p, --port                              The port number that the cache engine will listen on (default: 6379)"
    echo " -e, --cluster-engine <redis|memcached>  ClusterEngine (default: redis)"
    echo " -v, --engine-version                    The version number of the cache engine to be used (default: 5.0.6)"
    echo " --num-cache-clusters                    Minimum number of cache clusters (default: 2)"
    echo " --cache-node-type                       The compute and memory capacity of the nodes in the node group (default: cache.m3.medium)"
}

function die() {
  usage
  echo "$0: error: $1" 1>&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --help|-h )
      usage
      exit 0
      ;;
    --port|-p )
      PORT="$2"
      ;;
    --cluster-engine|-e )
      CLUSTER_ENGINE="$2"
      ;;
    --engine-version|-v )
      ENGINE_VERSION="$2"
      ;;
    --num-cache-clusters )
      NUM_CACHE_CLUSTERS="$2"
      ;;
    --cache-node-type )
      CACHE_NODE_TYPE="$2"
      ;;
    *)
      echo "Invalid option: $1" 1>&2
      usage
      exit 1
  esac
  shift
  shift
done

# Launch the Replication Group stack
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file elasticache.yaml \
  --stack-name $RG_STACK_NAME \
  --parameter-overrides \
    ClusterEngine=$CLUSTER_ENGINE \
    Port=$PORT \
    EngineVersion=$ENGINE_VERSION \
    NumCacheClusters=$NUM_CACHE_CLUSTERS \
    CacheNodeType=$CACHE_NODE_TYPE \
  --capabilities=CAPABILITY_IAM
